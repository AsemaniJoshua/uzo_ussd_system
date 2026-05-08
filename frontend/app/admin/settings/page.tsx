'use client'

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminLayout from '@/components/AdminLayout'
import { User, Save, Lock, Eye, EyeOff, Shield } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState({
    username: user?.username || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [ussdRestricted, setUssdRestricted] = useState(false)
  const [isTogglingUssd, setIsTogglingUssd] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const settings = await apiClient.settings.get()
      setUssdRestricted(settings.ussd_restricted)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    }
  }

  const handleUssdRestrictionToggle = async () => {
    try {
      setIsTogglingUssd(true)
      const newValue = !ussdRestricted
      await apiClient.settings.updateUssdRestriction(newValue)
      setUssdRestricted(newValue)
      toast.success(`USSD access ${newValue ? 'restricted' : 'unrestricted'}`)
    } catch (error) {
      console.error('Failed to update USSD restriction:', error)
      toast.error('Failed to update USSD restriction')
    } finally {
      setIsTogglingUssd(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setProfile({
      ...profile,
      [name]: value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (profile.newPassword && profile.newPassword !== profile.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (profile.newPassword && profile.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)

    try {
      if (profile.newPassword) {
        console.log('Updating password...')
        await apiClient.auth.updatePassword({
          current_password: profile.currentPassword,
          new_password: profile.newPassword,
        })
        toast.success('Password updated successfully')
      } else {
        toast.error('Please enter a new password')
      }
      
      // Clear password fields
      setProfile({
        ...profile,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (error: any) {
      console.error('Failed to update password:', error)
      console.error('Error response:', error.response?.data)
      console.error('Error status:', error.response?.status)
      const message = error.response?.data?.detail || 'Failed to update password'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Profile Settings</h1>
            <p className="text-gray-600">Manage your admin account settings</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
              {/* Profile Information */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2 text-blue-600" />
                  Profile Information
                </h2>
                <div className="space-y-4 pl-7">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Username
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={profile.username}
                      disabled
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-gray-50 cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-gray-500">Username cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Role
                    </label>
                    <input
                      type="text"
                      value={user?.role || 'Admin'}
                      disabled
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-gray-50 cursor-not-allowed capitalize"
                    />
                  </div>
                </div>
              </div>

              {/* USSD Access Control */}
              <div className="border-t pt-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-blue-600" />
                  USSD Access Control
                </h2>
                <div className="space-y-4 pl-7">
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Restrict USSD Access</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        When enabled, only users with previous paid transactions can access the USSD service
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleUssdRestrictionToggle}
                      disabled={isTogglingUssd}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        ussdRestricted ? 'bg-blue-600' : 'bg-gray-200'
                      } ${isTogglingUssd ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          ussdRestricted ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> When restricted, new users without payment history will see: 
                      "Service temporarily restricted. Please try again later."
                    </p>
                  </div>
                </div>
              </div>

              {/* Change Password */}
              <div className="border-t pt-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Lock className="w-5 h-5 mr-2 text-blue-600" />
                  Change Password
                </h2>
                <div className="space-y-4 pl-7">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Current Password
                    </label>
                    <div className="relative mt-1">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        name="currentPassword"
                        value={profile.currentPassword}
                        onChange={handleChange}
                        className="block w-full border border-gray-300 rounded-md px-3 py-2 pr-10 text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      New Password
                    </label>
                    <div className="relative mt-1">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        name="newPassword"
                        value={profile.newPassword}
                        onChange={handleChange}
                        className="block w-full border border-gray-300 rounded-md px-3 py-2 pr-10 text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter new password (min 6 characters)"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Confirm New Password
                    </label>
                    <div className="relative mt-1">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        value={profile.confirmPassword}
                        onChange={handleChange}
                        className="block w-full border border-gray-300 rounded-md px-3 py-2 pr-10 text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}
