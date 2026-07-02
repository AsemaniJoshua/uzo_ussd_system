'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminLayout from '@/components/AdminLayout'
import { Mail, Trash2, Loader2, Calendar, User, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'

interface SupportInquiry {
  id: number
  name: string
  email: string
  message: string
  created_at: string
}

export default function SupportInquiriesPage() {
  const [inquiries, setInquiries] = useState<SupportInquiry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchInquiries()
  }, [])

  const fetchInquiries = async () => {
    try {
      setIsLoading(true)
      const data = await apiClient.support.list()
      setInquiries(data)
    } catch (error: any) {
      console.error('Failed to fetch support inquiries:', error)
      toast.error(error.response?.data?.detail || 'Failed to load support inquiries')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteInquiry = async (id: number) => {
    if (!confirm('Are you sure you want to delete this support inquiry?')) {
      return
    }

    try {
      await apiClient.support.delete(id)
      toast.success('Inquiry deleted successfully')
      fetchInquiries()
    } catch (error: any) {
      console.error('Failed to delete support inquiry:', error)
      toast.error(error.response?.data?.detail || 'Failed to delete inquiry')
    }
  }

  const filteredInquiries = inquiries.filter(
    (inq) =>
      inq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inq.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inq.message.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <Mail className="w-7 h-7 text-blue-600" />
                Support Inquiries
              </h1>
              <p className="text-gray-600">View and manage contact form submissions from the website</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
            <input
              type="text"
              placeholder="Search by name, email, or message..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow max-w-md px-4 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-gray-200">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              <p className="mt-4 text-gray-500 text-sm">Loading support inquiries...</p>
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-xl border border-gray-200">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No inquiries found</p>
              <p className="text-sm text-gray-400 mt-1">
                {searchTerm ? 'Try adjusting your search criteria.' : 'Form submissions will show up here.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filteredInquiries.map((inq) => (
                <div key={inq.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-150 pb-4 mb-4 gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold text-gray-900 text-base">{inq.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <a href={`mailto:${inq.email}`} className="text-blue-600 hover:underline">{inq.email}</a>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-400 flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-150">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(inq.created_at).toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleDeleteInquiry(inq.id)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                        title="Delete Inquiry"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line bg-gray-50/50 p-4 rounded-lg border border-gray-150/50">
                    {inq.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}
