'use client'

import { useState, useEffect } from 'react'
import { Package, PackageCreate, PackageUpdate, NetworkEnum } from '@/types'
import { apiClient } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminLayout from '@/components/AdminLayout'
import {
  Plus,
  Edit,
  Trash2,
  Filter,
  Search,
  Package as PackageIcon,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([])
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkEnum | ''>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPackage, setEditingPackage] = useState<Package | null>(null)

  useEffect(() => {
    fetchPackages()
  }, [])

  useEffect(() => {
    filterPackages()
  }, [packages, selectedNetwork, searchTerm])

  const fetchPackages = async () => {
    try {
      setIsLoading(true)
      const data = await apiClient.packages.list()
      setPackages(data)
    } catch (error) {
      console.error('Failed to fetch packages:', error)
      toast.error('Failed to load packages')
    } finally {
      setIsLoading(false)
    }
  }

  const filterPackages = () => {
    let filtered = packages

    if (selectedNetwork) {
      filtered = filtered.filter(pkg => pkg.network === selectedNetwork)
    }

    if (searchTerm) {
      filtered = filtered.filter(pkg =>
        pkg.package_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredPackages(filtered)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this package?')) return

    try {
      await apiClient.packages.delete(id)
      toast.success('Package deleted successfully')
      fetchPackages()
    } catch (error) {
      console.error('Failed to delete package:', error)
      toast.error('Failed to delete package')
    }
  }

  const handleToggleActive = async (pkg: Package) => {
    try {
      const updateData: PackageUpdate = { active: pkg.active === 1 ? 0 : 1 }
      await apiClient.packages.update(pkg.id, updateData)
      toast.success(`Package ${pkg.active === 1 ? 'deactivated' : 'activated'} successfully`)
      fetchPackages()
    } catch (error) {
      console.error('Failed to update package:', error)
      toast.error('Failed to update package')
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Packages</h1>
              <p className="text-gray-600">Manage data packages for all networks</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Package
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search packages..."
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
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value as NetworkEnum | '')}
                >
                  <option value="">All Networks</option>
                  <option value="MTN">MTN</option>
                  <option value="AT">AT</option>
                  <option value="TELECEL">Telecel</option>
                </select>
              </div>
            </div>
          </div>

          {/* Packages Table */}
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Package
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Network
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPackages.map((pkg) => (
                      <tr key={pkg.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <PackageIcon className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {pkg.package_name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {pkg.network}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(Number(pkg.amount))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleActive(pkg)}
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full cursor-pointer transition-colors ${
                              pkg.active === 1
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                            }`}
                          >
                            {pkg.active === 1 ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => setEditingPackage(pkg)}
                              className="text-blue-600 hover:text-blue-900 p-2 rounded-full hover:bg-blue-100 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(pkg.id)}
                              className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-100 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
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
        </div>

        {/* Create/Edit Modal */}
        <PackageModal
          isOpen={showCreateModal || !!editingPackage}
          onClose={() => {
            setShowCreateModal(false)
            setEditingPackage(null)
          }}
          package={editingPackage}
          onSuccess={() => {
            fetchPackages()
            setShowCreateModal(false)
            setEditingPackage(null)
          }}
        />
      </AdminLayout>
    </ProtectedRoute>
  )
}

// Package Modal Component
function PackageModal({
  isOpen,
  onClose,
  package: pkg,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  package: Package | null
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    network: 'MTN' as NetworkEnum,
    package_name: '',
    amount: '',
    active: 1,
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (pkg) {
      setFormData({
        network: pkg.network,
        package_name: pkg.package_name,
        amount: pkg.amount.toString(),
        active: pkg.active,
      })
    } else {
      setFormData({
        network: 'MTN',
        package_name: '',
        amount: '',
        active: 1,
      })
    }
  }, [pkg])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const data = {
        ...formData,
        amount: parseFloat(formData.amount),
      }

      if (pkg) {
        await apiClient.packages.update(pkg.id, data)
        toast.success('Package updated successfully')
      } else {
        await apiClient.packages.create(data as PackageCreate)
        toast.success('Package created successfully')
      }

      onSuccess()
    } catch (error) {
      console.error('Failed to save package:', error)
      toast.error('Failed to save package')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-lg">
          <form onSubmit={handleSubmit} className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {pkg ? 'Edit Package' : 'Create Package'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Network</label>
                <select
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.network}
                  onChange={(e) => setFormData({ ...formData, network: e.target.value as NetworkEnum })}
                >
                  <option value="MTN">MTN</option>
                  <option value="AT">AT</option>
                  <option value="TELECEL">Telecel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Package Name</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.package_name}
                  onChange={(e) => setFormData({ ...formData, package_name: e.target.value })}
                  placeholder="e.g., 1GB"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Amount (GHS)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={formData.active === 1}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked ? 1 : 0 })}
                />
                <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                  Active
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Saving...' : pkg ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
