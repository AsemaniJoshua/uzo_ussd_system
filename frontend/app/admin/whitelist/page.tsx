'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminLayout from '@/components/AdminLayout'
import {
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Database,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface UploadStats {
  total: number
  valid: number
  invalid: number
  duplicates: number
  inserted: number
  failed: number
  by_country: { [key: string]: number }
  invalid_sample?: string[]
}

export default function WhitelistUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [stats, setStats] = useState<UploadStats | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile)
        setStats(null) // Reset previous stats
      } else {
        toast.error('Please select an Excel file (.xlsx or .xls)')
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
        setFile(droppedFile)
        setStats(null)
      } else {
        toast.error('Please select an Excel file (.xlsx or .xls)')
      }
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setShowConfirmation(false)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await apiClient.whitelist.upload(formData)
      
      setStats(response.statistics)
      toast.success('Whitelist import completed successfully!')
      setFile(null) // Clear file after successful upload
    } catch (error: any) {
      console.error('Upload error:', error)
      const errorMessage = error?.response?.data?.detail || 'Failed to upload whitelist'
      toast.error(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  const getCountryName = (code: string): string => {
    const countryMap: { [key: string]: string } = {
      '233': '🇬🇭 Ghana',
      '234': '🇳🇬 Nigeria',
      '225': '🇨🇮 Ivory Coast',
      '254': '🇰🇪 Kenya',
      '256': '🇺🇬 Uganda',
    }
    return countryMap[code] || `Other (${code})`
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Whitelist Upload</h1>
            <p className="text-gray-600">Import phone numbers from Excel file to bypass USSD restriction</p>
          </div>

          {/* Warning Notice */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6">
            <div className="flex">
              <AlertTriangle className="h-6 w-6 text-yellow-400 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-800 mb-3">Important Information</h3>
                
                <div className="space-y-4 text-sm text-yellow-700">
                  <div>
                    <h4 className="font-semibold mb-2">1. FILE FORMAT</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Only Excel files (.xlsx, .xls) are accepted</li>
                      <li>Phone numbers must be in the <strong>FIRST COLUMN</strong></li>
                      <li>Other columns will be ignored</li>
                    </ul>
                    
                    <div className="mt-3 bg-white rounded-lg p-3 border border-yellow-300">
                      <p className="font-semibold mb-2">Example format:</p>
                      <table className="min-w-full border border-gray-300">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-3 py-1 text-left">Phone</th>
                            <th className="border border-gray-300 px-3 py-1 text-left">Name</th>
                            <th className="border border-gray-300 px-3 py-1 text-left">Other</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 px-3 py-1">0244123456</td>
                            <td className="border border-gray-300 px-3 py-1">...</td>
                            <td className="border border-gray-300 px-3 py-1">...</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 px-3 py-1">233501234567</td>
                            <td className="border border-gray-300 px-3 py-1">...</td>
                            <td className="border border-gray-300 px-3 py-1">...</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">2. PROCESSING TIME</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Processing time depends on file size and network speed</li>
                      <li>Estimated: ~1 second per 100 numbers</li>
                      <li>Large files (&gt;5000 numbers) may take several minutes</li>
                      <li><strong className="text-red-700">Do NOT close this page while processing</strong></li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">3. DUPLICATE HANDLING</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Numbers already in the system will be skipped automatically</li>
                      <li>Only NEW numbers will be added to the whitelist</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* File Upload Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Excel File</h2>
            
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50'
                  : file
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 bg-gray-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="flex flex-col items-center space-y-3">
                  <FileSpreadsheet className="w-16 h-16 text-green-500" />
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-600">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3">
                  <Upload className="w-16 h-16 text-gray-400" />
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      Drop your Excel file here
                    </p>
                    <p className="text-sm text-gray-600">or click to browse</p>
                  </div>
                  <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                    Select File
                    <input
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
              )}
            </div>

            {file && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowConfirmation(true)}
                  disabled={isUploading}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Database className="w-5 h-5" />
                      Upload & Process
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Statistics Display */}
          {stats && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                Import Statistics
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Numbers</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Successfully Inserted</p>
                  <p className="text-3xl font-bold text-green-600">{stats.inserted}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Duplicates (Skipped)</p>
                  <p className="text-3xl font-bold text-yellow-600">{stats.duplicates}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Additional Stats */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valid numbers:</span>
                      <span className="font-semibold text-green-600">{stats.valid}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Invalid numbers:</span>
                      <span className="font-semibold text-red-600">{stats.invalid}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Failed:</span>
                      <span className="font-semibold text-red-600">{stats.failed}</span>
                    </div>
                  </div>
                </div>

                {/* Country Distribution */}
                {Object.keys(stats.by_country).length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Country Distribution</h3>
                    <div className="space-y-2 text-sm">
                      {Object.entries(stats.by_country)
                        .sort((a, b) => b[1] - a[1])
                        .map(([code, count]) => (
                          <div key={code} className="flex justify-between">
                            <span className="text-gray-600">{getCountryName(code)}:</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Invalid Sample */}
              {stats.invalid_sample && stats.invalid_sample.length > 0 && (
                <div className="mt-6 p-4 bg-red-50 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    Invalid Numbers (Sample)
                  </h3>
                  <div className="text-sm text-gray-700">
                    {stats.invalid_sample.map((num, idx) => (
                      <div key={idx} className="font-mono">- {num}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Confirmation Modal */}
          {showConfirmation && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
                <div
                  className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                  onClick={() => setShowConfirmation(false)}
                />
                <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-lg p-6">
                  <div className="flex items-start mb-4">
                    <AlertTriangle className="h-6 w-6 text-yellow-500 mr-3 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Confirm Whitelist Import
                      </h3>
                      <div className="text-sm text-gray-700 space-y-2">
                        <p>
                          You are about to import phone numbers from:{' '}
                          <strong>{file?.name}</strong>
                        </p>
                        <p>
                          <strong>This process cannot be undone.</strong>
                        </p>
                        <p className="text-yellow-700 bg-yellow-50 p-2 rounded">
                          ⚠️ Processing may take several minutes depending on file size.
                          Do not close this page until processing is complete.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setShowConfirmation(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpload}
                      className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      Proceed with Import
                    </button>
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
