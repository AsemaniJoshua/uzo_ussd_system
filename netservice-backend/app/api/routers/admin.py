# app/api/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer

from app.core.security import create_access_token, verify_password, get_password_hash, verify_access_token
from app.db.session import get_session
from sqlalchemy.ext.asyncio import AsyncSession
from app.usecases.transaction_usecases import TransactionUseCases
from app.usecases.settings_usecases import SettingsUseCases
from app.schemas.auth import Token, AdminCreate, AdminOut, PasswordUpdate
from app.repositories.admin_user_repo import AdminUserRepository
from app.models.orm_models import AdminRole

router = APIRouter(prefix="/admin")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/admin/token")


async def get_current_admin(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_session)):
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"get_current_admin called with token: {token[:20]}..." if token else "No token")
    
    sub = verify_access_token(token)
    logger.info(f"Token verification result - username: {sub}")
    
    if not sub:
        logger.error("Token verification failed - invalid token")
        raise HTTPException(status_code=401, detail="Invalid token")
    
    repo = AdminUserRepository(db)
    admin = await repo.get_by_username(sub)
    
    if not admin:
        logger.error(f"Admin user not found for username: {sub}")
        raise HTTPException(status_code=401, detail="Invalid admin user")
    
    logger.info(f"Admin authenticated: {admin.username} (id: {admin.id})")
    return admin

async def get_superadmin(admin = Depends(get_current_admin)):
    if admin.role != AdminRole.superadmin:
        raise HTTPException(status_code=403, detail="Not authorized. Superadmin access required.")
    return admin


# Create a new admin user (superadmin only in production)
@router.post("/create")
async def create_admin(admin_in: AdminCreate, db: AsyncSession = Depends(get_session), admin = Depends(get_superadmin)):
    repo = AdminUserRepository(db)
    existing = await repo.get_by_username(admin_in.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    admin = await repo.create(admin_in)
    return {
        "id": admin.id,
        "username": admin.username,
        "role": admin.role,
        "created_at": admin.created_at,
        "updated_at": admin.updated_at
    }


# Login with admin user from DB
@router.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_session)):
    repo = AdminUserRepository(db)
    admin = await repo.get_by_username(form_data.username)
    
    # Debug logging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Login attempt - Username: {form_data.username}")
    
    if not admin:
        logger.warning(f"Admin user not found: {form_data.username}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    password_valid = verify_password(form_data.password, admin.password_hash)
    logger.info(f"Password verification result: {password_valid}")
    
    if not password_valid:
        logger.warning(f"Invalid password for user: {form_data.username}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(admin.username)
    logger.info(f"Login successful for user: {form_data.username}")
    response = {
        "access_token": token, 
        "token_type": "bearer",
        "user": {
            "id": admin.id,
            "username": admin.username,
            "role": admin.role
        }
    }
    logger.info(f"Returning response: {response}")
    return response



@router.get("/requests")
async def list_requests(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_session), admin = Depends(get_current_admin)):
    uc = TransactionUseCases(db)
    rows = await uc.list_transactions(skip=skip, limit=limit)
    return rows

@router.get("/requests/by-date")
async def list_requests_by_date(
    date: str,
    status: str | None = None,
    db: AsyncSession = Depends(get_session),
    admin = Depends(get_current_admin)
):
    try:
        from datetime import datetime
        parsed_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD")
        
    if not status or status == "null" or status == "undefined":
        status = None
        
    uc = TransactionUseCases(db)
    transactions = await uc.list_transactions_by_date(parsed_date, status)
    return [
        {
            "id": tx.id,
            "session_id": tx.session_id,
            "user_msisdn": tx.user_msisdn,
            "network": tx.network.value if hasattr(tx.network, "value") else tx.network,
            "package_name": tx.package_name,
            "amount": float(tx.amount),
            "recipient": tx.recipient,
            "status": tx.status.value if hasattr(tx.status, "value") else tx.status,
            "created_at": tx.created_at,
            "payment_reference": tx.payment_reference,
            "profit_amount": float(tx.profit_amount) if tx.profit_amount is not None else None
        }
        for tx in transactions
    ]


@router.get("/requests/recent-days")
async def list_recent_requests(
    days: int = 31,
    db: AsyncSession = Depends(get_session),
    admin = Depends(get_current_admin)
):
    uc = TransactionUseCases(db)
    transactions = await uc.list_recent_transactions(days=days)
    return [
        {
            "id": tx.id,
            "session_id": tx.session_id,
            "user_msisdn": tx.user_msisdn,
            "network": tx.network.value if hasattr(tx.network, "value") else tx.network,
            "package_name": tx.package_name,
            "amount": float(tx.amount),
            "recipient": tx.recipient,
            "status": tx.status.value if hasattr(tx.status, "value") else tx.status,
            "created_at": tx.created_at,
            "payment_reference": tx.payment_reference,
            "profit_amount": float(tx.profit_amount) if tx.profit_amount is not None else None
        }
        for tx in transactions
    ]


@router.post("/requests/{request_id}/serve")
async def serve_request(request_id: int, db: AsyncSession = Depends(get_session), admin = Depends(get_current_admin)):
    uc = TransactionUseCases(db)
    try:
        served = await uc.serve_transaction(request_id, processed_by=admin.username)
        if not served:
            raise HTTPException(status_code=404, detail="Request not found")
        return served
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/served")
async def list_served_requests(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_session), admin = Depends(get_current_admin)):
    uc = TransactionUseCases(db)
    rows = await uc.list_served_requests(skip=skip, limit=limit)
    return rows

@router.post("/served/{served_id}/unserve")
async def unserve_request(served_id: int, db: AsyncSession = Depends(get_session), admin = Depends(get_current_admin)):
    uc = TransactionUseCases(db)
    tx = await uc.unserve_request(served_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Served request not found")
    return tx

@router.delete("/served/{served_id}")
async def delete_served_request(served_id: int, db: AsyncSession = Depends(get_session), admin = Depends(get_current_admin)):
    uc = TransactionUseCases(db)
    result = await uc.delete_served_request(served_id)
    if not result:
        raise HTTPException(status_code=404, detail="Served request not found")
    return {"status": "deleted", "id": served_id}

@router.put("/update-password")
async def update_password(password_data: PasswordUpdate, db: AsyncSession = Depends(get_session), admin = Depends(get_current_admin)):
    # Verify current password
    if not verify_password(password_data.current_password, admin.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Update password
    repo = AdminUserRepository(db)
    updated_admin = await repo.update_password(admin.username, password_data.new_password)
    if not updated_admin:
        raise HTTPException(status_code=400, detail="Failed to update password")
    
    return {"message": "Password updated successfully"}

@router.get("/admins")
async def list_admins(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_session), admin = Depends(get_superadmin)):
    repo = AdminUserRepository(db)
    admins = await repo.list_all(skip=skip, limit=limit)
    return [
        {
            "id": a.id,
            "username": a.username,
            "role": a.role,
            "created_at": a.created_at,
            "updated_at": a.updated_at
        }
        for a in admins
    ]

@router.delete("/admins/{username}")
async def delete_admin(username: str, db: AsyncSession = Depends(get_session), current_admin = Depends(get_superadmin)):
    if username == current_admin.username:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    repo = AdminUserRepository(db)
    result = await repo.delete_by_username(username)
    if not result:
        raise HTTPException(status_code=404, detail="Admin not found")
    return {"message": "Admin deleted successfully"}


# Settings endpoints
@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_session), admin = Depends(get_current_admin)):
    """Get all system settings"""
    uc = SettingsUseCases(db)
    settings = await uc.get_all_settings()
    return settings


@router.put("/settings/ussd-restriction")
async def update_ussd_restriction(restricted: bool, db: AsyncSession = Depends(get_session), admin = Depends(get_superadmin)):
    """Enable or disable USSD restriction"""
    uc = SettingsUseCases(db)
    result = await uc.set_ussd_restriction(restricted)
    return result


# Whitelist upload endpoint
@router.post("/whitelist/upload")
async def upload_whitelist(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session),
    admin = Depends(get_superadmin)
):
    """Upload Excel file with phone numbers for whitelist import"""
    # Validate file type
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only Excel files (.xlsx, .xls) are accepted."
        )
    
    # Read file content
    try:
        file_content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    # Process the upload
    from app.services.whitelist_service import WhitelistService
    
    try:
        service = WhitelistService(batch_size=500)
        stats = await service.process_excel_upload(file_content, db)
        
        # Check if there was an error
        if 'error' in stats:
            raise HTTPException(status_code=400, detail=stats['error'])
        
        return {
            "success": True,
            "message": f"Successfully processed {stats['inserted']} numbers",
            "statistics": stats
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

