import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { 
  Smartphone, 
  Wifi, 
  Package, 
  ArrowRight, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertCircle, 
  RefreshCw, 
  Globe,
  Database,
  ShieldCheck,
  CreditCard
} from 'lucide-react'
import './App.css'

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8000' 
  : 'https://api2.netservicedata.site'

export default function App() {
  // Navigation / View State
  const [view, setView] = useState('purchase') // 'purchase', 'redirecting', 'status'
  
  // Purchase Form State
  const [network, setNetwork] = useState('MTN') // MTN, TELECEL, AT
  const [packages, setPackages] = useState([])
  const [loadingPackages, setLoadingPackages] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [recipient, setRecipient] = useState('')
  const [email, setEmail] = useState('')
  
  // Action/Submission State
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  
  // Status Page State
  const [statusTxId, setStatusTxId] = useState(null)
  const [txDetails, setTxDetails] = useState(null)
  const [pollingStatus, setPollingStatus] = useState('polling') // 'polling', 'paid', 'failed', 'error'
  const [statusMessage, setStatusMessage] = useState('')

  // 1. Check if we returned from payment on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const transactionId = params.get('transaction_id') || params.get('tx_ref')
    const code = params.get('code')
    const status = params.get('status')
    
    if (transactionId) {
      setView('status')
      setStatusTxId(transactionId)
      if (code === '000' || status === 'successful' || status === 'approved') {
        setPollingStatus('paid')
      } else if (code && code !== '000') {
        setPollingStatus('failed')
      } else {
        startStatusPolling(transactionId)
      }
    }
  }, [])

  // 2. Fetch packages when network changes
  useEffect(() => {
    if (view === 'purchase') {
      fetchPackages()
    }
  }, [network, view])

  const fetchPackages = async () => {
    setLoadingPackages(true)
    setError(null)
    try {
      const res = await axios.get(`${API_BASE_URL}/packages/?network=${network}`)
      // Sort packages by amount ascending
      const activePackages = res.data.filter(p => p.active)
      activePackages.sort((a, b) => Number(a.amount) - Number(b.amount))
      setPackages(activePackages)
      setSelectedPackage(null)
    } catch (err) {
      console.error(err)
      setError('Failed to fetch data packages. Please refresh the page.')
    } finally {
      setLoadingPackages(false)
    }
  }

  // Poll status endpoint
  const startStatusPolling = (ref) => {
    setPollingStatus('polling')
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      try {
        const res = await axios.get(`${API_BASE_URL}/packages/purchase/status/${ref}`)
        setTxDetails(res.data)
        
        if (res.data.status === 'PAID') {
          setPollingStatus('paid')
          clearInterval(interval)
        } else if (res.data.status === 'FAILED') {
          setPollingStatus('failed')
          clearInterval(interval)
        }
      } catch (err) {
        console.error('Polling error:', err)
        // Keep attempting, server might be slow
      }

      // Stop polling after 40 attempts (~2 minutes)
      if (attempts >= 40) {
        setPollingStatus('failed')
        setStatusMessage('Payment verification timed out. Please contact support.')
        clearInterval(interval)
      }
    }, 3000)

    return () => clearInterval(interval)
  }

  const handlePurchase = async (e) => {
    e.preventDefault()
    if (!selectedPackage) {
      setError('Please select a data bundle package')
      return
    }
    if (!recipient || recipient.length < 9) {
      setError('Please enter a valid phone number')
      return
    }

    setSubmitting(true)
    setError(null)
    
    // Construct the absolute callback URL pointing back to this website's domain
    const redirectUrl = `${window.location.origin}${window.location.pathname}`
    
    try {
      const res = await axios.post(`${API_BASE_URL}/packages/purchase`, {
        package_id: selectedPackage.id,
        recipient: recipient,
        redirect_url: redirectUrl,
        email: email || 'customer@netservicedata.site'
      })

      setView('redirecting')
      
      // Delay slightly for smooth transition before redirect
      setTimeout(() => {
        window.location.href = res.data.checkout_url
      }, 1500)

    } catch (err) {
      console.error(err)
      const errorMsg = err.response?.data?.detail || 'Failed to initiate checkout. Please try again.'
      setError(errorMsg)
      setSubmitting(false)
    }
  }

  // Format currency helpers
  const formatCurrency = (amt) => {
    const num = Number(amt)
    return isNaN(num) ? 'GHS 0.00' : `GHS ${num.toFixed(2)}`
  }

  return (
    <div className="min-h-screen flex flex-col justify-between py-6 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-white/10 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-600/30">
            <Globe className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white m-0">NetService</h1>
            <p className="text-xs text-slate-400">Premium Data Bundles</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 font-medium">
          <ShieldCheck className="w-4 h-4" /> Secured by theTeller
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-grow flex items-center justify-center max-w-4xl mx-auto w-full">
        {view === 'purchase' && (
          <div className="w-full glass-card rounded-2xl p-6 sm:p-8 relative overflow-hidden">
            {/* Background blur decorative element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -z-10"></div>
            
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Buy Cheap Data Bundles</h2>
              <p className="text-slate-400 text-sm">Select your network, pick a package, and pay instantly via Mobile Money or Card.</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-300 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handlePurchase} className="space-y-6">
              {/* Network Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3">Select Network</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'MTN', name: 'MTN', color: 'hover:border-yellow-500/50 hover:shadow-yellow-500/5 active-border-yellow-500', activeBg: 'border-yellow-500 bg-yellow-500/10 text-yellow-200' },
                    { id: 'TELECEL', name: 'Telecel', color: 'hover:border-red-500/50 hover:shadow-red-500/5 active-border-red-500', activeBg: 'border-red-500 bg-red-500/10 text-red-200' },
                    { id: 'AT', name: 'AT Money', color: 'hover:border-blue-500/50 hover:shadow-blue-500/5 active-border-blue-500', activeBg: 'border-blue-500 bg-blue-500/10 text-blue-200' }
                  ].map(net => {
                    const isActive = network === net.id
                    return (
                      <button
                        key={net.id}
                        type="button"
                        onClick={() => setNetwork(net.id)}
                        className={`network-btn flex flex-col items-center justify-center py-4 px-3 rounded-xl border text-sm font-bold cursor-pointer ${
                          isActive 
                            ? net.activeBg 
                            : 'border-white/5 bg-white/5 text-slate-400 hover:bg-white/10'
                        } ${net.color}`}
                      >
                        <Smartphone className="w-5 h-5 mb-1.5" />
                        {net.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Package Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3">Choose Package</label>
                {loadingPackages ? (
                  <div className="flex items-center justify-center py-12 bg-white/5 rounded-xl border border-white/5">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  </div>
                ) : packages.length === 0 ? (
                  <div className="text-center py-12 bg-white/5 rounded-xl border border-white/5 text-slate-400">
                    No active packages available for {network} at this moment.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                    {packages.map(pkg => {
                      const isSelected = selectedPackage?.id === pkg.id
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setSelectedPackage(pkg)}
                          className={`flex items-center justify-between p-4 rounded-xl border text-left cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-100 shadow-md shadow-indigo-500/5' 
                              : 'border-white/5 bg-white/5 text-slate-300 hover:border-white/15 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Wifi className={`w-5 h-5 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                            <div>
                              <div className="font-semibold text-sm">{pkg.package_name}</div>
                              <div className="text-xs text-slate-400">Instant delivery</div>
                            </div>
                          </div>
                          <div className="font-bold text-sm text-indigo-400">
                            {formatCurrency(pkg.amount)}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Recipient Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="recipient" className="block text-sm font-semibold text-slate-300 mb-2">Recipient Phone Number</label>
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                    <input
                      id="recipient"
                      type="tel"
                      placeholder="e.g. 0541234567"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      required
                      className="pl-12 pr-4 py-3 bg-white/5 border border-white/5 rounded-xl w-full text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-300 mb-2">Email Address (Optional)</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="For receipt updates"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="px-4 py-3 bg-white/5 border border-white/5 rounded-xl w-full text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="glow-btn w-full py-4 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    Proceed to secure checkout
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {view === 'redirecting' && (
          <div className="w-full max-w-md glass-card rounded-2xl p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto mb-6" />
            <h2 className="text-xl font-bold text-white mb-2">Opening secure payment checkout</h2>
            <p className="text-slate-400 text-sm">Please do not refresh the page. We are redirecting you to our secure payment gateway to finish purchase.</p>
          </div>
        )}

        {view === 'status' && (
          <div className="w-full max-w-md glass-card rounded-2xl p-8 text-center">
            {pollingStatus === 'polling' && (
              <>
                <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto mb-6" />
                <h2 className="text-xl font-bold text-white mb-2">Verifying Payment</h2>
                <p className="text-slate-400 text-sm mb-4">We are checking with theTeller to confirm your payment status.</p>
                <div className="text-xs text-indigo-400 bg-indigo-500/5 px-3 py-1.5 rounded-full inline-block border border-indigo-500/10">
                  Ref: {statusTxId}
                </div>
              </>
            )}

            {pollingStatus === 'paid' && (
              <>
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Purchase Successful!</h2>
                <p className="text-slate-400 text-sm mb-6">Your payment has been received successfully. The bundle is being dispatched to your recipient number.</p>
                
                {txDetails && (
                  <div className="bg-white/5 rounded-xl border border-white/5 p-4 text-left space-y-2 mb-6 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Recipient:</span>
                      <span className="text-white font-semibold">{txDetails.recipient}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bundle:</span>
                      <span className="text-white font-semibold">{txDetails.package_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Amount Paid:</span>
                      <span className="text-indigo-400 font-bold">{formatCurrency(txDetails.amount)}</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    // Clear query params and reload purchase form
                    window.history.replaceState({}, document.title, window.location.pathname)
                    setRecipient('')
                    setSelectedPackage(null)
                    setView('purchase')
                  }}
                  className="glow-btn px-6 py-3 rounded-xl text-white font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  Buy Another Bundle
                </button>
              </>
            )}

            {pollingStatus === 'failed' && (
              <>
                <div className="w-16 h-16 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <XCircle className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Payment Failed or Cancelled</h2>
                <p className="text-slate-400 text-sm mb-6">
                  {statusMessage || 'The transaction could not be processed. Make sure you entered the correct PIN or had sufficient wallet funds.'}
                </p>
                
                <button
                  type="button"
                  onClick={() => {
                    // Clear query params and reload purchase form
                    window.history.replaceState({}, document.title, window.location.pathname)
                    setView('purchase')
                  }}
                  className="bg-white/10 hover:bg-white/15 px-6 py-3 rounded-xl text-white font-bold text-sm inline-flex items-center gap-2 border border-white/5 cursor-pointer"
                >
                  Try Again
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {/* Brand Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center text-xs text-slate-500 pt-8 border-t border-white/5">
        <p className="mb-2">© {new Date().getFullYear()} NetService. All rights reserved.</p>
        <div className="flex justify-center gap-4 text-slate-600">
          <a href="#" className="hover:text-slate-400">Terms of Service</a>
          <span>•</span>
          <a href="#" className="hover:text-slate-400">Privacy Policy</a>
          <span>•</span>
          <a href="#" className="hover:text-slate-400">Contact Support</a>
        </div>
      </footer>
    </div>
  )
}
