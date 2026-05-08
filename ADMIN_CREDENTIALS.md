# NetService USSD Admin Credentials

## Default Admin Account

**Login URL:** http://localhost:3000/admin/login  
**Frontend URL:** http://localhost:3000  
**Backend API:** http://localhost:8000  

### Admin Credentials:
- **Username:** `admin`
- **Password:** `admin`
- **Role:** superadmin

## How to Use:

### 1. Start the Backend Server:
```bash
cd netservice-backend
source .venv/Scripts/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Create Admin User (if not exists):
```bash
cd netservice-backend
source .venv/Scripts/activate
python create_admin.py
```

### 3. Start the Frontend Server:
```bash
cd frontend
npm run dev
```

### 4. Access Admin Dashboard:
1. Go to http://localhost:3000/admin/login
2. Enter the credentials above
3. You'll be redirected to the admin dashboard

## Features Available:

### Admin Dashboard:
- View all transactions
- Manage data packages (create, edit, delete)
- Monitor system performance
- User management

### Package Management:
- Add new data packages for MTN, AT, TELECEL
- Edit existing packages
- Activate/deactivate packages
- Set pricing

### Transaction Management:
- View all USSD transactions
- Track payment status
- Monitor user activity
- Export transaction data

## Security Notes:
⚠️ **Important:** Change the default password after first login for security!

## Troubleshooting:
- If login fails, ensure backend server is running on port 8000
- If admin doesn't exist, run the `create_admin.py` script
- Check browser console for API connection errors