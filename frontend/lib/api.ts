import axios, { AxiosResponse } from 'axios'
import { Package, PackageCreate, PackageUpdate, Transaction, AdminUser, AdminCreate, Token, LoginCredentials, NetworkEnum } from '@/types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api2.netservicedata.site'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/admin/login'
    }
    return Promise.reject(error)
  }
)

export const apiClient = {
  // Authentication
  auth: {
    login: async (credentials: LoginCredentials): Promise<Token> => {
      const params = new URLSearchParams()
      params.append('username', credentials.username)
      params.append('password', credentials.password)
      const response = await api.post('/api/admin/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
      console.log('Login response:', response.status, response.data)
      if (!response.data.access_token) {
        console.error('No access_token in response:', response.data)
        throw new Error('No access token in response')
      }
      return response.data
    },
    createAdmin: async (data: AdminCreate): Promise<AdminUser> => {
      const response = await api.post('/api/admin/create', data)
      return response.data
    },
    updatePassword: async (data: { current_password: string; new_password: string }): Promise<any> => {
      const response = await api.put('/api/admin/update-password', data)
      return response.data
    },
  },

  // Packages
  packages: {
    list: async (network?: NetworkEnum): Promise<Package[]> => {
      const params = network ? { network } : {}
      const response = await api.get('/api/packages/', { params })
      return response.data
    },
    get: async (id: number): Promise<Package> => {
      const response = await api.get(`/api/packages/${id}/`)
      return response.data
    },
    create: async (data: PackageCreate): Promise<Package> => {
      const response = await api.post('/api/packages/', data)
      return response.data
    },
    update: async (id: number, data: PackageUpdate): Promise<Package> => {
      const response = await api.put(`/api/packages/${id}/`, data)
      return response.data
    },
    delete: async (id: number): Promise<void> => {
      await api.delete(`/api/packages/${id}/`)
    },
  },

  // Transactions
  transactions: {
    list: async (skip: number = 0, limit: number = 100): Promise<Transaction[]> => {
      const response = await api.get('/api/admin/requests/', {
        params: { skip, limit },
      })
      return response.data
    },
    serve: async (id: number): Promise<any> => {
      const response = await api.post(`/api/admin/requests/${id}/serve/`)
      return response.data
    },
    listServed: async (skip: number = 0, limit: number = 100): Promise<any[]> => {
      const response = await api.get('/api/admin/served/', {
        params: { skip, limit },
      })
      return response.data
    },
    unserve: async (id: number): Promise<Transaction> => {
      const response = await api.post(`/api/admin/served/${id}/unserve/`)
      return response.data
    },
    deleteServed: async (id: number): Promise<any> => {
      const response = await api.delete(`/api/admin/served/${id}/`)
      return response.data
    },
  },

  // Admin Management
  admins: {
    list: async (skip: number = 0, limit: number = 100): Promise<any[]> => {
      const response = await api.get('/api/admin/admins/', {
        params: { skip, limit },
      })
      return response.data
    },
    create: async (data: { username: string; password: string; role?: string }): Promise<any> => {
      const response = await api.post('/api/admin/create/', data)
      return response.data
    },
    delete: async (username: string): Promise<any> => {
      const response = await api.delete(`/api/admin/admins/${username}/`)
      return response.data
    },
  },

  // Settings
  settings: {
    get: async (): Promise<any> => {
      const response = await api.get('/api/admin/settings/')
      return response.data
    },
    updateUssdRestriction: async (restricted: boolean): Promise<any> => {
      const response = await api.put('/api/admin/settings/ussd-restriction/', null, {
        params: { restricted }
      })
      return response.data
    },
  },

  // USSD Simulation (for testing)
  ussd: {
    simulate: async (sessionId: string, msisdn: string, input: string): Promise<string> => {
      const response = await api.post('/ussd/simulator', null, {
        params: {
          session_id: sessionId,
          msisdn: msisdn,
          user_input: input
        }
      })
      return response.data
    },
  },

  // Whitelist
  whitelist: {
    upload: async (formData: FormData): Promise<any> => {
      const response = await api.post('/api/admin/whitelist/upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data
    },
  },
}

export default apiClient
