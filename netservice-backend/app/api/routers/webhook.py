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
        try:
            payload = WebhookPayload(**payload_dict)
        except ValidationError as ve:
            logger.warning(f"Invalid webhook payload: {ve}")
            raise HTTPException(status_code=400, detail="Invalid payload")
        tx_id = payload.transaction_id or (payload.data or {}).get("transaction_id")
        async for db in get_session():
            svc = PaymentService(db)
            try:
                if tx_id:
                    logger.info(f"Received webhook for transaction_id={tx_id}")
                    await svc.verify_and_update_payment(tx_id)
                else:
                    logger.info("Received webhook with no transaction_id, using fallback handler.")
                    await svc.handle_webhook(payload_dict)
            except Exception as e:
                logger.error(f"Webhook handling failed: {e}", exc_info=True)
                raise HTTPException(status_code=500, detail="Webhook handling failed")
        return {"status": True}
    except Exception as e:
        logger.error(f"Webhook endpoint error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
