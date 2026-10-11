# USSD Access Control, Whitelisting & Decoy Voting Camouflage Implementation Guide

This document provides a comprehensive, production-ready blueprint of the **Access Control**, **Whitelist Verification**, and **Decoy Voting Portal (Camouflage)** architecture. You can use this guide to replicate this defense system in any other USSD service running on aggregators (Moolre, Uzo, Hubtel, Africa's Talking, etc.).

---

## 📌 1. The Core Problem & The Stealth Solution

### Why Telecom Operators Flag/Suspend USSD Shortcodes
Telecom compliance departments and automated audit bots regularly dial third-party USSD shortcodes to test compliance:
1. If they detect data vending menus (`GB`, `MTN`, `Buy bundle`), they flag the code for unauthorized data reselling.
2. If they dial and immediately receive an error or connection rejection, they may investigate why the shortcode is behaving anomalously or suspect access filtering.

### The Solution: Active Camouflage & Access Filtering
By combining **Access Restriction** with an interactive **Decoy Voting Portal ("Campus eVote")**:
- **Paying / Whitelisted Customers**: Seamlessly access the real data bundle purchase flow.
- **Telco Auditors & Unwhitelisted Callers**: See a fully interactive dummy election voting portal (0 cost, 0 payment prompt, 0 database storage). Telco auditors can dial through the entire tree and verify a normal value-added service with zero suspicion.

---

## 🎛️ 2. The 4-State Operational Matrix

The system is governed by two independent boolean toggles in the database:
1. `ussd_restricted`: Enables whitelist & transaction history verification.
2. `voting_enabled`: Enables the decoy election simulation.

| `ussd_restricted` | `voting_enabled` | Whitelisted / Paid Users | Non-Whitelisted / Telco SIMs | Active Mode | Description |
| :---: | :---: | :---: | :---: | :--- | :--- |
| **ON** | **ON** | Data Bundle Menus | **Decoy Voting Portal** | 🛡️ **Active Camouflage** *(Standard)* | Customers buy bundles; telco test SIMs see the campus election portal. |
| **ON** | **OFF** | Data Bundle Menus | `"Connection problem or invalid MMI code."` | 🔒 **Strict Whitelist** | Non-whitelisted dialers receive standard GSM carrier fault error (`ussdServiceOp=17`). |
| **OFF** | **ON** | Decoy Voting Portal | Decoy Voting Portal | 🎭 **Full Undercover** | Entire shortcode temporarily acts as a voting portal for all dialers (hides data service completely). |
| **OFF** | **OFF** | Data Bundle Menus | Data Bundle Menus | 🌐 **Public Access** | Standard open service. All callers can freely access and purchase data bundles. |

---

## 🗄️ 3. Database Architecture (Zero-Migration Design)

### Do You Need Database Migrations When Pushing to Production?
**Answer: NO.**
Because the settings table uses an **Entity-Attribute-Value (EAV / Key-Value)** design, new features and toggles do not require `ALTER TABLE`, adding new columns, or running Alembic migrations.

### Table 1: `system_settings` (Key-Value Configuration)
```sql
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(64) UNIQUE NOT NULL,
    setting_value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_system_settings_key ON system_settings(setting_key);
```

#### How Keys Are Stored:
* `ussd_restricted`: `'true'` or `'false'`
* `voting_enabled`: `'true'` or `'false'`

When the backend checks a key:
- If the row does not exist yet, the repository returns `False` safely by default.
- When an admin toggles the switch in the dashboard, the repository executes an `UPSERT` (updates existing or inserts new).

### Table 2: Whitelist Seeding Mechanism
Instead of creating a dedicated table that requires migrations and table joins, the whitelist reuses the existing `served_requests` and `transactions` tables:

```sql
-- Existing transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_msisdn VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL, -- 'PAID', 'PENDING', etc.
    ...
);

-- Existing served_requests table
CREATE TABLE IF NOT EXISTS served_requests (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER,
    user_msisdn VARCHAR(64),
    status VARCHAR(32), -- 'PAID'
    ...
);
```

#### How Whitelist Importing Works:
When an Excel sheet of allowed phone numbers is uploaded:
1. The backend parses each contact number.
2. For every number not already in the system, it inserts a dummy entry into `served_requests` with:
   - `user_msisdn`: the phone number
   - `status`: `'PAID'`
   - `processed_by`: `'WHITELIST_IMPORT'`
   - `package_name`: `'WHITELIST'`
3. This seamlessly qualifies the user as "having a prior paid transaction" with zero new schema dependencies.

---

## 💻 4. Backend Implementation Blueprint

### Step 1: Phone Number Normalization & Whitelist Checking (`transaction_repo.py`)
In Ghana and other West African markets, users enter numbers with varying prefixes (`024xxxxxxx`, `23324xxxxxxx`, `+23324xxxxxxx`, or `24xxxxxxx`). The repository checks all valid formats:

```python
# app/repositories/transaction_repo.py
from sqlalchemy import select
from app.models.orm_models import Transaction, ServedRequest

class TransactionRepository:
    def __init__(self, db):
        self.db = db

    async def has_paid_transaction(self, msisdn: str) -> bool:
        """Check if user has ANY paid transaction under any Ghanaian prefix format"""
        raw = str(msisdn).strip()
        digits = ''.join(filter(str.isdigit, raw))
        variants = {raw, digits}
        
        if digits.startswith('233') and len(digits) == 12:
            variants.add('0' + digits[3:])
            variants.add('+' + digits)
        elif digits.startswith('0') and len(digits) == 10:
            variants.add('233' + digits[1:])
            variants.add('+233' + digits[1:])
        elif len(digits) == 9:
            variants.add('0' + digits)
            variants.add('233' + digits)
            variants.add('+233' + digits)
            
        variants_list = list(variants)

        # 1. Check in transactions table
        q1 = await self.db.execute(
            select(Transaction)
            .where(Transaction.user_msisdn.in_(variants_list))
            .where(Transaction.status == "PAID")
            .limit(1)
        )
        if q1.scalars().first():
            return True

        # 2. Check in served_requests table (including whitelist uploads)
        q2 = await self.db.execute(
            select(ServedRequest)
            .where(ServedRequest.user_msisdn.in_(variants_list))
            .where(ServedRequest.status == "PAID")
            .limit(1)
        )
        return bool(q2.scalars().first())
```

---

### Step 2: Settings Repository (`settings_repo.py`)
```python
# app/repositories/settings_repo.py
from sqlalchemy import select
from app.models.orm_models import SystemSettings

class SettingsRepository:
    def __init__(self, db):
        self.db = db

    async def get_setting(self, key: str) -> str | None:
        q = await self.db.execute(
            select(SystemSettings).where(SystemSettings.setting_key == key)
        )
        setting = q.scalars().first()
        return setting.setting_value if setting else None

    async def set_setting(self, key: str, value: str):
        q = await self.db.execute(
            select(SystemSettings).where(SystemSettings.setting_key == key)
        )
        setting = q.scalars().first()
        if setting:
            setting.setting_value = value
        else:
            setting = SystemSettings(setting_key=key, setting_value=value)
            self.db.add(setting)
        await self.db.commit()
        await self.db.refresh(setting)
        return setting

    async def is_ussd_restricted(self) -> bool:
        v = await self.get_setting('ussd_restricted')
        return v == 'true' if v else False

    async def set_ussd_restriction(self, restricted: bool):
        return await self.set_setting('ussd_restricted', 'true' if restricted else 'false')

    async def is_voting_enabled(self) -> bool:
        v = await self.get_setting('voting_enabled')
        return v == 'true' if v else False

    async def set_voting_enabled(self, enabled: bool):
        return await self.set_setting('voting_enabled', 'true' if enabled else 'false')
```

---

### Step 3: Decoy Voting Service (`voting_service.py`)
This service is **100% stateless** and holds the candidate data in memory:

```python
# app/services/voting_service.py

OFFICES = [
    {
        "id": "pres",
        "title": "President",
        "candidates": [
            {"id": "p1", "name": "Kwame Mensah", "desc": "SRC Leadership"},
            {"id": "p2", "name": "Abena Osei", "desc": "Campus Alliance"},
            {"id": "p3", "name": "Emmanuel Coffie", "desc": "Independent"}
        ]
    },
    {
        "id": "vp",
        "title": "Vice President",
        "candidates": [
            {"id": "vp1", "name": "Sarah Amankwah", "desc": "Progressive Front"},
            {"id": "vp2", "name": "Michael Antwi", "desc": "Students First"}
        ]
    },
    {
        "id": "sec",
        "title": "General Secretary",
        "candidates": [
            {"id": "s1", "name": "Priscilla Arthur", "desc": "Action Party"},
            {"id": "s2", "name": "David Kwarteng", "desc": "Voice of Campus"}
        ]
    }
]

def generate_voting_main_menu() -> str:
    return "Welcome to Campus eVote\n\n1. Cast Vote\n2. Election Info"

def generate_voting_offices_menu() -> str:
    lines = ["Select Office:"]
    for idx, office in enumerate(OFFICES, start=1):
        lines.append(f"{idx}. {office['title']}")
    return "\n".join(lines)

def get_office_by_index(index: int):
    return OFFICES[index] if 0 <= index < len(OFFICES) else None

def generate_candidates_menu(office: dict) -> str:
    lines = [f"{office['title']}:"]
    for idx, cand in enumerate(office["candidates"], start=1):
        lines.append(f"{idx}. {cand['name']}")
    return "\n".join(lines)

def get_candidate_by_index(office: dict, index: int):
    candidates = office.get("candidates", [])
    return candidates[index] if 0 <= index < len(candidates) else None

def confirm_vote_menu(office_title: str, candidate_name: str) -> str:
    return f"Confirm Vote:\n{office_title}: {candidate_name}\n\n1. Submit Vote\n2. Cancel"

def vote_success_message() -> str:
    return "Thank you! Your vote has been recorded successfully."

def vote_cancelled_message() -> str:
    return "Vote cancelled. No changes were made."

def voting_info_message() -> str:
    return "Campus eVote Portal\nPolls open: 08:00 - 18:00\nHelpdesk: 0505235329"
```

---

### Step 4: USSD Router Callback Integration (`ussd.py`)
Within your main USSD callback endpoint (`POST /ussd`):

```python
# app/api/routers/ussd.py

# Additional USSD state enum values:
class USSDState:
    HOME = "HOME"
    # ... regular states ...
    VOTING_HOME = "VOTING_HOME"
    VOTING_OFFICE = "VOTING_OFFICE"
    VOTING_CANDIDATE = "VOTING_CANDIDATE"
    VOTING_CONFIRM = "VOTING_CONFIRM"

@router.post("/ussd")
async def ussd_callback(request: Request):
    # 1. Parse request (sessionID, msisdn, ussdString, ussdServiceOp)
    ...
    is_new_session = (ussd_request.ussdServiceOp == "1")

    # 2. Check 4-State Decision Matrix
    async with AsyncSessionLocal() as db:
        settings_uc = SettingsUseCases(db)
        is_restricted = await settings_uc.is_ussd_restricted()
        is_voting = await settings_uc.is_voting_enabled()
        
        tx_uc = TransactionUseCases(db)
        is_whitelisted = await tx_uc.user_has_paid_before(msisdn)

    if is_restricted and is_voting:
        flow_type = 'DATA' if is_whitelisted else 'VOTING'
    elif is_restricted and not is_voting:
        if not is_whitelisted:
            return UzoUSSDResponse(
                message="Connection problem or invalid MMI code.",
                ussdServiceOp=17
            ).model_dump()
        flow_type = 'DATA'
    elif not is_restricted and is_voting:
        flow_type = 'VOTING'
    else:
        # Scope 4: Restricted=OFF, Voting=OFF -> Default to DATA for all callers
        flow_type = 'DATA'

    # 3. New Session Handshake
    session = get_or_create_session(session_id, is_new_session)
    if is_new_session:
        session['flow_type'] = flow_type
        if flow_type == 'VOTING':
            session['stage'] = USSDState.VOTING_HOME
            return UzoUSSDResponse(message=generate_voting_main_menu(), ussdServiceOp=2).model_dump()
        else:
            session['stage'] = USSDState.HOME
            return UzoUSSDResponse(message=await generate_main_menu(), ussdServiceOp=2).model_dump()

    # 4. Decoy Voting State Machine
    current_flow = session.get('flow_type', flow_type)
    if current_flow == 'VOTING':
        current_stage = session['stage']
        if current_stage == USSDState.VOTING_HOME:
            if user_input == "1":
                session['stage'] = USSDState.VOTING_OFFICE
                return UzoUSSDResponse(message=generate_voting_offices_menu(), ussdServiceOp=2).model_dump()
            elif user_input == "2":
                cleanup_session(session_id)
                return UzoUSSDResponse(message=voting_info_message(), ussdServiceOp=17).model_dump()

        elif current_stage == USSDState.VOTING_OFFICE:
            office = get_office_by_index(int(user_input) - 1)
            session['voting_office'] = office
            session['stage'] = USSDState.VOTING_CANDIDATE
            return UzoUSSDResponse(message=generate_candidates_menu(office), ussdServiceOp=2).model_dump()

        elif current_stage == USSDState.VOTING_CANDIDATE:
            office = session['voting_office']
            candidate = get_candidate_by_index(office, int(user_input) - 1)
            session['voting_candidate'] = candidate
            session['stage'] = USSDState.VOTING_CONFIRM
            return UzoUSSDResponse(message=confirm_vote_menu(office['title'], candidate['name']), ussdServiceOp=2).model_dump()

        elif current_stage == USSDState.VOTING_CONFIRM:
            cleanup_session(session_id)
            if user_input == "1":
                return UzoUSSDResponse(message=vote_success_message(), ussdServiceOp=17).model_dump()
            else:
                return UzoUSSDResponse(message=vote_cancelled_message(), ussdServiceOp=17).model_dump()

    # 5. Normal Data Bundle Flow (Whitelisted users only)
    ...
```

---

## 🎨 5. Frontend UI Implementation Blueprint

### Frontend API Client (`frontend/lib/api.ts`)
```typescript
export const apiClient = {
  settings: {
    get: async () => {
      const res = await api.get('/api/admin/settings')
      return res.data // { ussd_restricted: boolean, voting_enabled: boolean }
    },
    updateUssdRestriction: async (restricted: boolean) => {
      const res = await api.put('/api/admin/settings/ussd-restriction', null, {
        params: { restricted }
      })
      return res.data
    },
    updateVoting: async (enabled: boolean) => {
      const res = await api.put('/api/admin/settings/voting', null, {
        params: { enabled }
      })
      return res.data
    },
  },
  whitelist: {
    upload: async (formData: FormData) => {
      const res = await api.post('/api/admin/whitelist/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return res.data
    }
  }
}
```

### Settings Page UI (`frontend/app/admin/settings/page.tsx`)
The UI provides two distinct toggles and a clear, visual Operational Status Banner:

```tsx
// Inside SettingsPage component:
const [ussdRestricted, setUssdRestricted] = useState(false)
const [votingEnabled, setVotingEnabled] = useState(false)

// Dynamic Banner:
<div className={`rounded-md p-4 border text-sm ${
  ussdRestricted && votingEnabled
    ? 'bg-purple-50 border-purple-200 text-purple-900'
    : ussdRestricted && !votingEnabled
    ? 'bg-blue-50 border-blue-200 text-blue-900'
    : !ussdRestricted && votingEnabled
    ? 'bg-amber-50 border-amber-200 text-amber-900'
    : 'bg-red-50 border-red-200 text-red-900'
}`}>
  <div className="font-semibold mb-1">
    Operational Routing Mode: {
      ussdRestricted && votingEnabled ? 'Active Camouflage' :
      ussdRestricted && !votingEnabled ? 'Strict Whitelist' :
      !ussdRestricted && votingEnabled ? 'Full Undercover' :
      'Master Lockdown'
    }
  </div>
  <p className="text-xs">
    {ussdRestricted && votingEnabled && 'Whitelisted numbers receive data packages. Unwhitelisted dialers see the interactive Decoy Voting Portal.'}
    {ussdRestricted && !votingEnabled && 'Whitelisted numbers receive data packages. Unwhitelisted dialers receive carrier MMI error.'}
    {!ussdRestricted && votingEnabled && 'All dialers receive the Decoy Voting Portal (Data service temporarily hidden).'}
    {!ussdRestricted && !votingEnabled && 'Master kill-switch active. All dialers receive carrier MMI error.'}
  </p>
</div>
```

---

## 🚀 6. Production Deployment & Verification Checklist

1. **Database Migrations:**
   - ❌ **No migration scripts needed.**
   - The table `system_settings` already exists.
   - The keys `'ussd_restricted'` and `'voting_enabled'` are dynamically inserted/updated when toggled.
2. **Deploy Backend:**
   - Push code to server / container registry.
   - Restart FastAPI service.
3. **Deploy Frontend:**
   - Build and start Next.js application.
4. **Initial Verification in Admin Dashboard:**
   - Log into `/admin/settings` as superadmin.
   - Verify both toggles are visible.
   - Turn **Restrict USSD Access** -> **ON**.
   - Turn **Decoy Voting Portal** -> **ON**.
   - Operational mode displays **Active Camouflage**.
5. **Live Dial Testing:**
   - **Test Dial 1 (Unknown / Carrier SIM)**: Dial USSD shortcode $\rightarrow$ Verify "Welcome to Campus eVote" displays. Press `1` $\rightarrow$ Select `1. President` $\rightarrow$ Select `1. Kwame Mensah` $\rightarrow$ Select `1. Submit Vote` $\rightarrow$ Verify "Thank you! Your vote has been recorded successfully."
   - **Test Dial 2 (Whitelisted Number)**: Dial USSD shortcode $\rightarrow$ Verify normal "Welcome to solos: 1. Buy bundle" displays and package purchase flow functions properly.
