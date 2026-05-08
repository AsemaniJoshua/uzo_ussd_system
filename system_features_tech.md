# System Documentation: USSD Data Bundle System

This document provides a comprehensive overview of the features and technologies implemented in the Uzo USSD System.

## 🚀 Core Technologies

### Backend (API & Business Logic)
- **Framework**: FastAPI (Python 3.11+)
- **Asynchronous Engine**: Uvicorn
- **Database**: MySQL (Relational Database)
- **ORM**: SQLAlchemy (Async support with `aiomysql`)
- **Migrations**: Alembic (Database version control)
- **Authentication**: JWT (JSON Web Tokens) using `python-jose` and `passlib` (bcrypt)
- **Validation**: Pydantic V2
- **Data Processing**: Pandas & OpenPyXL (for Excel whitelist imports)
- **HTTP Client**: `httpx` (for external API calls)

### Frontend (Admin Dashboard)
- **Framework**: Next.js 16 (React 19, TypeScript)
- **State Management**: React Hooks & Context API
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **API Communication**: Axios
- **Notifications**: React Hot Toast

### External Integrations
- **USSD Gateway**: **Uzo** (Standardized JSON interface for USSD traffic)
- **Payment Gateway**: **TheTeller** (Mobile Money automated collection)
- **Database Hosting**: Compatible with **Aiven MySQL** and **Namecheap Shared/VPS MySQL**

---

## 🛠️ Key Features

### 1. USSD Interface (Customer Facing)
- **Interactive Menu Flow**: State-machine driven USSD navigation.
- **Multi-Network Support**: Dynamic handling for **MTN**, **Telecel**, and **AT (AirtelTigo)** using MNC codes.
- **Dynamic Packages**: All data bundles are fetched directly from the database in real-time.
- **Smart Pagination**: Automatically splits large package lists into multiple pages (Next/Back navigation).
- **Recipient Choice**: Option to buy for "Self" (auto-detected MSISDN) or "Others" (manual entry).
- **Automated Payments**: Triggers Mobile Money (MoMo) prompts on the user's phone via TheTeller.

### 2. Admin Dashboard (Internal Management)
- **Real-time Statistics**: High-level overview of total transactions, payments, and system health.
- **Transaction Management**:
    - **Pending Requests**: View incoming unpaid/pending transactions.
    - **Served Requests**: Track which data bundles have been manually fulfilled.
    - **Manual Fulfillment Pattern**: Allows staff to mark transactions as "Served" after transferring data bundles to the customer.
- **Package Management (CRUD)**: Full control to create, update, deactivate, or delete data packages per network.
- **Whitelist Management**: 
    - **Bulk Import**: Support for uploading Excel files (`.xlsx`) to whitelist users.
    - **Duplicate Removal**: Scripts to clean up redundant whitelist entries.

### 3. System & Security
- **Background Task Processing**: Payment requests are processed in the background to prevent USSD session timeouts.
- **Role-Based Access**: Support for `Superadmin` and `Staff` roles.
- **USSD Access Control**: Built-in toggle to restrict USSD access only to users with previous paid history (currently optional).
- **USSD Simulator**: Built-in testing tool in the admin panel to test USSD flows without a real phone.
- **SSH Tunneling**: Pre-configured `entrypoint.sh` logic to securely connect to remote databases (e.g., Namecheap) behind firewalls.
- **Dockerized Environment**: Fully containerized for easy deployment via Docker Compose.

---

## 🏗️ Infrastructure & DevOps
- **Deployment**: Configured for **Render**, **VPS**, or local **Docker** environments.
- **SSL Support**: Ready for Nginx reverse proxy with Let's Encrypt.
- **Environment Management**: Secure configuration via `.env` files for all API keys, database URLs, and secrets.
