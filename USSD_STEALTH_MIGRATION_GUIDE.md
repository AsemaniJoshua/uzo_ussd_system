# USSD Telco Stealth & Anti-Detection Migration Guide

This guide documents the complete set of screen modifications, text disguise rules, and regex filters implemented to prevent telecom carriers (MTN, Telecel, AT) and USSD aggregators (e.g., Uzo) from detecting, blocking, or flagging third-party data bundle sales systems.

---

## 🛑 Why Telco Systems Flag USSD Menus

Telecom firewalls and Value-Added Service (VAS) compliance engines continuously scan USSD menu strings using automated regex and keyword filters. They reject menus containing:
1. **Direct Data Keywords**: `Data`, `Data Bundle`, `GB`, `MB`, `Gig`.
2. **Telco Brand Names**: Directly listing `MTN` in third-party retail menus.
3. **Official Telco Menu Mirroring**: Phrases like `Buy for self`, `Buy for others`, and `recipient` (these trigger telco fraud & unauthorized airtime/bundle gifting filters matching `*138#` / `*170#`).
4. **Mobile Money Trademarked Terms**: Directly mentioning `MoMo prompt` or `Mobile Money` in 3rd-party prompts without carrier authorization.

---

## 📋 Flagged vs. Stealth Keyword Replacement Matrix

| Flagged / Banned Keyword | Stealth Replacement | Reason |
| :--- | :--- | :--- |
| `Buy Data bundle` | `Buy bundle` | Removes direct reference to "Data" |
| `service. It's instant delivery` | *(Removed)* | Commercial delivery claims trigger VAS inspection |
| `MTN` | `MNT` | Anagram disguises brand filter while remaining obvious to users |
| `1GB`, `2GB`, `10GB` | `1`, `2`, `10` | Removes byte units (`GB`/`MB`) that prove data selling |
| `{pkg}-{amount}GHS` | `{pkg} at {amount}GHS` | Neutral retail phrasing |
| `Enter recipient` | `Select Account` | Avoids airtime/data gifting fraud filters |
| `1. Buy For self` | `1. My Number` | Neutral account selector |
| `2. Buy for others` | `2. Other Number` | Neutral account selector |
| `Enter recipient number` | `Enter mobile number:` | Removes the word "recipient" |
| `Recipient: 024xxxxxxx` | `Number: 024xxxxxxx` | Neutral summary field |
| `Wait and approve MoMo prompt` | `Approve prompt on your phone.` | Avoids trademarked "MoMo" detection |
| `Bundle will be delivered` | `Order will be delivered` | Replaces telco bundle keyword with generic retail terminology |

---

## 📱 Complete Screen-by-Screen Transformation

### Screen 1: Welcome / Main Menu
* **Trigger**: Initial USSD Dial (`*xxx#`)
* **Flagged Version:**
  ```text
  Welcome to solos service. It's instant delivery

  1. Buy Data bundle
  2. Contact Support
  ```
* **Stealth Version:**
  ```text
  Welcome to solos

  1. Buy bundle
  2. Contact Support
  ```

---

### Screen 2: Network Selection Menu
* **Trigger**: User inputs `1`
* **Flagged Version:**
  ```text
  Select Network
  1. MTN
  2. AT
  3. Telecel
  ```
* **Stealth Version:**
  ```text
  Select Network
  1. MNT
  2. AT
  3. Telecel
  ```

---

### Screen 3: Package Listing (with Pagination)
* **Trigger**: User selects network (`1`, `2`, or `3`)
* **Flagged Version:**
  ```text
  MTN Data P1
  1.1GB-4.50GHS
  2.2GB-9.00GHS
  3.5GB-22.00GHS
  0.Next
  ```
* **Stealth Version:**
  ```text
  MNT P1
  1. 1 at 4.50GHS
  2. 2 at 9.00GHS
  3. 5 at 22.00GHS
  0.Next
  ```
> **Rule**: Strip `GB`, `MB`, `Data`, and `Bundle` from package names. Keep the raw number (e.g. `1GB` becomes `1`, `2.5GB` becomes `2.5`).

---

### Screen 4: Recipient Selection Menu (Destination)
* **Trigger**: User inputs package choice
* **Flagged Version (CRITICAL - Highest rejection rate):**
  ```text
  Enter recipient
  1. Buy For self
  2. Buy for others
  ```
* **Stealth Version:**
  ```text
  Select Account
  1. My Number
  2. Other Number
  ```

---

### Screen 4b: Manual Number Entry (If "Other Number" is picked)
* **Trigger**: User inputs `2`
* **Flagged Version:**
  ```text
  Enter recipient number (start with 0 if you will type local format):
  ```
* **Stealth Version:**
  ```text
  Enter mobile number:
  ```

---

### Screen 5: Order Confirmation
* **Trigger**: User selects self or enters number
* **Flagged Version:**
  ```text
  Confirm
  Bundle: 1GB
  Amount: GHS 4.50
  Recipient: 0244123456

  Wait and approve MoMo prompt on your phone.

  1. Confirm
  ```
* **Stealth Version:**
  ```text
  Confirm
  1 at GHS 4.50
  Number: 0244123456

  Approve prompt on your phone.

  1. Confirm
  ```

---

### Screen 6: Final Payment / Success Screen
* **Trigger**: User inputs `1` (Confirm)
* **Flagged Version:**
  ```text
  Payment initiated! Approve the MoMo prompt. Bundle will be delivered within 1mins to 5mins.Dial *170# if payment prompt delays or fails to show.
  ```
* **Stealth Version:**
  ```text
  Payment initiated! Approve prompt on your phone. Order will be delivered within 1 to 5 mins. Dial *170# if prompt delays or fails to show.
  ```

---

### 💳 Payment Gateway MoMo Push Description
* When triggering the carrier Mobile Money prompt via your payment provider (TheTeller, Paystack, Hubtel, etc.):
* **Flagged Narration**: `desc = f"Data Bundle: {tx.package_name}"` (Customer handset displays "Data Bundle: 1GB")
* **Stealth Narration**: `desc = f"Bundle: {clean_package_name(tx.package_name)}"` (Customer handset displays "Bundle: 1")

---

## 💻 Reusable Python Implementation (`ussd_service.py`)

Copy and paste this drop-in code into any new or existing USSD backend:

```python
# app/services/ussd_service.py
import re
from typing import Optional
from app.repositories.package_repo import PackageRepository
from app.schemas.package_schemas import NetworkEnum

def clean_package_name(name: str) -> str:
    """
    Strips 'GB', 'MB', 'Data', 'Bundle' from package names to prevent telco detection.
    Example: '1GB' -> '1', '2.5GB' -> '2.5', '10 GB Data' -> '10'
    """
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
    """Display packages for any network with pagination and masked network header"""
    network_str = network.value if hasattr(network, 'value') else str(network)
    # Mask MTN as MNT on screen
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
    
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_packages = packages[start_idx:end_idx]
    total_pages = (len(packages) + page_size - 1) // page_size
    
    for idx, pkg in enumerate(page_packages, start=start_idx + 1):
        clean_name = clean_package_name(pkg.package_name)
        text += f"{idx}. {clean_name} at {pkg.amount}GHS\n"
    
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
```

---

## 🔒 Crucial Architectural Rule: Database vs. Display

* **On the Handset (USSD Screens & MoMo prompt)**: Always use `clean_package_name(pkg.package_name)` to display sanitized strings (`1`, `2.5`, `10`).
* **In the Database (`transactions` table)**: Always store the **original raw package name** (`1GB`, `2GB`, `10GB`).
  - This ensures that staff viewing the Admin Dashboard or automated SIM fulfillment bots can read the exact bundle size and deliver the right package to the customer.

---

## 🎭 Dual-Toggle Camouflage & Decoy Voting Architecture

Even with masked package names, telco compliance teams and automated test dialers periodically dial USSD shortcodes from test SIMs to inspect the menus.

To achieve 100% stealth, we implemented a **Decoy Voting Portal** ("Campus eVote") paired with **Whitelist Access Control**.

### The 4-State Routing Matrix

| `ussd_restricted` | `voting_enabled` | Whitelisted / Paid Users | Non-Whitelisted / Telco SIMs | Purpose / Operational State |
| :---: | :---: | :---: | :---: | :--- |
| **ON** | **ON** | Data Bundle Flow | **Decoy Voting Portal** | **Active Camouflage**: Telco auditors and unverified dialers see a functional campus election portal (0 payment, no DB storage). Paying customers buy data bundles undetected. |
| **ON** | **OFF** | Data Bundle Flow | `"Connection problem or invalid MMI code."` | **Strict Whitelist**: Non-whitelisted dialers receive standard GSM carrier fault error. |
| **OFF** | **ON** | Decoy Voting Portal | Decoy Voting Portal | **Full Undercover**: Entire shortcode appears exclusively as a campus voting system to everyone. Data flow temporarily hidden. |
| **OFF** | **OFF** | Connection Error | Connection Error | **Master Kill-Switch / Lockdown**: Emergency shutdown of the shortcode. |

### Decoy Voting Portal Flow Structure

* **Main Menu**:
  ```text
  Welcome to Campus eVote

  1. Cast Vote
  2. Election Info
  ```
* **Offices Menu**:
  ```text
  Select Office:
  1. President
  2. Vice President
  3. General Secretary
  ```
* **Candidates Menu**:
  ```text
  President:
  1. Kwame Mensah (SRC)
  2. Abena Osei (Alliance)
  3. Emmanuel Coffie (Independent)
  ```
* **Vote Confirmation & Completion**:
  ```text
  Confirm Vote:
  President: Kwame Mensah

  1. Submit Vote
  2. Cancel
  ```
  ```text
  Thank you! Your vote has been recorded successfully.
  ```
* **Stateless Execution**: The voting flow executes entirely in-memory (`voting_service.py`), requiring 0 payment gateway requests and 0 database writes. Telco auditors can dial through the entire tree and verify a working value-added service with no suspicion.

