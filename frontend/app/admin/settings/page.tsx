'use client'

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminLayout from '@/components/AdminLayout'
import { User, Save, Lock, Eye, EyeOff, Shield, Vote } from 'lucide-react'
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
  const [votingEnabled, setVotingEnabled] = useState(false)
  const [isTogglingVoting, setIsTogglingVoting] = useState(false)
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
      setVotingEnabled(settings.voting_enabled)
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

  const handleVotingToggle = async () => {
    try {
      setIsTogglingVoting(true)
      const newValue = !votingEnabled
      await apiClient.settings.updateVoting(newValue)
      setVotingEnabled(newValue)
      toast.success(`Decoy voting portal ${newValue ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.error('Failed to update voting decoy setting:', error)
      toast.error('Failed to update voting decoy setting')
    } finally {
      setIsTogglingVoting(false)
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

              {/* USSD Security & Camouflage */}
              <div className="border-t pt-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-blue-600" />
                  USSD Security & Camouflage
                </h2>
                <div className="space-y-5 pl-7">
                  {/* Toggle 1: Whitelist Restriction */}
                  <div className="flex items-center justify-between py-2">
                    <div className="pr-4">
                      <h3 className="text-sm font-medium text-gray-900">Restrict USSD Access</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        When enabled, validates dialers against whitelisted contacts and customer purchase history.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleUssdRestrictionToggle}
                      disabled={isTogglingUssd}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
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

                  {/* Toggle 2: Decoy Voting Portal */}
                  <div className="flex items-center justify-between py-2 border-t border-gray-100">
                    <div className="pr-4">
                      <div className="flex items-center gap-2">
                        <Vote className="w-4 h-4 text-purple-600" />
                        <h3 className="text-sm font-medium text-gray-900">Decoy Voting Portal (Camouflage)</h3>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Serves an interactive campus election simulation ("Campus eVote") to conceal data vending from telco audits and unverified dialers.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleVotingToggle}
                      disabled={isTogglingVoting}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                        votingEnabled ? 'bg-purple-600' : 'bg-gray-200'
                      } ${isTogglingVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          votingEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Operational Status Banner */}
                  <div className={`rounded-md p-4 border text-sm ${
                    ussdRestricted && votingEnabled
                      ? 'bg-purple-50 border-purple-200 text-purple-900'
                      : ussdRestricted && !votingEnabled
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : !ussdRestricted && votingEnabled
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}>
                    <div className="font-semibold mb-1 flex items-center gap-1.5">
                      <span>Operational Routing Mode:</span>
                      <span className="underline decoration-dotted">
                        {ussdRestricted && votingEnabled && 'Active Camouflage'}
                        {ussdRestricted && !votingEnabled && 'Strict Whitelist'}
                        {!ussdRestricted && votingEnabled && 'Full Undercover'}
                        {!ussdRestricted && !votingEnabled && 'Public Access (Open Data Bundles)'}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed opacity-90">
                      {ussdRestricted && votingEnabled && (
                        'Whitelisted numbers receive data package menus. Unwhitelisted dialers see the interactive Decoy Voting Portal (0 payment, no DB storage).'
                      )}
                      {ussdRestricted && !votingEnabled && (
                        'Whitelisted numbers receive data package menus. Unwhitelisted dialers receive "Connection problem or invalid MMI code."'
                      )}
                      {!ussdRestricted && votingEnabled && (
                        'All dialers receive the interactive Decoy Voting Portal regardless of whitelist status. (Data bundle service temporarily hidden).'
                      )}
                      {!ussdRestricted && !votingEnabled && (
                        'Standard mode active. Restriction and decoy voting are both disabled — all callers can access and purchase data bundles.'
                      )}
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
