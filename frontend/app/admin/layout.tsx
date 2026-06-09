'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Don't apply auth checks to the login page itself
  const isLoginPage = pathname === '/admin/login'
  
  const allowedForStaff = ['/admin/dashboard', '/admin/products', '/admin/transactions']

  useEffect(() => {
    if (!isLoginPage && !isLoading && !isAuthenticated) {
      router.push('/admin/login')
    } else if (isAuthenticated && user?.role === 'staff' && !isLoginPage) {
      const isAllowed = allowedForStaff.some(route => pathname === route || pathname.startsWith(route + '/'))
      if (!isAllowed) {
        router.push('/admin/dashboard')
      }
    }
  }, [isAuthenticated, isLoading, router, isLoginPage, pathname, user?.role])

  // Don't show loading spinner on login page
  if (!isLoginPage && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Allow login page to render without auth check
  if (isLoginPage) {
    return <>{children}</>
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
