# app/clients/theteller_client.py

import base64
import httpx
import random
from app.core.config import settings

BASE = settings.THETELLER_BASE_URL.rstrip('/')

def _theteller_auth_header():
    # TheTeller docs: Authorization: Basic base64_encode('your API username:your API Key')
    api_username = settings.THETELLER_API_USERNAME
    api_key = settings.THETELLER_API_KEY
    
    if not api_username or not api_key:
        raise ValueError("THETELLER_API_USERNAME and THETELLER_API_KEY must be set")
    
    b64 = base64.b64encode(f"{api_username}:{api_key}".encode()).decode()
    return f"Basic {b64}"

def _format_amount(amount: float) -> str:
    # TheTeller expects amount as 12-digit string, last 2 digits are cents
    # e.g. "000000000100" for 1.00 GHS, "000000002000" for 20.00 GHS
    amount_in_pesewas = int(float(amount) * 100)
    return str(amount_in_pesewas).zfill(12)

def _format_tx_id(tx_id: str|int) -> str:
    # TheTeller expects 12-digit transaction_id
    return str(tx_id).zfill(12)

def _map_network_to_switch(network: str) -> str:
    """Map network enum to TheTeller r-switch values"""
    # Based on TheTeller API docs for mobile money r-switch values
    mapping = {
        "MTN": "MTN",      # MTN Mobile Money
        "AT": "ATL",       # Airtel Money  
        "TELECEL": "VDF",  # Vodafone Cash (now Telecel)
        "AIRTEL": "ATL",   # Airtel Money
        "VODAFONE": "VDF", # Vodafone Cash
        "TIGO": "TGO",     # Tigo Cash
        "ZEEPAY": "ZPY",   # Zeepay
        "GMONEY": "GMY"    # G-Money
    }
    return mapping.get(network.upper(), "MTN")  # Default to MTN

async def initiate_mobile_money(amount_ghs: float, phone: str, tx_id: str, desc: str, network: str = "MTN"):
    """
    Initiate a mobile money payment with TheTeller API.
    Following the exact format from TheTeller API documentation.
    """
    # --- OLD SYNC ENDPOINT LOGIC (commented for easy revert) ---
    # url = f"{BASE}/v1.1/transaction/process"
    # headers = {
    #     "Authorization": _theteller_auth_header(),
    #     "Content-Type": "application/json",
    #     "Cache-Control": "no-cache"
    # }
    # payload = {
    #     "amount": _format_amount(amount_ghs),
    #     "processing_code": "000200",
    #     "transaction_id": _format_tx_id(tx_id),
    #     "desc": desc,
    #     "merchant_id": settings.THETELLER_MERCHANT_ID,
    #     "subscriber_number": phone,
    #     "r-switch": r_switch,
    #     # "callback_url": settings.THETELLER_CALLBACK_URL if hasattr(settings, "THETELLER_CALLBACK_URL") else ""
    # }

    # --- NEW ASYNC ENDPOINT LOGIC (TheTeller V2) ---
    url = f"{BASE}/process/transaction/async"

    # Generate numeric request-id (12-19 digits)
    request_id = str(random.randint(10**11, 10**19 - 1))

    headers = {
        "Authorization": _theteller_auth_header(),
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "request-id": request_id
    }

    r_switch = _map_network_to_switch(network)

    # Format phone number (ensure it starts with country code)
    if phone.startswith('0'):
        phone = '233' + phone[1:]
    elif not phone.startswith('233'):
        phone = '233' + phone

    payload = {
        "merchant_id": settings.THETELLER_MERCHANT_ID,
        "r-switch": r_switch,
        "amount": str(float(amount_ghs)),  # decimal string, not padded
        # "amount": _format_amount(amount_ghs), # Padded to 12 zeros (in pesewas)
        "processing_code": "000200",
        "transaction_id": str(tx_id),
        "callback_url": getattr(settings, "THETELLER_CALLBACK_URL", ""),
        "desc": desc,
        "reference": desc,  # or product name if available
        "subscriber_number": phone,
        "merchant_data": ""  # Fill with any merchant data if needed
    }
    try:
        # Increase timeout to 1200 seconds for TheTeller API (MoMo can be slow)
        async with httpx.AsyncClient(timeout=1500.0) as client:
            print(f"TheTeller Request URL: {url}")
            print(f"TheTeller Headers: {headers}")
            print(f"TheTeller Payload: {payload}")

            r = await client.post(url, json=payload, headers=headers)

            print(f"TheTeller Response Status: {r.status_code}")
            print(f"TheTeller Response Body: {r.text}")

            if r.status_code != 200:
                raise Exception(f"TheTeller API error: {r.status_code} - {r.text}")

            return r.json()
    except httpx.HTTPError as e:
        error_msg = f"HTTP Error calling TheTeller: {type(e).__name__}: {str(e)}"
        print(error_msg)
        print(f"Request details - URL: {url}, Payload: {payload}, Phone: {phone}")
        raise Exception(error_msg) from e
    except Exception as e:
        error_msg = f"Error calling TheTeller API: {type(e).__name__}: {str(e)}"
        print(error_msg)
        print(f"Request details - URL: {url}, Payload: {payload}, Phone: {phone}")
        raise Exception(error_msg) from e

async def verify_payment(transaction_id: str):
    """
    Check payment status by transaction ID.
    According to TheTeller docs: GET /v1.1/users/transactions/{transaction_id}/status
    """
    url = f"{BASE}/v1.1/users/transactions/{_format_tx_id(transaction_id)}/status"
    headers = {
        "Authorization": _theteller_auth_header(),
        "Content-Type": "application/json",
        "Merchant-Id": settings.THETELLER_MERCHANT_ID,
        "Cache-Control": "no-cache"
    }
    
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, headers=headers)
        r.raise_for_status()
        return r.json()


async def initiate_checkout_payment(amount_ghs: float, tx_id: str | int, desc: str, redirect_url: str, email: str):
    """
    Initiate a web checkout session with TheTeller standard checkout.
    """
    if settings.THETELLER_BASE_URL and "test" in settings.THETELLER_BASE_URL.lower():
        checkout_base = "https://checkout-test.theteller.net"
    else:
        checkout_base = "https://checkout.theteller.net"
        
    url = f"{checkout_base}/initiate"
    
    headers = {
        "Authorization": _theteller_auth_header(),
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
    }
    
    payload = {
        "merchant_id": settings.THETELLER_MERCHANT_ID,
        "transaction_id": _format_tx_id(tx_id),
        "desc": desc,
        "amount": _format_amount(amount_ghs),
        "redirect_url": redirect_url,
        "email": email
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            print(f"TheTeller Checkout Request URL: {url}")
            print(f"TheTeller Checkout Payload: {payload}")
            
            r = await client.post(url, json=payload, headers=headers)
            
            print(f"TheTeller Checkout Response Status: {r.status_code}")
            print(f"TheTeller Checkout Response Body: {r.text}")
            
            if r.status_code != 200:
                raise Exception(f"TheTeller Checkout API error: {r.status_code} - {r.text}")
                
            return r.json()
    except httpx.HTTPError as e:
        error_msg = f"HTTP Error calling TheTeller Checkout: {type(e).__name__}: {str(e)}"
        print(error_msg)
        raise Exception(error_msg) from e
    except Exception as e:
        error_msg = f"Error calling TheTeller Checkout API: {type(e).__name__}: {str(e)}"
        print(error_msg)
        raise Exception(error_msg) from e

