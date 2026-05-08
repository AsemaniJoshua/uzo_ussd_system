# NetService USSD Frontend

A modern, production-ready Next.js frontend for the NetService USSD backend system. This application provides an admin dashboard for managing packages and transactions, a public interface for viewing packages, and an interactive USSD simulator.

## Features

### 🔐 Admin Dashboard
- **Authentication**: JWT-based secure login system
- **Package Management**: Full CRUD operations for data packages
- **Transaction Monitoring**: Real-time transaction tracking and management
- **Role-based Access**: Support for superadmin and staff roles
- **Responsive Design**: Mobile-first responsive interface

### 📱 USSD Simulator
- **Interactive Phone Interface**: Realistic mobile phone simulator
- **Complete USSD Flow**: Test the entire purchase process
- **Session Management**: Real-time session tracking
- **History Tracking**: View complete interaction history

### 🌐 Public Interface
- **Package Browsing**: View available packages by network
- **Network Filtering**: Filter packages by MTN, AT, or Telecel
- **Real-time Pricing**: Live pricing information
- **Responsive Design**: Works on all devices

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Form Handling**: React Hook Form
- **Notifications**: React Hot Toast
- **Icons**: Lucide React
- **Authentication**: JWT tokens

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- NetService USSD Backend running (see backend README)

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and configure:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_APP_NAME="NetService USSD"
   NEXT_PUBLIC_APP_VERSION="1.0.0"
   NEXT_PUBLIC_ENV=development
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to `http://localhost:3000`

## API Integration

The frontend connects to the NetService USSD backend through a comprehensive API client:

### Authentication Endpoints
- `POST /api/admin/token` - Admin login
- `POST /api/admin/create` - Create admin user

### Package Endpoints
- `GET /api/packages` - List packages
- `POST /api/packages` - Create package
- `PUT /api/packages/{id}` - Update package
- `DELETE /api/packages/{id}` - Delete package

### Transaction Endpoints
- `GET /api/admin/requests` - List transactions
- `POST /api/admin/requests/{id}/serve` - Serve transaction

### USSD Endpoint
- `POST /ussd` - USSD simulation

## Usage Guide

### Admin Dashboard

1. **Login**: Navigate to `/admin` and use your credentials
2. **Dashboard**: View overview statistics and recent transactions
3. **Packages**: Manage data packages for all networks
4. **Transactions**: Monitor and serve customer transactions

### USSD Simulator

1. **Access**: Go to `/simulator` or click "Try Simulator" on the home page
2. **Setup**: Configure phone number (MSISDN)
3. **Start**: Click "Start Session" to begin USSD flow
4. **Navigate**: Use the keypad to navigate through menu options
5. **Test**: Complete a full purchase flow

### Public Interface

1. **Browse**: Visit `/packages` to view available packages
2. **Filter**: Use network filters to view specific providers
3. **Details**: View package details and pricing

## Deployment

### Production Build

```bash
npm run build
npm run start
```

### Environment Variables

For production deployment:

```env
NEXT_PUBLIC_API_URL=https://your-api-domain.com
NEXT_PUBLIC_APP_NAME="NetService USSD"
NEXT_PUBLIC_APP_VERSION="1.0.0"
NEXT_PUBLIC_ENV=production
```
