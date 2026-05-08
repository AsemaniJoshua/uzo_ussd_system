'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'superadmin' | 'staff'
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, user, isLoading } = useAuth()
  const router = useRouter()
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false)

  useEffect(() => {
    setHasCheckedAuth(true)
  }, [])

  useEffect(() => {
    if (hasCheckedAuth && !isLoading) {
      if (!isAuthenticated) {
        router.replace('/admin/login')
        return
      }

      if (requiredRole && user?.role !== requiredRole && user?.role !== 'superadmin') {
        router.replace('/admin/unauthorized')
        return
      }
    }
  }, [isAuthenticated, isLoading, user, router, requiredRole, hasCheckedAuth])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (requiredRole && user?.role !== requiredRole && user?.role !== 'superadmin') {
    return null
  }

  return <>{children}</>
}

export default ProtectedRoute