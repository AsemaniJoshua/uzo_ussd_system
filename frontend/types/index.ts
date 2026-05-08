// API Types matching backend schemas

export type NetworkEnum = 'MTN' | 'AT' | 'TELECEL'
export type TransactionStatus = 'PENDING' | 'UNPAID' | 'PAID' | 'FAILED'
export type AdminRole = 'superadmin' | 'staff'

export interface Package {
  id: number
  network: NetworkEnum
  package_name: string
  amount: number
  active: number
}

export interface PackageCreate {
  network: NetworkEnum
  package_name: string
  amount: number
  active?: number
}

export interface PackageUpdate {
  package_name?: string
  amount?: number
  active?: number
}

export interface Transaction {
  id: number
  session_id?: string
  user_msisdn?: string
  network: string
  package_name: string
  amount: number
  recipient: string
  payment_method?: string
  payment_reference?: string
  status?: TransactionStatus
  created_at: string
  served_at?: string // For served_requests
  processed_by?: string // For served_requests
  transaction_id?: number // For served_requests
}

export interface CreateTransactionIn {
  session_id: string
  user_msisdn: string
  network: string
  package_id?: number
  package_name: string
  amount: number
  recipient: string
  payment_method?: string
}

export interface AdminUser {
  id: number
  username: string
  role: AdminRole
  created_at?: string
  updated_at?: string
}

export interface AdminCreate {
  username: string
  password: string
  role?: AdminRole
}

export interface Token {
  access_token: string
  token_type: string
  user?: {
    id: number
    username: string
    role: string
  }
}

export interface LoginCredentials {
  username: string
  password: string
}

// API Response types
export interface ApiResponse<T = any> {
  data?: T
  message?: string
  status?: boolean
}

export interface ApiError {
  detail: string | { msg: string }[]
  status_code?: number
}