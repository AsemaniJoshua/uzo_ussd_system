'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Package, NetworkEnum } from '@/types'
import { apiClient } from '@/lib/api'
import { ArrowLeft, Package as PackageIcon, Wifi } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([])
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkEnum | ''>('')

  useEffect(() => {
    fetchPackages()
  }, [])

  useEffect(() => {
    filterPackages()
  }, [packages, selectedNetwork])

  const fetchPackages = async () => {
    try {
      setIsLoading(true)
      const data = await apiClient.packages.list()
      // Only show active packages
      const activePackages = data.filter(pkg => pkg.active === 1)
      setPackages(activePackages)
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

    setFilteredPackages(filtered)
  }

  const getNetworkColor = (network: NetworkEnum) => {
    switch (network) {
      case 'MTN':
        return 'bg-yellow-500 text-yellow-50'
      case 'AT':
        return 'bg-red-500 text-red-50'
      case 'TELECEL':
        return 'bg-blue-500 text-blue-50'
      default:
        return 'bg-gray-500 text-gray-50'
    }
  }

  const groupedPackages = filteredPackages.reduce((acc, pkg) => {
    if (!acc[pkg.network]) {
      acc[pkg.network] = []
    }
    acc[pkg.network].push(pkg)
    return acc
  }, {} as Record<NetworkEnum, Package[]>)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 force-visible">
            Data Packages
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto force-visible">
            Browse available data packages for all supported networks.
            Choose the perfect plan for your data needs.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition-colors shadow"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>

        {/* Network Filter */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg shadow p-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedNetwork('')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors force-visible ${
                  selectedNetwork === '' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="force-visible">All Networks</span>
              </button>
              {['MTN', 'AT', 'TELECEL'].map((network) => (
                <button
                  key={network}
                  onClick={() => setSelectedNetwork(network as NetworkEnum)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors force-visible ${
                    selectedNetwork === network 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="force-visible">{network}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          /* Packages Grid */
          <div className="space-y-12">
            {Object.keys(groupedPackages).length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PackageIcon className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2 force-visible">No packages available</h3>
                <p className="text-gray-600 force-visible">
                  {selectedNetwork 
                    ? `No packages found for ${selectedNetwork} network.`
                    : 'No packages are currently available.'}
                </p>
              </div>
            ) : (
              Object.entries(groupedPackages).map(([network, networkPackages]) => (
                <div key={network} className="space-y-6">
                  {/* Network Header */}
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getNetworkColor(network as NetworkEnum)}`}>
                      <Wifi className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 force-visible">{network}</h2>
                      <p className="text-gray-600 force-visible">{networkPackages.length} packages available</p>
                    </div>
                  </div>

                  {/* Network Packages */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {networkPackages.map((pkg) => (
                      <div key={pkg.id} className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <PackageIcon className="w-6 h-6 text-blue-600" />
                          </div>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getNetworkColor(pkg.network)}`}>
                            {pkg.network}
                          </span>
                        </div>
                        
                        <div className="mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2 force-visible">
                            {pkg.package_name}
                          </h3>
                          <div className="text-2xl font-bold text-blue-600 force-visible">
                            {formatCurrency(Number(pkg.amount))}
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center justify-between">
                            <span className="force-visible">Network:</span>
                            <span className="font-medium force-visible">{pkg.network}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="force-visible">Data:</span>
                            <span className="font-medium force-visible">{pkg.package_name}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="force-visible">Price:</span>
                            <span className="font-medium force-visible">{formatCurrency(Number(pkg.amount))}</span>
                          </div>
                        </div>

                        <div className="mt-6">
                          <Link
                            href="/simulator"
                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-center block force-visible"
                          >
                            <span className="force-visible text-white">Try in Simulator</span>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to Try Our USSD Service?
            </h3>
            <p className="text-gray-600 mb-6">
              Test the complete purchase flow with our interactive USSD simulator.
              Experience exactly how customers will interact with your service.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/simulator"
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Try USSD Simulator
              </Link>
              <Link
                href="/admin"
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Admin Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
