# app/api/routers/ussd.py

import logging
from datetime import datetime
from fastapi import APIRouter, Request, Depends, Header, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from app.services.ussd_service import (
    generate_main_menu, contact_support_text, select_network_menu,
    get_packages_menu, no_data_menu, recipient_choice_menu, enter_recipient_prompt,
    confirm_menu, final_payment_message, clean_package_name
)
from app.db.session import get_session
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.request_schemas import CreateTransactionIn
from app.usecases.transaction_usecases import TransactionUseCases
from decimal import Decimal
from pydantic import ValidationError
from app.repositories.package_repo import PackageRepository
from app.schemas.package_schemas import NetworkEnum

logger = logging.getLogger("ussd")

# Uzo USSD Request/Response Models
class UzoUSSDRequest(BaseModel):
    ussdString: str
    msisdn: str
    ussdServiceOp: str | int  # "1"=init, "18"=cont, "29+"=term
    sessionID: str
    network: str | int
    code: str = ""
    country: str = "GH"
    
    class Config:
        extra = "ignore"

class UzoUSSDResponse(BaseModel):
    message: str
    ussdServiceOp: int  # 2 = continue, 17 = end

# Network mapping (MNC codes for Ghana)
NETWORK_MAP = {
    "01": NetworkEnum.MTN,
    "02": NetworkEnum.TELECEL,
    "03": NetworkEnum.AT,
    "06": NetworkEnum.AT
}

# USSD Session States (State Machine Pattern)
class USSDState:
    HOME = "HOME"
    NETWORK_SELECT = "NETWORK_SELECT"
    PACKAGE_SELECT = "PACKAGE_SELECT"
    RECIPIENT_SELECT = "RECIPIENT_SELECT"
    ENTER_RECIPIENT = "ENTER_RECIPIENT"
    CONFIRM = "CONFIRM"
    PROCESSING = "PROCESSING"

# In-memory session storage (use Redis/Database in production)
ussd_sessions = {}

def cleanup_session(session_id: str):
    """Clean up session data"""
    if session_id in ussd_sessions:
        del ussd_sessions[session_id]

def get_or_create_session(session_id: str, is_new: bool = False):
    """Get existing session or create new one"""
    if is_new or session_id not in ussd_sessions:
        ussd_sessions[session_id] = {
            'stage': USSDState.HOME,
            'network': None,
            'package_idx': None,
            'package_name': None,
            'package_amount': None,
            'recipient': None,
            'current_page': 1,
        }
    return ussd_sessions[session_id]
router = APIRouter()

# Legacy simulator endpoint (for frontend simulator)
@router.post("/ussd/simulator")
async def ussd_simulator(
    session_id: str,
    msisdn: str, 
    user_input: str,
    db: AsyncSession = Depends(get_session)
):
    """Legacy endpoint for frontend simulator - converts to Moolre format internally"""
    try:
        # Convert to Uzo format for the state machine
        ussd_request = UzoUSSDRequest(
            sessionID=session_id,
            ussdString=user_input,
            ussdServiceOp="1" if user_input == "" else "18",
            msisdn=msisdn,
            network="01",  # Default to MTN for simulator
            code="*178#",
            country="GH"
        )
        
        network_code = ussd_request.network
        is_new_session = ussd_request.ussdServiceOp == "1"
        
        # Map network code to NetworkEnum
        network_enum = NETWORK_MAP.get(network_code)
        if not network_enum:
            return "Network not supported."

        # Initialize or get session state
        session = get_or_create_session(session_id, is_new_session)
        
        # If it's a new session, show main menu
        if is_new_session:
            menu_text = await generate_main_menu()
            return f"{menu_text}"
        
        # For Uzo, we use the input directly if it's not the initial dial
        last_input = user_input
        
        current_stage = session['stage']
        
        # State Machine Logic
        if current_stage == USSDState.HOME:
            if last_input == "1":
                session['stage'] = USSDState.NETWORK_SELECT
                ussd_sessions[session_id] = session
                return f"{select_network_menu()}"
            elif last_input == "2":
                cleanup_session(session_id)
                return f"{contact_support_text()}"
            else:
                return "Invalid option. Try again."
        
        elif current_stage == USSDState.NETWORK_SELECT:
            if last_input == "1":  # MTN
                session['stage'] = USSDState.PACKAGE_SELECT
                session['network'] = NetworkEnum.MTN
                ussd_sessions[session_id] = session
                packages = await get_packages_from_db(db, NetworkEnum.MTN)
                return f"{format_packages_menu(packages)}"
            elif last_input == "2":  # AirtelTigo
                session['stage'] = USSDState.PACKAGE_SELECT
                session['network'] = NetworkEnum.AT
                ussd_sessions[session_id] = session
                packages = await get_packages_from_db(db, NetworkEnum.AT)
                return f"{format_packages_menu(packages)}"
            elif last_input == "3":  # Telecel
                session['stage'] = USSDState.PACKAGE_SELECT
                session['network'] = NetworkEnum.TELECEL
                ussd_sessions[session_id] = session
                packages = await get_packages_from_db(db, NetworkEnum.TELECEL)
                return f"{format_packages_menu(packages)}"
            else:
                return "Invalid option. Try again."
        
        elif current_stage == USSDState.PACKAGE_SELECT:
            try:
                pkg_idx = int(last_input) - 1
                packages = await get_packages_from_db(db, session['network'])
                if 0 <= pkg_idx < len(packages):
                    session['package'] = packages[pkg_idx][0]
                    session['amount'] = packages[pkg_idx][1]
                    session['profit_amount'] = packages[pkg_idx][2]
                    session['stage'] = USSDState.ENTER_RECIPIENT
                    ussd_sessions[session_id] = session
                    return "Enter recipient phone number (10 digits):"
                else:
                    return "Invalid package selection."
            except (ValueError, IndexError):
                return "Invalid input. Please enter a number."
        
        elif current_stage == USSDState.ENTER_RECIPIENT:
            # For phone number input, use last_input (the actual phone number entered)
            if len(last_input) == 10 and last_input.isdigit():
                session['recipient'] = last_input
                session['stage'] = USSDState.CONFIRM
                ussd_sessions[session_id] = session
                return f"Confirm purchase:\nPackage: {session['package']}\nAmount: GHS {session['amount']}\nRecipient: {last_input}\n1. Confirm\n2. Cancel"
            else:
                return "Invalid phone number. Please enter 10 digits."
        
        elif current_stage == USSDState.CONFIRM:
            if last_input == "1":
                # Simulator mode: just show success message without creating DB record
                cleanup_session(session_id)
                clean_name = clean_package_name(session['package'])
                return f"Transaction successful!\n{clean_name} at GHS {session['amount']}\nRecipient: {session['recipient']}\n\nThis is a simulation - no actual transaction was created."
            elif last_input == "2":
                cleanup_session(session_id)
                return "Transaction cancelled."
            else:
                return "Invalid option. 1=Confirm, 2=Cancel"
        
        else:
            cleanup_session(session_id)
            return "Session error. Please try again."
            
    except Exception as e:
        logger.error(f"Simulator endpoint error: {e}", exc_info=True)
        return "Internal server error."

async def get_packages_from_db(db: AsyncSession, network: NetworkEnum):
    """Get packages from database"""
    repo = PackageRepository(db)
    packages = await repo.get_all(network)
    return [(pkg.package_name, str(pkg.amount), str(pkg.profit_amount) if pkg.profit_amount is not None else None) for pkg in packages if pkg.active == 1]

def format_packages_menu(packages):
    """Format packages list for USSD display"""
    if not packages:
        return "No packages available"
    
    menu_lines = ["Available Packages:"]
    for idx, (name, price) in enumerate(packages, 1):
        menu_lines.append(f"{idx}. {name} - GHS {price}")
    
    return "\n".join(menu_lines)

@router.post("/ussd/debug")
async def debug_ussd(request: Request):
    """Debug endpoint to see raw requests"""
    try:
        # Get all request info
        content_type = request.headers.get("content-type", "")
        headers = dict(request.headers)
        
        if "application/json" in content_type.lower():
            body = await request.json()
            return {"type": "json", "content_type": content_type, "headers": headers, "body": body}
        else:
            form = await request.form()
            return {"type": "form", "content_type": content_type, "headers": headers, "form": dict(form)}
    except Exception as e:
        return {"error": str(e), "content_type": content_type, "headers": headers}

@router.api_route("/ussd/raw", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def raw_ussd_capture(request: Request):
    """Capture any HTTP method to see what Moolre is actually sending"""
    try:
        method = request.method
        headers = dict(request.headers)
        url = str(request.url)
        query_params = dict(request.query_params)
        
        # First get raw body to see what Moolre is actually sending
        raw_body = await request.body()
        raw_content = raw_body.decode('utf-8', errors='ignore') if raw_body else "Empty body"
        
        body_data = {
            "raw_content": raw_content,
            "raw_length": len(raw_body) if raw_body else 0
        }
        
        content_type = request.headers.get("content-type", "").lower()
        
        # Try to parse based on content type
        try:
            if "application/x-www-form-urlencoded" in content_type and raw_content:
                # Parse URL-encoded data manually
                from urllib.parse import parse_qs
                parsed_form = parse_qs(raw_content)
                # Convert lists to single values for simpler display
                form_dict = {k: v[0] if v and len(v) == 1 else v for k, v in parsed_form.items()}
                body_data["parsed_form"] = form_dict
            elif "application/json" in content_type and raw_content:
                import json
                try:
                    parsed_json = json.loads(raw_content)
                    body_data["parsed_json"] = parsed_json
                except json.JSONDecodeError as je:
                    body_data["json_error"] = str(je)
        except Exception as parse_error:
            body_data["parse_error"] = str(parse_error)
        
        result = {
            "method": method,
            "url": url,
            "headers": headers,
            "query_params": query_params,
            "body": body_data,
            "timestamp": datetime.now().isoformat()
        }
        
        # Log with high visibility for Moolre data analysis - using both logger and print
        separator = "="*80
        capture_log = [
            separator,
            "MOOLRE RAW DATA CAPTURE",
            separator,
            f"HTTP Method: {method}",
            f"Full URL: {url}",
            f"Content-Type: {headers.get('content-type', 'Not provided')}",
            f"User-Agent: {headers.get('user-agent', 'Not provided')}",
            "Headers:"
        ]
        
        for key, value in headers.items():
            capture_log.append(f"  {key}: {value}")
        
        capture_log.append("Query Parameters:")
        if query_params:
            for key, value in query_params.items():
                capture_log.append(f"  {key}: {value}")
        else:
            capture_log.append("  None")
        
        capture_log.append("Body Data:")
        if body_data:
            capture_log.append(f"  {body_data}")
        else:
            capture_log.append("  Empty or None")
        
        capture_log.append(separator)
        
        # Output to both logger and console
        full_log = "\n".join(capture_log)
        logger.warning(full_log)  # Use warning level to ensure it shows
        print(full_log)  # Also print directly to console
        
        return {"captured": True, "data": result}
    except Exception as e:
        logger.error(f"Raw capture error: {e}")
        return {"error": str(e)}

@router.post("/ussd")
async def ussd_callback(
    request: Request,
    background_tasks: BackgroundTasks,
    x_moolre_secret: str | None = Header(None)
):
    try:
        # Handle Moolre's special case: JSON data with wrong Content-Type header
        content_type = request.headers.get("content-type", "").lower()
        logger.info(f"Request content-type: {content_type}")
        
        # Get raw body first to handle Moolre's Content-Type mismatch
        raw_body = await request.body()
        raw_content = raw_body.decode('utf-8', errors='ignore') if raw_body else ""
        
        logger.info(f"Raw body content: {raw_content[:500]}...")  # Log first 500 chars
        
        try:
            # Parse as Uzo request
            if raw_content.strip().startswith('{'):
                import json
                body = json.loads(raw_content)
                logger.info(f"Parsed as JSON: {body}")
                ussd_request = UzoUSSDRequest(**body)
            else:
                # Try form data parsing
                from urllib.parse import parse_qs
                parsed_form = parse_qs(raw_content)
                form_dict = {k: v[0] if v and len(v) == 1 else v for k, v in parsed_form.items()}
                logger.info(f"Parsed form data: {form_dict}")
                
                ussd_request = UzoUSSDRequest(
                    sessionID=form_dict.get("sessionID") or form_dict.get("sessionId") or "unknown",
                    ussdString=form_dict.get("ussdString") or form_dict.get("message") or "",
                    ussdServiceOp=str(form_dict.get("ussdServiceOp", "1")),
                    msisdn=form_dict.get("msisdn") or "",
                    network=str(form_dict.get("network", "01")),
                    code=form_dict.get("code", ""),
                    country=form_dict.get("country", "GH")
                )
        except Exception as parse_error:
            logger.error(f"Failed to parse request: {parse_error}")
            return UzoUSSDResponse(message="Request parsing failed.", ussdServiceOp=17).model_dump()

        session_id = ussd_request.sessionID
        msisdn = ussd_request.msisdn
        user_input = ussd_request.ussdString
        network_code = str(ussd_request.network)
        service_op = str(ussd_request.ussdServiceOp)
        is_new_session = service_op == "1"

        # Handle missing or invalid session ID
        if not session_id or session_id == "unknown":
            import time
            session_id = f"generated-{int(time.time())}-{msisdn[-4:] if msisdn else '0000'}"
            logger.info(f"Generated new session ID: {session_id}")

        # Map network code to NetworkEnum
        network_enum = NETWORK_MAP.get(network_code)
        if not network_enum:
            logger.warning(f"Unknown network code: {network_code}")
            return UzoUSSDResponse(message="Network not supported.", ussdServiceOp=17).model_dump()

        # Check USSD restriction before processing - Commented out as requested
        """
        from app.usecases.settings_usecases import SettingsUseCases
        from app.db.session import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            settings_uc = SettingsUseCases(db)
            is_restricted = await settings_uc.is_ussd_restricted()
            
            if is_restricted:
                # Check if user has paid transaction before
                tx_uc = TransactionUseCases(db)
                has_paid = await tx_uc.user_has_paid_before(msisdn)
                
                if not has_paid:
                    logger.info(f"USSD restricted - User {msisdn} has no paid transactions. Access blocked.")
                    return UzoUSSDResponse(
                        message="UNKNOWN APPLICATION.",
                        ussdServiceOp=17
                    ).model_dump()
                else:
                    logger.info(f"USSD restricted - User {msisdn} has paid before. Access allowed.")
        """

        # Initialize or get session state
        session = get_or_create_session(session_id, is_new_session)
        
        # If it's a new session, show main menu
        if is_new_session:
            menu_text = await generate_main_menu()
            return UzoUSSDResponse(message=menu_text, ussdServiceOp=2).model_dump()
        current_stage = session['stage']
        
        # State Machine Logic
        if current_stage == USSDState.HOME:
            if user_input == "1":
                session['stage'] = USSDState.NETWORK_SELECT
                ussd_sessions[session_id] = session
                return UzoUSSDResponse(message=select_network_menu(), ussdServiceOp=2).model_dump()
            elif user_input == "2":
                # End session after showing support info
                cleanup_session(session_id)
                return UzoUSSDResponse(message=contact_support_text(), ussdServiceOp=17).model_dump()
            else:
                return UzoUSSDResponse(message="Invalid option. Try again.", ussdServiceOp=2).model_dump()
        
        elif current_stage == USSDState.NETWORK_SELECT:
            if user_input == "1":  # MTN
                session['stage'] = USSDState.PACKAGE_SELECT
                session['network'] = NetworkEnum.MTN
                session['current_page'] = 1
                ussd_sessions[session_id] = session
                async for db in get_session():
                    packages_menu = await get_packages_menu(session['network'], db, page=session['current_page'])
                    return UzoUSSDResponse(message=packages_menu, ussdServiceOp=2).model_dump()
            elif user_input == "2":  # AT
                session['stage'] = USSDState.PACKAGE_SELECT
                session['network'] = NetworkEnum.AT
                session['current_page'] = 1
                ussd_sessions[session_id] = session
                async for db in get_session():
                    # Changed to use session['network'] to match MTN logic
                    packages_menu = await get_packages_menu(session['network'], db, page=session['current_page'])
                    return UzoUSSDResponse(message=packages_menu, ussdServiceOp=2).model_dump()
            elif user_input == "3":  # Telecel
                session['stage'] = USSDState.PACKAGE_SELECT
                session['network'] = NetworkEnum.TELECEL
                session['current_page'] = 1
                ussd_sessions[session_id] = session
                async for db in get_session():
                    # Changed to use session['network'] to match MTN logic
                    packages_menu = await get_packages_menu(session['network'], db, page=session['current_page'])
                    return UzoUSSDResponse(message=packages_menu, ussdServiceOp=2).model_dump()
            else:
                return UzoUSSDResponse(message="Invalid network. Select 1-3.", ussdServiceOp=2).model_dump()
        
        elif current_stage == USSDState.PACKAGE_SELECT:
            try:
                choice = int(user_input)
                
                # Handle pagination navigation
                if choice == 0:  # Next page
                    current_page = session.get('current_page', 1)
                    async for db in get_session():
                        repo = PackageRepository(db)
                        packages = await repo.get_all(session['network'])
                        total_pages = (len(packages) + 4) // 5  # 5 items per page
                        if current_page < total_pages:
                            session['current_page'] = current_page + 1
                            ussd_sessions[session_id] = session
                            packages_menu = await get_packages_menu(session['network'], db, page=session['current_page'])
                            return UzoUSSDResponse(message=packages_menu, ussdServiceOp=2).model_dump()
                        else:
                            return UzoUSSDResponse(message="Already on last page.", ussdServiceOp=2).model_dump()
                
                elif choice == 9:  # Previous page
                    current_page = session.get('current_page', 1)
                    if current_page > 1:
                        session['current_page'] = current_page - 1
                        ussd_sessions[session_id] = session
                        async for db in get_session():
                            packages_menu = await get_packages_menu(session['network'], db, page=session['current_page'])
                            return UzoUSSDResponse(message=packages_menu, ussdServiceOp=2).model_dump()
                    else:
                        return UzoUSSDResponse(message="Already on first page.", ussdServiceOp=2).model_dump()
                
                else:  # Package selection
                    package_idx = choice - 1
                    async for db in get_session():
                        packages = await get_packages_from_db(db, session['network'])
                        if 0 <= package_idx < len(packages):
                            package_name, price, profit_amount = packages[package_idx]
                            session['stage'] = USSDState.RECIPIENT_SELECT
                            session['package_idx'] = package_idx
                            session['package_name'] = package_name
                            session['package_amount'] = price
                            session['profit_amount'] = profit_amount
                            ussd_sessions[session_id] = session
                            return UzoUSSDResponse(message=recipient_choice_menu(), ussdServiceOp=2).model_dump()
                        else:
                            current_page = session.get('current_page', 1)
                            packages_menu = await get_packages_menu(session['network'], db, page=current_page)
                            return UzoUSSDResponse(message=f"Invalid package. Try again.\n\n{packages_menu}", ussdServiceOp=2).model_dump()
            except ValueError:
                async for db in get_session():
                    current_page = session.get('current_page', 1)
                    packages_menu = await get_packages_menu(session['network'], db, page=current_page)
                    return UzoUSSDResponse(message=f"Invalid input. Enter package number.\n\n{packages_menu}", ussdServiceOp=2).model_dump()
        
        elif current_stage == USSDState.RECIPIENT_SELECT:
            if user_input == "1":  # Buy for self
                session['stage'] = USSDState.CONFIRM
                session['recipient'] = msisdn
                ussd_sessions[session_id] = session
                confirm_text = confirm_menu(
                    session['package_name'], 
                    session['package_amount'], 
                    session['recipient']
                )
                return UzoUSSDResponse(message=confirm_text, ussdServiceOp=2).model_dump()
            elif user_input == "2":  # Buy for others
                session['stage'] = USSDState.ENTER_RECIPIENT
                ussd_sessions[session_id] = session
                return UzoUSSDResponse(message=enter_recipient_prompt(), ussdServiceOp=2).model_dump()
            else:
                return UzoUSSDResponse(message="Invalid option. Select 1 or 2.", ussdServiceOp=2).model_dump()
        
        elif current_stage == USSDState.ENTER_RECIPIENT:
            # Validate phone number (basic validation)
            if len(user_input) >= 10 and user_input.isdigit():
                session['stage'] = USSDState.CONFIRM
                session['recipient'] = user_input
                ussd_sessions[session_id] = session
                confirm_text = confirm_menu(
                    session['package_name'], 
                    session['package_amount'], 
                    session['recipient']
                )
                return UzoUSSDResponse(message=confirm_text, ussdServiceOp=2).model_dump()
            else:
                return UzoUSSDResponse(message="Invalid phone number. Try again:", ussdServiceOp=2).model_dump()
        
        elif current_stage == USSDState.CONFIRM:
            if user_input == "1":  # Confirm purchase
                session['stage'] = USSDState.PROCESSING
                ussd_sessions[session_id] = session
                
                # Process payment
                async for db in get_session():
                    try:
                        amount = Decimal(session['package_amount'])
                        uc = TransactionUseCases(db)
                        create_in = CreateTransactionIn(
                            session_id=session_id,
                            user_msisdn=msisdn,
                            network=session['network'].value,
                            package_name=session['package_name'],
                            amount=amount,
                            profit_amount=Decimal(session['profit_amount']) if session.get('profit_amount') else None,
                            recipient=session['recipient']
                        )
                        
                        tx = await uc.create_transaction(create_in)
                        logger.info(f"Transaction created: TX {tx.id}, Amount: {amount}, Recipient: {session['recipient']}")
                        
                        # Initiate payment with TheTeller in BACKGROUND
                        # This prevents USSD timeouts (TheTeller can take >30s)
                        try:
                            background_tasks.add_task(
                                process_payment_background,
                                tx.id, 
                                float(amount), 
                                session['recipient'], 
                                {"transaction_id": tx.id, "session_id": session_id}
                            )
                            logger.info(f"Payment initiation scheduled for TX {tx.id}")
                            
                            # Clean up session
                            cleanup_session(session_id)
                            
                            # Use the predefined final payment message
                            success_message = final_payment_message()
                            
                            return UzoUSSDResponse(message=success_message, ussdServiceOp=17).model_dump()
                            
                        except Exception as payment_error:
                            logger.error(f"Payment initiation failed: {payment_error}", exc_info=True)
                            # Clean up session
                            cleanup_session(session_id)
                            return UzoUSSDResponse(message="Payment request could not be sent. Please try again.", ussdServiceOp=17).model_dump()
                        
                    except Exception as e:
                        logger.error(f"Transaction creation or payment setup failed: {e}", exc_info=True)
                        # Clean up session
                        cleanup_session(session_id)
                        return UzoUSSDResponse(message="Unable to process your request. Please try again.", ussdServiceOp=17).model_dump()
            else:
                cleanup_session(session_id)
                return UzoUSSDResponse(message="Transaction cancelled.", ussdServiceOp=17).model_dump()
        
        # Default fallback
        return UzoUSSDResponse(message="Session expired. Please dial again.", ussdServiceOp=17).model_dump()
    except Exception as e:
        logger.error(f"USSD endpoint error: {e}", exc_info=True)
        return UzoUSSDResponse(message="Internal server error.", ussdServiceOp=17).model_dump()

async def process_payment_background(
    transaction_id: int, 
    amount: float, 
    recipient: str, 
    meta_data: dict
):
    """
    Process payment in the background using a fresh DB session.
    This prevents blocking the USSD response and avoids closed session errors.
    """
    from app.db.session import AsyncSessionLocal
    from app.services.payment_service import PaymentService
    import httpx
    
    logger.info(f"Starting background payment for TX {transaction_id}")
    
    # Create a NEW session for this background task
    async with AsyncSessionLocal() as db:
        try:
            payment_srv = PaymentService(db)
            payment_result = await payment_srv.start_payment(
                transaction_id, 
                amount, 
                recipient, 
                meta_data
            )
            logger.info(f"Background payment initiated successfully: {payment_result}")
        except httpx.ReadTimeout as e:
            error_msg = f"Background payment timed out for TX {transaction_id} after 900s. TheTeller did not respond."
            logger.warning(error_msg)
            logger.warning(f"Timeout exception details: {type(e).__name__}: {str(e)}")
            logger.warning(f"Transaction context - Amount: {amount}, Recipient: {recipient}")
            # Status is likely confusing now. Might want to query status later.
        except Exception as e:
            error_msg = f"Background payment failed for TX {transaction_id}: {type(e).__name__}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            logger.error(f"Transaction context - Amount: {amount}, Recipient: {recipient}, Metadata: {meta_data}")
            # You might want to update transaction status to FAILED here if start_payment doesn't do it

