'use client'

import { useEffect, useState } from 'react'
import { Package, Transaction } from '@/types'
import { apiClient } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminLayout from '@/components/AdminLayout'
import {
  Package as PackageIcon,
  CreditCard,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Eye,
  CheckCircle,
  Search,
  Download,
} from 'lucide-react'
import { formatCurrency, formatPhoneNumber } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'

interface DashboardStats {
  totalPackages: number
  totalTransactions: number
  totalRevenue: number
  pendingTransactions: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPackages: 0,
    totalTransactions: 0,
    totalRevenue: 0,
    pendingTransactions: 0,
  })
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isServing, setIsServing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const { user } = useAuth()
  const isStaff = user?.role === 'staff'

  useEffect(() => {
    fetchDashboardData()
  }, [])

  useEffect(() => {
    filterTransactions()
  }, [recentTransactions, searchTerm, dateFilter])

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      const [packages, transactions] = await Promise.all([
        apiClient.packages.list(),
        apiClient.transactions.listRecentDays(31), // Get all unserved transactions for the last 31 days
      ])

      // Filter PAID transactions (unserved)
      const paidTransactions = transactions.filter(tx => tx.status === 'PAID')
      
      // Filter pending transactions (ONLY PENDING and UNPAID, NOT FAILED)
      const pendingTransactions = transactions.filter(
        tx => tx.status === 'PENDING' || tx.status === 'UNPAID'
      )
      
      // Calculate total revenue from PAID transactions (not yet served)
      // If user is staff, sum up profit_amount instead of total amount
      const totalRevenue = paidTransactions.reduce((sum, tx) => {
        const val = isStaff ? (tx.profit_amount || 0) : tx.amount;
        return sum + Number(val);
      }, 0)

      setStats({
        totalPackages: packages.length,
        totalTransactions: transactions.length,
        totalRevenue,
        pendingTransactions: pendingTransactions.length,
      })

      setRecentTransactions(paidTransactions) // Show only PAID transactions on dashboard
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleServeTransaction = async (id: number) => {
    try {
      setIsServing(true)
      await apiClient.transactions.serve(id)
      toast.success('Transaction marked as served')
      await fetchDashboardData()
    } catch (error: any) {
      console.error('Failed to serve transaction:', error)
      const errorMessage = error?.response?.data?.detail || 'Failed to serve transaction'
      toast.error(errorMessage)
    } finally {
      setIsServing(false)
    }
  }

  const handleExportCSV = async (yyyymmdd: string, dateDisplay: string) => {
    const toastId = toast.loading(`Fetching all transactions for ${dateDisplay}...`)
    try {
      // Fetch all transactions for that specific day from the backend (no limit)
      const transactions = await apiClient.transactions.listByDate(yyyymmdd, 'PAID')
      
      const headers = ['Package', 'Network', 'Recipient']
      const csvData = transactions.map(tx => {
        // Format recipient to 9 digits
        let recipient9 = tx.recipient || '';
        if (recipient9.startsWith('233') && recipient9.length === 12) {
          recipient9 = recipient9.slice(3);
        } else if (recipient9.startsWith('0') && recipient9.length === 10) {
          recipient9 = recipient9.slice(1);
        } else if (recipient9.length >= 9) {
          recipient9 = recipient9.slice(-9);
        }
        
        // Remove 'GB' or 'gb' from package name
        const packageNoGB = tx.package_name ? tx.package_name.replace(/GB/gi, '').trim() : '';

        return [
          `="${packageNoGB}"`,
          tx.network,
          `="${recipient9}"`,
        ];
      })

      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      
      // Format filename: transactions_Monday_January_20_2026.csv
      const safeDate = dateDisplay.replace(/[, ]+/g, '_')
      link.setAttribute('download', `transactions_${safeDate}.csv`)
      
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success(`Exported ${transactions.length} transactions`, { id: toastId })
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export data', { id: toastId })
    }
  }

  const filterTransactions = () => {
    let filtered = recentTransactions

    if (searchTerm) {
      filtered = filtered.filter(tx =>
        tx.user_msisdn?.includes(searchTerm) ||
        tx.recipient?.includes(searchTerm) ||
        tx.package_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.id.toString().includes(searchTerm)
      )
    }

    if (dateFilter) {
      filtered = filtered.filter(tx => {
        // Match the local date string portion (YYYY-MM-DD)
        const txDate = new Date(tx.created_at);
        const txDateString = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}-${String(txDate.getDate()).padStart(2, '0')}`;
        return txDateString === dateFilter;
      })
    }

    setFilteredTransactions(filtered)
  }

  // Group transactions by day (mapping YYYY-MM-DD to display text and items)
  const groupTransactionsByDay = (transactions: Transaction[]) => {
    const groups: { [key: string]: { dateDisplay: string; transactions: Transaction[] } } = {}
    
    // Pre-populate last 31 days (today to 30 days ago)
    const now = new Date()
    for (let i = 0; i < 31; i++) {
      const d = new Date()
      d.setDate(now.getDate() - i)
      const yyyymmdd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const dateDisplay = d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      groups[yyyymmdd] = {
        dateDisplay,
        transactions: []
      }
    }
    
    transactions.forEach(tx => {
      const txDate = new Date(tx.created_at);
      const yyyymmdd = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}-${String(txDate.getDate()).padStart(2, '0')}`;
      
      const dateDisplay = txDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      
      if (!groups[yyyymmdd]) {
        groups[yyyymmdd] = {
          dateDisplay,
          transactions: []
        }
      }
      groups[yyyymmdd].transactions.push(tx)
    })
    
    return groups
  }

  const groupedTransactions = groupTransactionsByDay(filteredTransactions)

  const StatCard = ({ icon: Icon, title, value, change, color }: any) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`flex-shrink-0 p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {change && (
            <p className="text-sm text-green-600 flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              {change}
            </p>
          )}
        </div>
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Overview of your USSD service performance</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              icon={PackageIcon}
              title="Total Packages"
              value={stats.totalPackages}
              color="bg-blue-500"
            />
            <StatCard
              icon={CreditCard}
              title="Total Transactions"
              value={stats.totalTransactions}
              color="bg-green-500"
            />
            <StatCard
              icon={DollarSign}
              title={isStaff ? "Total Profit" : "Total Revenue"}
              value={formatCurrency(stats.totalRevenue)}
              color="bg-purple-500"
            />
            <StatCard
              icon={Activity}
              title="Pending Transactions"
              value={stats.pendingTransactions}
              color="bg-orange-500"
            />
          </div>

          {/* Search Filter */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by phone, package, or ID..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="md:w-64">
                <input
                  type="date"
                  className="px-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  title="Filter by date"
                />
              </div>
            </div>
          </div>

          {/* PAID Transactions */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">PAID Transactions (Unserved)</h2>
              <p className="text-sm text-gray-500 mt-1">
                {searchTerm ? `Showing ${filteredTransactions.length} of ${recentTransactions.length} transactions` : 'Transactions ready for manual fulfillment'}
              </p>
            </div>
            <div className="overflow-x-auto">
              {Object.keys(groupedTransactions).length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-gray-500">
                  No PAID transactions found
                </div>
              ) : (
                Object.entries(groupedTransactions)
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .map(([yyyymmdd, groupData]) => {
                  const { dateDisplay, transactions: dayTransactions } = groupData;
                  return (
                    <div key={yyyymmdd} className="mb-20 last:mb-0">
                      {/* Day Header */}
                      <div className="bg-gradient-to-r from-blue-50 to-gray-100 px-6 py-4 rounded-t-lg border-l-4 border-blue-500 flex justify-between items-center">
                        <h3 className="text-base font-bold text-gray-800">
                           {dateDisplay} <span className="text-sm font-normal text-gray-600">({dayTransactions.length} transaction{dayTransactions.length !== 1 ? 's' : ''})</span>
                        </h3>
                        <button
                          onClick={() => handleExportCSV(yyyymmdd, dateDisplay)}
                          className="flex items-center gap-2 px-3 py-1 bg-white border border-blue-200 text-blue-600 rounded-md hover:bg-blue-50 transition-colors text-sm font-medium shadow-sm"
                          title="Export this day's transactions to CSV"
                        >
                          <Download className="w-4 h-4" />
                          Export CSV
                        </button>
                      </div>
                      
                      {/* Transactions for this day */}
                      <table className="min-w-full divide-y divide-gray-200 shadow-sm rounded-b-lg overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              #
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              User
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Package
                            </th>
                            <th className="hidden md:table-cell px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Network
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Recipient
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {isStaff ? 'Profit' : 'Amount'}
                            </th>
                            <th className="hidden sm:table-cell px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Time
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {dayTransactions.map((transaction, index) => (
                            <tr key={transaction.id} className="hover:bg-gray-50">
                              <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {index + 1}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                                {formatPhoneNumber(transaction.user_msisdn)}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                                <div>{transaction.package_name}</div>
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
                              <td className="hidden md:table-cell px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                                  transaction.network === 'MTN' ? 'bg-yellow-100 text-yellow-800' :
                                  transaction.network === 'TELECEL' ? 'bg-red-100 text-red-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {transaction.network}
                                </span>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                                {formatPhoneNumber(transaction.recipient)}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                                {isStaff
                                  ? transaction.profit_amount != null
                                    ? formatCurrency(Number(transaction.profit_amount))
                                    : '-'
                                  : formatCurrency(Number(transaction.amount))}
                              </td>
                              <td className="hidden sm:table-cell px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(transaction.created_at).toLocaleTimeString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setSelectedTransaction(transaction)}
                                    className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                  >
                                    <Eye className="w-4 h-4" />
                                    View
                                  </button>
                                  {transaction.status === 'PAID' && (
                                    <button
                                      onClick={() => handleServeTransaction(transaction.id)}
                                      disabled={isServing}
                                      className="text-green-600 hover:text-green-800 font-medium flex items-center gap-1 disabled:opacity-50"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                      Serve
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}
            </div>
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

                    <div className="space-y-4">
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
                            ? selectedTransaction.profit_amount != null
                              ? formatCurrency(Number(selectedTransaction.profit_amount))
                              : '-'
                            : formatCurrency(Number(selectedTransaction.amount))}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-600 uppercase font-semibold">
                          Status
                        </p>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                          selectedTransaction.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : selectedTransaction.status === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
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
                      <button
                        onClick={() => {
                          handleServeTransaction(selectedTransaction.id)
                          setSelectedTransaction(null)
                        }}
                        disabled={isServing}
                        className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Mark as Served
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}
