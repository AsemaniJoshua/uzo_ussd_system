# app/services/ussd_service.py
from fastapi import Form
from typing import Tuple, Optional
import asyncio
from app.repositories.package_repo import PackageRepository
from app.schemas.package_schemas import NetworkEnum

async def generate_main_menu():
    return "Welcome to solos service. It takes between 1 hour to 48 hours to deliver\n\n1. Buy Data bundle\n2. Contact Support"

def contact_support_text():
    return "WhatsApp: 0505235329\nCall: 0505235329"

def select_network_menu():
    return "Select Network\n1. MTN\n2. AT\n3. Telecel"

async def get_packages_menu(network: NetworkEnum, db=None, page=1, page_size=5):
    """Display packages for any network with pagination"""
    network_str = network.value if hasattr(network, 'value') else str(network)
    text = f"{network_str} Data P{page}\n"
    
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
        text += f"{idx}.{pkg.package_name}-{pkg.amount}GHS\n"
    
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
    return "No data available"

def recipient_choice_menu():
    return "Enter recipient\n1. Buy For self\n2. Buy for others"

def enter_recipient_prompt():
    return "Enter recipient number (start with 0 if you will type local format):"

def confirm_menu(package_name: str, amount: str, recipient: str):
    return f"Confirm\nBundle: {package_name}\nAmount: GHS {amount}\nRecipient: {recipient}\n\nWait and approve MoMo prompt on your phone.\n\n1. Confirm"

def final_payment_message():
    return "Payment initiated! Approve the MoMo prompt. Bundle will be delivered within 1mins to 5mins.Dial *170# if payment prompt delays or fails to show."
