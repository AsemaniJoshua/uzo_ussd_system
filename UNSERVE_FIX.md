# Unserve Fix - Database Update Required

## Changes Made

### 1. Backend Code Updated ✅
- `ServedRequest` model now stores: `status`, `session_id`, `user_msisdn`
- `move_to_served()` preserves original transaction data
- `move_back_to_transaction()` restores transaction with original status (PAID, etc.)

### 2. Database Schema Update Required ⚠️

**You need to add 3 new columns to `served_requests` table:**

#### Option A: Using Alembic Migration (Recommended)
```bash
cd netservice-backend
alembic upgrade head
```

#### Option B: Run SQL Script Directly
Execute the SQL file: `netservice-backend/update_served_requests.sql`

Or run this SQL manually:
```sql
ALTER TABLE served_requests 
ADD COLUMN status VARCHAR(32) NULL,
ADD COLUMN session_id VARCHAR(128) NULL,
ADD COLUMN user_msisdn VARCHAR(64) NULL;

UPDATE served_requests 
SET status = 'PAID' 
WHERE status IS NULL;
```

### 3. How It Works Now

**When Serving a Transaction:**
1. Copy transaction to `served_requests` with ALL original data
2. Delete from `transactions` table
3. Status (PAID) is preserved in `served_requests`

**When Unserving:**
1. Find record in `served_requests` by ID
2. Create new transaction with ORIGINAL status (PAID)
3. Delete from `served_requests`
4. Transaction appears back with PAID status intact

**Result:** ✅ Unserving preserves payment status (PAID remains PAID)

## Testing After Update

1. **Restart backend** (if running locally)
2. **Test unserve:**
   - Go to Products page
   - Click "Unserve" on any served transaction
   - Should move back to Transactions page with PAID status
3. **Verify status preserved:**
   - Check that transaction still shows as PAID
   - Revenue should still be counted

## If Using Render.com

The database migration will run automatically on next deploy when you push to GitHub.
