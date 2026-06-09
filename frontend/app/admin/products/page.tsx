'use client'

import { useState, useEffect } from 'react'
import { Transaction } from '@/types'
import { apiClient } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminLayout from '@/components/AdminLayout'
import {
  CheckCircle,
  Eye,
  Package as PackageIcon,
  Filter,
  Search,
  Phone,
  Calendar,
  RotateCcw,
  Trash2,
  Download,
} from 'lucide-react'
import { formatCurrency, formatPhoneNumber } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'

export default function ServedProductsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedNetwork, setSelectedNetwork] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const { user } = useAuth()
  const isStaff = user?.role === 'staff'
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    filterTransactions()
    setCurrentPage(1) // Reset to first page when filters change
  }, [transactions, searchTerm, selectedNetwork])

  const fetchProducts = async () => {
    try {
      setIsLoading(true)
      // Fetch served requests (these have their own IDs for unserve operations)
      // Increased limit to 50000 to show all served transactions
      const data = await apiClient.transactions.listServed(0, 50000)
      setTransactions(data)
    } catch (error) {
      console.error('Failed to fetch products:', error)
      toast.error('Failed to load products')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnserve = async (id: number) => {
    if (!confirm('Are you sure you want to unserve this transaction? It will move back to pending.')) {
      return
    }
    try {
      await apiClient.transactions.unserve(id)
      toast.success('Transaction unserved successfully')
      fetchProducts()
    } catch (error) {
      console.error('Failed to unserve transaction:', error)
      toast.error('Failed to unserve transaction')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this served transaction? This action cannot be undone.')) {
      return
    }
    try {
      await apiClient.transactions.deleteServed(id)
      toast.success('Transaction deleted successfully')
      fetchProducts()
    } catch (error) {
      console.error('Failed to delete transaction:', error)
      toast.error('Failed to delete transaction')
    }
  }

  const handleExportCSV = () => {
    try {
      const headers = ['User', 'Package', 'Network', 'Recipient', isStaff ? 'Profit' : 'Amount', 'Status', 'Date']
      const csvData = filteredTransactions.map(tx => [
        `="${tx.user_msisdn}"`,
        `="${tx.package_name}"`,
        tx.network,
        `="${tx.recipient}"`,
        isStaff ? (tx.profit_amount !== null && tx.profit_amount !== undefined && tx.profit_amount !== '' && Number(tx.profit_amount) !== 0 ? tx.profit_amount : '-') : tx.amount,
        'Served',
        new Date(tx.served_at || tx.created_at).toLocaleDateString(),
      ])
      const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.setAttribute('href', URL.createObjectURL(blob))
      link.setAttribute('download', `served_products_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success(`Exported ${filteredTransactions.length} records`)
    } catch (error) {
      toast.error('Failed to export data')
    }
  }

  const filterTransactions = () => {
    let filtered = transactions

    // All items from served_requests table are served, no need to filter by status

    if (selectedNetwork) {
      filtered = filtered.filter(tx => tx.network === selectedNetwork)
    }

    if (searchTerm) {
      filtered = filtered.filter(tx =>
        tx.user_msisdn?.includes(searchTerm) ||
        tx.recipient?.includes(searchTerm) ||
        tx.package_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.id.toString().includes(searchTerm)
      )
    }

    setFilteredTransactions(filtered)
  }

  const servedCount = transactions.length
  const pendingCount = 0 // This page only shows served items
  
  // Pagination calculations
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentPageData = filteredTransactions.slice(startIndex, endIndex)
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
              <p className="text-gray-600">View and manage all products (served and pending)</p>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold text-gray-900">{transactions.length}</p>
                </div>
                <PackageIcon className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Served Products</p>
                  <p className="text-2xl font-bold text-green-600">{servedCount}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending Products</p>
                  <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
                </div>
                <Filter className="w-8 h-8 text-orange-500" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by phone, package, or ID..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="">All Networks</option>
                  <option value="MTN">MTN</option>
                  <option value="AT">AirtelTigo</option>
                  <option value="TELECEL">Telecel</option>
                </select>
              </div>
            </div>
          </div>

          {/* Served Products Table */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {filteredTransactions.length === 0 ? (
                <div className="p-12 text-center">
                  <PackageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No served products found</h3>
                  <p className="text-gray-600">
                    {transactions.length === 0
                      ? 'No products have been served yet'
                      : 'No products match your search criteria'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Package
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Network
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Recipient
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {isStaff ? 'Profit' : 'Amount'}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentPageData.map((transaction, index) => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {startIndex + index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatPhoneNumber(transaction.user_msisdn)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {transaction.package_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                              transaction.network === 'MTN' ? 'bg-yellow-100 text-yellow-800' :
                              transaction.network === 'TELECEL' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {transaction.network}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatPhoneNumber(transaction.recipient)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {isStaff
                              ? (transaction.profit_amount !== null && transaction.profit_amount !== undefined && transaction.profit_amount !== '' && Number(transaction.profit_amount) !== 0)
                                ? formatCurrency(Number(transaction.profit_amount))
                                : '-'
                              : formatCurrency(Number(transaction.amount))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Served
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(transaction.served_at || transaction.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setSelectedTransaction(transaction)}
                                className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                title="View details"
                              >
                                <Eye className="w-4 h-4" />
                                View
                              </button>
                              <button
                                onClick={() => handleUnserve(transaction.id)}
                                className="text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1"
                                title="Move back to pending"
                              >
                                <RotateCcw className="w-4 h-4" />
                                Unserve
                              </button>
                              <button
                                onClick={() => handleDelete(transaction.id)}
                                className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                                title="Permanently delete"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          
          {/* Pagination Controls */}
          {filteredTransactions.length > 0 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-b-lg">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredTransactions.length)}</span> of{' '}
                    <span className="font-medium">{filteredTransactions.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Previous</span>
                      ←
                    </button>
                    
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber: number
                      if (totalPages <= 5) {
                        pageNumber = i + 1
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i
                      } else {
                        pageNumber = currentPage - 2 + i
                      }
                      
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === pageNumber
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      )
                    })}
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Next</span>
                      →
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Transaction Details Modal */}
        {selectedTransaction && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                onClick={() => setSelectedTransaction(null)}
              />
              <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-lg">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Transaction Details
                    </h3>
                    <button
                      onClick={() => setSelectedTransaction(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <p className="text-xs text-gray-600 uppercase font-semibold">
                        User Phone
                      </p>
                      <p className="text-gray-900 font-medium">
                        {formatPhoneNumber(selectedTransaction.user_msisdn)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 uppercase font-semibold">
                        Package
                      </p>
                      <p className="text-gray-900 font-medium">
                        {selectedTransaction.package_name}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 uppercase font-semibold">
                        Network
                      </p>
                      <p className="text-gray-900 font-medium">
                        {selectedTransaction.network}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 uppercase font-semibold">
                        Recipient
                      </p>
                      <p className="text-gray-900 font-medium">
                        {formatPhoneNumber(selectedTransaction.recipient)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 uppercase font-semibold">
                        {isStaff ? 'Profit' : 'Amount'}
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {isStaff
                          ? (selectedTransaction.profit_amount !== null && selectedTransaction.profit_amount !== undefined && selectedTransaction.profit_amount !== '' && Number(selectedTransaction.profit_amount) !== 0)
                            ? formatCurrency(Number(selectedTransaction.profit_amount))
                            : '-'
                          : formatCurrency(Number(selectedTransaction.amount))}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 uppercase font-semibold">
                        Status
                      </p>
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                        {selectedTransaction.status}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 uppercase font-semibold">
                        Date
                      </p>
                      <p className="text-gray-900">
                        {new Date(selectedTransaction.created_at).toLocaleString()}
                      </p>
                    </div>

                    {selectedTransaction.payment_reference && (
                      <div>
                        <p className="text-xs text-gray-600 uppercase font-semibold">
                          Payment Reference
                        </p>
                        <p className="text-gray-900 font-mono text-sm">
                          {selectedTransaction.payment_reference}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setSelectedTransaction(null)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  )
}
