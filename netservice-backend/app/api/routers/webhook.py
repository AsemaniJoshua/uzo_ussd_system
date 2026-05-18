# app/api/routers/webhook.py

import logging
from fastapi import APIRouter, Request, Header, Depends, HTTPException
from app.services.payment_service import PaymentService
from app.db.session import get_session
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, ValidationError

logger = logging.getLogger("webhook")
router = APIRouter()

class WebhookPayload(BaseModel):
    transaction_id: str | None = None
    status: str | None = None
    data: dict | None = None

@router.post("/webhook/theteller")
async def theteller_webhook(request: Request, x_signature: str | None = Header(None)):
    try:
        payload_dict = await request.json()
        print(f"--- INCOMING THETELLER WEBHOOK ---")
        print(f"Payload: {payload_dict}")
        print(f"----------------------------------")
        
        try:
            payload = WebhookPayload(**payload_dict)
        except ValidationError as ve:
            logger.warning(f"Invalid webhook payload: {ve}")
            print(f"Invalid webhook payload validation error: {ve}")
            raise HTTPException(status_code=400, detail="Invalid payload")
            
        async for db in get_session():
            svc = PaymentService(db)
            try:
                # Directly process the callback payload using handle_webhook
                # This is much faster and more reliable than making an external GET request back to TheTeller during the webhook callback
                logger.info(f"Processing webhook payload directly for transaction")
                await svc.handle_webhook(payload_dict)
            except Exception as e:
                logger.error(f"Webhook handling failed: {e}", exc_info=True)
                print(f"Webhook handling failed with exception: {e}")
                raise HTTPException(status_code=500, detail="Webhook handling failed")
        return {"status": True}
    except Exception as e:
        logger.error(f"Webhook endpoint error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
