'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { AdminUser, LoginCredentials, Token } from '@/types'
import { apiClient } from '@/lib/api'

interface AuthContextType {
  user: AdminUser | null
  token: string | null
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  isLoading: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing token on mount
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    if (storedToken) {
      setToken(storedToken)
    }
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (error) {
        console.error('Failed to parse stored user:', error)
        localStorage.removeItem('user')
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true)
      console.log('Attempting login with:', credentials)
      const tokenResponse: Token = await apiClient.auth.login(credentials)
      console.log('Token response received:', tokenResponse)
      const { access_token, user: userData } = tokenResponse
      
      if (!access_token) {
        console.error('access_token is missing from response')
        throw new Error('No access token received from server')
      }
      
      // Store token and user info
      localStorage.setItem('token', access_token)
      if (userData) {
        localStorage.setItem('user', JSON.stringify(userData))
        setUser(userData as AdminUser)
      }
      setToken(access_token)
      
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  const isAuthenticated = !!token

  const value = {
    user,
    token,
    login,
    logout,
    isLoading,
    isAuthenticated,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
