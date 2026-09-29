# app/services/ussd_service.py
import re
from fastapi import Form
from typing import Tuple, Optional
import asyncio
from app.repositories.package_repo import PackageRepository
from app.schemas.package_schemas import NetworkEnum

def clean_package_name(name: str) -> str:
    """Removes 'GB', 'MB', 'Data', etc., to prevent telco tracking."""
    if not name:
        return ""
    cleaned = re.sub(r'(?i)\b(?:data|bundle)\b', '', str(name)).strip()
    cleaned = re.sub(r'(?i)(?<=\d)\s*(?:gb|mb)\b', '', cleaned).strip()
    cleaned = re.sub(r'(?i)\b(?:gb|mb)\b', '', cleaned).strip()
    return cleaned if cleaned else str(name)

async def generate_main_menu():
    return "Welcome to solos\n\n1. Buy bundle\n2. Contact Support"

def contact_support_text():
    return "WhatsApp: 0505235329\nCall: 0505235329"

def select_network_menu():
    return "Select Network\n1. MNT\n2. AT\n3. Telecel"

async def get_packages_menu(network: NetworkEnum, db=None, page=1, page_size=5):
    """Display packages for any network with pagination"""
    network_str = network.value if hasattr(network, 'value') else str(network)
    display_network = "MNT" if network_str == "MTN" else network_str
    text = f"{display_network} P{page}\n"
    
    close_db = False
    if db is None:
        from app.db.session import engine
        from sqlalchemy.ext.asyncio import AsyncSession
        db = AsyncSession(engine)
        close_db = True
    
    repo = PackageRepository(db)
    packages = await repo.get_all(network)
    
    if not packages:
        if close_db:
            await db.close()
        return f"No {network_str} packages available."
    
    # Calculate pagination
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_packages = packages[start_idx:end_idx]
    total_pages = (len(packages) + page_size - 1) // page_size
    
    # Display packages for current page
    for idx, pkg in enumerate(page_packages, start=start_idx + 1):
        clean_name = clean_package_name(pkg.package_name)
        text += f"{idx}. {clean_name} at {pkg.amount}GHS\n"
    
    # Add navigation options
    nav = ""
    if page < total_pages:
        nav += f"0.Next "
    if page > 1:
        nav += f"9.Back "
    if nav:
        text += nav.strip()
    
    if close_db:
        await db.close()
    return text.strip()

def no_data_menu():
    return "No packages available"

def recipient_choice_menu():
    return "Select Account\n1. My Number\n2. Other Number"

def enter_recipient_prompt():
    return "Enter mobile number:"

def confirm_menu(package_name: str, amount: str, recipient: str):
    clean_name = clean_package_name(package_name)
    return f"Confirm\n{clean_name} at GHS {amount}\nNumber: {recipient}\n\nApprove prompt on your phone.\n\n1. Confirm"

def final_payment_message():
    return "Payment initiated! Approve prompt on your phone. Order will be delivered within 1 to 5 mins. Dial *170# if prompt delays or fails to show."
