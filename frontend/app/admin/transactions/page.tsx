'use client'

import { useState, useEffect } from 'react'
import { Transaction } from '@/types'
import { apiClient } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminLayout from '@/components/AdminLayout'
import {
  Search,
  Filter,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  CreditCard,
} from 'lucide-react'
import { formatCurrency, formatPhoneNumber } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const { user, isLoading: authIsLoading } = useAuth()
  const isStaff = user?.role !== 'superadmin'

  useEffect(() => {
    if (!authIsLoading) {
      fetchTransactions()
    }
  }, [authIsLoading])

  useEffect(() => {
    filterTransactions()
  }, [transactions, searchTerm, statusFilter])

  const fetchTransactions = async () => {
    try {
      setIsLoading(true)
      const data = await apiClient.transactions.list(0, 1000000)
      setTransactions(data)
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
      toast.error('Failed to load transactions')
    } finally {
      setIsLoading(false)
    }
  }

  const filterTransactions = () => {
    let filtered = transactions

    if (statusFilter) {
      filtered = filtered.filter(tx => tx.status === statusFilter)
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

  const handleServeTransaction = async (id: number) => {
    try {
      await apiClient.transactions.serve(id)
      toast.success('Transaction served successfully')
      fetchTransactions()
    } catch (error: any) {
      console.error('Failed to serve transaction:', error)
      const errorMessage = error?.response?.data?.detail || 'Failed to serve transaction'
      toast.error(errorMessage)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID':
        return <CheckCircle className="w-4 h-4" />
      case 'PENDING':
        return <Clock className="w-4 h-4" />
      case 'FAILED':
        return <XCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Transactions</h1>
            <p className="text-gray-600">Manage and monitor all USSD transactions</p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by phone, recipient, package, or ID..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="FAILED">Failed</option>
                  <option value="UNPAID">Unpaid</option>
                </select>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transaction
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Package
                      </th>
                      <th className="hidden md:table-cell px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Network
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="hidden sm:table-cell px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTransactions.map((transaction, index) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <CreditCard className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">{index + 1}</div>
                              <div className="text-xs text-gray-500">
                                {transaction.session_id ? transaction.session_id.substring(0, 12) + '...' : '—'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatPhoneNumber(transaction.user_msisdn)}</div>
                          <div className="text-xs text-gray-500">To: {formatPhoneNumber(transaction.recipient)}</div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{transaction.package_name}</div>
                          <div className="md:hidden mt-1">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                              transaction.network === 'MTN' ? 'bg-yellow-100 text-yellow-800' :
                              transaction.network === 'TELECEL' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {transaction.network}
                            </span>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-3 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                            transaction.network === 'MTN' ? 'bg-yellow-100 text-yellow-800' :
                            transaction.network === 'TELECEL' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {transaction.network}
                          </span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                          {isStaff
                            ? (transaction.profit_amount !== null && transaction.profit_amount !== undefined && transaction.profit_amount !== 0)
                              ? formatCurrency(transaction.profit_amount)
                              : '-'
                            : formatCurrency(transaction.amount)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(transaction.status ?? 'PENDING')}`}>
                            {getStatusIcon(transaction.status ?? 'PENDING')}
                            <span className="ml-1">{transaction.status}</span>
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(transaction.created_at).toLocaleDateString()}
                          <div className="text-xs text-gray-400">{new Date(transaction.created_at).toLocaleTimeString()}</div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => setSelectedTransaction(transaction)}
                              className="text-blue-600 hover:text-blue-900 p-2 rounded-full hover:bg-blue-100 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {transaction.status === 'PAID' && (
                              <button
                                onClick={() => handleServeTransaction(transaction.id)}
                                className="text-green-600 hover:text-green-900 p-2 rounded-full hover:bg-green-100 transition-colors"
                                title="Serve Transaction (Purchase Data)"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Transaction Details Modal */}
        <TransactionModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      </AdminLayout>
    </ProtectedRoute>
  )
}

// Transaction Details Modal
function TransactionModal({
  transaction,
  onClose,
}: {
  transaction: Transaction | null
  onClose: () => void
}) {
  const { user } = useAuth()
  const isStaff = user?.role !== 'superadmin'

  if (!transaction) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-lg">
          <div className="bg-white px-4 pt-5 pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Transaction Details
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Status</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium`}>
                    {transaction.status}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500">Session ID</label>
                <p className="text-sm text-gray-900 font-mono">{transaction.session_id}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Customer Phone</label>
                  <p className="text-sm text-gray-900">{formatPhoneNumber(transaction.user_msisdn)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Recipient</label>
                  <p className="text-sm text-gray-900">{formatPhoneNumber(transaction.recipient)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Network</label>
                  <p className="text-sm text-gray-900">{transaction.network}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Package</label>
                  <p className="text-sm text-gray-900">{transaction.package_name}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500">Amount</label>
                <p className="text-lg font-semibold text-gray-900">
                  {isStaff
                    ? (transaction.profit_amount !== null && transaction.profit_amount !== undefined && transaction.profit_amount !== 0)
                      ? formatCurrency(transaction.profit_amount)
                      : '-'
                    : formatCurrency(transaction.amount)}
                </p>
              </div>

              {transaction.payment_method && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Payment Method</label>
                  <p className="text-sm text-gray-900">{transaction.payment_method}</p>
                </div>
              )}

              {transaction.payment_reference && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Payment Reference</label>
                  <p className="text-sm text-gray-900 font-mono">{transaction.payment_reference}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-500">Created At</label>
                <p className="text-sm text-gray-900">
                  {new Date(transaction.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
