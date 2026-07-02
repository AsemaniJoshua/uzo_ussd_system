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
  ShieldCheck, 
  Globe,
  Zap,
  Info,
  Clock,
  ArrowUpRight,
  Search,
  Check,
  ChevronRight
} from 'lucide-react'
import './App.css'

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8000' 
  : 'https://api2.netservicedata.site'

export default function App() {
  // Navigation / Page state: 'home', 'buy', 'status', 'redirecting'
  const [currentPage, setCurrentPage] = useState('home')
  
  // Buy Data Form State
  const [network, setNetwork] = useState('MTN')
  const [packages, setPackages] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingPackages, setLoadingPackages] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [recipient, setRecipient] = useState('')
  const [email, setEmail] = useState('')
  
  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  
  // Status Page State
  const [searchRef, setSearchRef] = useState('')
  const [statusTxId, setStatusTxId] = useState(null)
  const [txDetails, setTxDetails] = useState(null)
  const [pollingStatus, setPollingStatus] = useState('idle') // 'idle', 'polling', 'paid', 'failed', 'error'
  const [statusMessage, setStatusMessage] = useState('')

  // 1. Intercept URL redirects on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const transactionId = params.get('transaction_id') || params.get('tx_ref')
    const code = params.get('code')
    const status = params.get('status')
    
    if (transactionId) {
      setCurrentPage('status')
      setStatusTxId(transactionId)
      setSearchRef(transactionId)
      if (code === '000' || status === 'successful' || status === 'approved') {
        setPollingStatus('paid')
        fetchTransactionDetails(transactionId)
      } else if (code && code !== '000') {
        setPollingStatus('failed')
        setStatusMessage(params.get('reason') || 'Payment verification failed.')
      } else {
        startStatusPolling(transactionId)
      }
    }
  }, [])

  // 2. Fetch packages when network changes
  useEffect(() => {
    if (currentPage === 'buy') {
      fetchPackages()
    }
  }, [network, currentPage])

  const fetchPackages = async () => {
    setLoadingPackages(true)
    setError(null)
    try {
      const res = await axios.get(`${API_BASE_URL}/packages/?network=${network}`)
      const activePackages = res.data.filter(p => p.active)
      activePackages.sort((a, b) => Number(a.amount) - Number(b.amount))
      setPackages(activePackages)
      setSelectedPackage(null)
    } catch (err) {
      console.error(err)
      setError('Could not load packages. Please check your internet connection.')
    } finally {
      setLoadingPackages(false)
    }
  }

  const fetchTransactionDetails = async (ref) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/packages/purchase/status/${ref}`)
      setTxDetails(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  // Poll status endpoint
  const startStatusPolling = (ref) => {
    setPollingStatus('polling')
    fetchTransactionDetails(ref)
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
      }

      if (attempts >= 40) {
        setPollingStatus('failed')
        setStatusMessage('Status checking timed out. Contact customer support if you were debited.')
        clearInterval(interval)
      }
    }, 3000)

    return () => clearInterval(interval)
  }

  const handleManualSearch = (e) => {
    e.preventDefault()
    if (!searchRef.trim()) return
    setStatusTxId(searchRef.trim())
    startStatusPolling(searchRef.trim())
  }

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault()
    if (!selectedPackage) {
      setError('Select a data package to proceed.')
      return
    }
    if (!recipient || recipient.length < 9) {
      setError('Provide a valid recipient mobile number.')
      return
    }

    setSubmitting(true)
    setError(null)
    
    const redirectUrl = `${window.location.origin}${window.location.pathname}`
    
    try {
      const res = await axios.post(`${API_BASE_URL}/packages/purchase`, {
        package_id: selectedPackage.id,
        recipient: recipient,
        redirect_url: redirectUrl,
        email: email || 'customer@netservicedata.site'
      })

      setCurrentPage('redirecting')
      
      setTimeout(() => {
        window.location.href = res.data.checkout_url
      }, 1000)

    } catch (err) {
      console.error(err)
      const errorMsg = err.response?.data?.detail || 'Failed to initiate purchase. Please try again later.'
      setError(errorMsg)
      setSubmitting(false)
    }
  }

  // Format currency helpers
  const formatCurrency = (amt) => {
    const num = Number(amt)
    return isNaN(num) ? 'GHS 0.00' : `GHS ${num.toFixed(2)}`
  }

  // Filter packages based on query
  const filteredPackages = packages.filter(pkg => 
    pkg.package_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      
      {/* 1. Header Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setCurrentPage('home')}>
              <div className="bg-blue-600 p-2 rounded-lg text-white">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-lg tracking-tight">NetService</span>
                <span className="text-xs block text-slate-500 font-medium">Bundles Store</span>
              </div>
            </div>

            {/* Menu Links */}
            <div className="hidden sm:flex items-center gap-6">
              <button 
                onClick={() => setCurrentPage('home')}
                className={`text-sm font-semibold transition-colors cursor-pointer ${
                  currentPage === 'home' ? 'text-blue-600' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Home
              </button>
              <button 
                onClick={() => {
                  setCurrentPage('buy')
                  setNetwork('MTN')
                }}
                className={`text-sm font-semibold transition-colors cursor-pointer ${
                  currentPage === 'buy' ? 'text-blue-600' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Buy Data
              </button>
              <button 
                onClick={() => {
                  setCurrentPage('support')
                }}
                className={`text-sm font-semibold transition-colors cursor-pointer ${
                  currentPage === 'support' ? 'text-blue-600' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Support
              </button>
            </div>

            {/* Header Right Tag */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full border border-emerald-200 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                System Active
              </div>
              <button 
                onClick={() => {
                  setCurrentPage('buy')
                  setNetwork('MTN')
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all cursor-pointer"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 2. Main Content Routing */}
      <main className="flex-grow">
        
        {/* VIEW A: HOME PAGE */}
        {currentPage === 'home' && (
          <div>
            {/* Hero Section */}
            <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full border border-blue-200 mb-6">
                  <Zap className="w-3.5 h-3.5" /> High-speed internet packages at best price
                </div>
                <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-none mb-6">
                  Purchase Mobile Data <br />
                  <span className="text-blue-600">Instantly & Securely</span>
                </h1>
                <p className="text-slate-600 text-lg leading-relaxed mb-8 max-w-lg">
                  Get high-speed data bundles delivered straight to your number. Supported across MTN, Telecel, and AT networks. No logins, no waiting.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => {
                      setCurrentPage('buy')
                      setNetwork('MTN')
                    }}
                    className="btn-primary px-8 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 cursor-pointer"
                  >
                    Buy Data Now
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => {
                      setCurrentPage('support')
                    }}
                    className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-8 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    Help & Support Center
                  </button>
                </div>
              </div>

              {/* Hero Right Visual Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-100/50 relative">
                <div className="absolute top-4 right-4 bg-blue-50 text-blue-700 p-2 rounded-lg border border-blue-100">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-4">Supported Networks</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-yellow-500/20 text-yellow-700 font-bold flex items-center justify-center">MTN</div>
                      <span className="font-semibold text-slate-800">MTN Ghana</span>
                    </div>
                    <span className="text-xs font-semibold text-yellow-700 bg-yellow-500/15 px-2.5 py-1 rounded-full">Active</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/20 text-red-700 font-bold flex items-center justify-center">TC</div>
                      <span className="font-semibold text-slate-800">Telecel Ghana</span>
                    </div>
                    <span className="text-xs font-semibold text-red-700 bg-red-500/15 px-2.5 py-1 rounded-full">Active</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-700 font-bold flex items-center justify-center">AT</div>
                      <span className="font-semibold text-slate-800">AT Money</span>
                    </div>
                    <span className="text-xs font-semibold text-blue-700 bg-blue-500/15 px-2.5 py-1 rounded-full">Active</span>
                  </div>
                </div>
              </div>
            </section>

            {/* How it Works Section */}
            <section className="bg-slate-100/60 border-y border-slate-200/80 py-20 px-4 sm:px-6 lg:px-8">
              <div className="max-w-6xl mx-auto text-center">
                <h2 className="text-3xl font-extrabold text-slate-900 mb-2">How It Works</h2>
                <p className="text-slate-600 max-w-xl mx-auto mb-16">Get mobile bundles online in three quick steps without registering.</p>
                
                <div className="grid md:grid-cols-3 gap-8">
                  {[
                    { step: '1', title: 'Pick Network & Plan', desc: 'Select your service operator (MTN, Telecel, AT) and search for the bundle size you require.' },
                    { step: '2', title: 'Make Payment', desc: 'Input the recipient mobile number and complete the payment checkout securely.' },
                    { step: '3', title: 'Instant Delivery', desc: 'Once your payment transaction is completed, the data bundle is credited to the phone number immediately.' }
                  ].map((card, i) => (
                    <div key={i} className="bg-white border border-slate-200/60 rounded-xl p-8 shadow-sm text-left">
                      <div className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center mb-6">
                        {card.step}
                      </div>
                      <h3 className="font-bold text-slate-900 text-lg mb-2">{card.title}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed">{card.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* FAQs Section */}
            <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
              <h2 className="text-3xl font-extrabold text-slate-900 text-center mb-16">Frequently Asked Questions</h2>
              <div className="space-y-6">
                {[
                  { q: 'How long does it take for my data to arrive?', a: 'Typically under 60 seconds after completing checkout. Our systems process the transaction immediately.' },
                  { q: 'Can I pay using cards?', a: 'Yes! The checkout portal supports Visa and Mastercard payments as well as mobile money options for MTN, Telecel, and AT Money.' },
                  { q: 'What happens if my transaction fails?', a: 'If a payment fails or is cancelled, no funds are captured. If you are debited but do not receive the bundle, reach out directly to our support team.' }
                ].map((faq, i) => (
                  <div key={i} className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 mb-2">
                      <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      {faq.q}
                    </h3>
                    <p className="text-slate-600 text-sm pl-6 leading-relaxed">{faq.a}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* VIEW B: BUY DATA WORKSPACE */}
        {currentPage === 'buy' && (
          <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
            <div className="card-clean p-6 sm:p-8 bg-white relative">
              
              <div className="border-b border-slate-100 pb-6 mb-6">
                <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Buy Mobile Data</h2>
                <p className="text-sm text-slate-500">Provide the package details and recipient information to proceed.</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-rose-50/80 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handlePurchaseSubmit} className="space-y-6">
                
                {/* 1. Network Select buttons */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">1. Select Network</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'MTN', name: 'MTN', activeBorder: 'border-yellow-500', activeBg: 'bg-yellow-500/10 text-yellow-800' },
                      { id: 'TELECEL', name: 'Telecel', activeBorder: 'border-red-500', activeBg: 'bg-red-500/10 text-red-800' },
                      { id: 'AT', name: 'AT Money', activeBorder: 'border-blue-500', activeBg: 'bg-blue-500/10 text-blue-800' }
                    ].map(net => {
                      const isActive = network === net.id
                      return (
                        <button
                          key={net.id}
                          type="button"
                          onClick={() => setNetwork(net.id)}
                          className={`network-select-btn flex flex-col items-center justify-center py-4 rounded-xl border text-sm font-bold cursor-pointer ${
                            isActive 
                              ? `${net.activeBorder} ${net.activeBg}` 
                              : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                        >
                          <Smartphone className="w-5 h-5 mb-1 text-slate-400" />
                          {net.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 2. Choose Package with Filter */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">2. Select Data Bundle</label>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search bundle..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 text-xs w-full focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {loadingPackages ? (
                    <div className="flex items-center justify-center py-16 border border-slate-100 rounded-xl bg-slate-50/30">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                  ) : filteredPackages.length === 0 ? (
                    <div className="text-center py-16 border border-slate-150 rounded-xl bg-slate-50/30 text-slate-500 text-sm">
                      No matching bundles available for {network} currently.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                      {filteredPackages.map(pkg => {
                        const isSelected = selectedPackage?.id === pkg.id
                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => setSelectedPackage(pkg)}
                            className={`flex items-center justify-between p-4 rounded-xl border text-left cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-blue-600 bg-blue-500/5 text-blue-900 shadow-sm' 
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                <Wifi className="w-4.5 h-4.5" />
                              </div>
                              <div>
                                <span className="font-semibold text-sm block">{pkg.package_name}</span>
                                <span className="text-xs text-slate-500">Auto renewal active</span>
                              </div>
                            </div>
                            <span className="font-bold text-sm text-blue-600">
                              {formatCurrency(pkg.amount)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Recipient Info details */}
                <div className="border-t border-slate-100 pt-6">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">3. Delivery Details</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="recipient" className="block text-xs text-slate-500 font-semibold mb-2">Recipient Mobile Number</label>
                      <div className="relative">
                        <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
                        <input
                          id="recipient"
                          type="tel"
                          placeholder="e.g. 0541234567"
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                          required
                          className="pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-slate-800 placeholder-slate-400 text-sm focus:border-blue-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-xs text-slate-500 font-semibold mb-2">Email Address (Optional)</label>
                      <input
                        id="email"
                        type="email"
                        placeholder="receipt@netservicedata.site"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-slate-800 placeholder-slate-400 text-sm focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full py-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Opening secure payment checkout...
                    </>
                  ) : (
                    <>
                      Proceed to Secure Checkout
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

            </div>
          </div>
        )}

        {/* VIEW C: CHECK PAYMENT STATUS (DYNAMIC REDIRECT CONFIRMATION ONLY) */}
        {currentPage === 'status' && (
          <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-xl mx-auto">
            {pollingStatus !== 'idle' && (
              <div className="card-clean p-6 sm:p-8 bg-white text-center">
                {pollingStatus === 'polling' && (
                  <>
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
                    <h3 className="font-bold text-slate-950 mb-1.5">Checking payment status...</h3>
                    <p className="text-xs text-slate-500">Checking checkout gate. Please remain on this screen.</p>
                  </>
                )}

                {pollingStatus === 'paid' && (
                  <>
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-6 h-6 stroke-[3]" />
                    </div>
                    <h3 className="font-bold text-slate-950 text-lg mb-1">Purchase Successful</h3>
                    <p className="text-xs text-slate-500 mb-6">Payment verified. Bundle was dispatched to recipient phone number.</p>
                    
                    {txDetails && (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-left text-xs space-y-2 mb-6">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Recipient:</span>
                          <span className="text-slate-800 font-semibold">{txDetails.recipient}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Bundle Package:</span>
                          <span className="text-slate-800 font-semibold">{txDetails.package_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Amount Charged:</span>
                          <span className="text-blue-600 font-bold">{formatCurrency(txDetails.amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Reference:</span>
                          <span className="text-slate-800 font-semibold font-mono">{txDetails.payment_reference}</span>
                        </div>
                      </div>
                    )}
                    
                    <button
                      onClick={() => {
                        window.history.replaceState({}, document.title, window.location.pathname)
                        setCurrentPage('buy')
                        setPollingStatus('idle')
                        setRecipient('')
                        setSelectedPackage(null)
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-colors w-full"
                    >
                      Buy New Package
                    </button>
                  </>
                )}

                {pollingStatus === 'failed' && (
                  <>
                    <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <XCircle className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-slate-950 text-lg mb-1.5">Checkout Failed</h3>
                    <p className="text-xs text-slate-500 mb-6">
                      {statusMessage || 'The checkout portal canceled this transaction, or you entered an incorrect mobile money PIN.'}
                    </p>
                    <button
                      onClick={() => {
                        window.history.replaceState({}, document.title, window.location.pathname)
                        setCurrentPage('buy')
                        setPollingStatus('idle')
                      }}
                      className="bg-slate-100 hover:bg-slate-150 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-colors w-full"
                    >
                      Try Again
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW D: HELP & SUPPORT PAGE (STATIC VIEW) */}
        {currentPage === 'support' && (
          <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 card-clean p-6 sm:p-8 bg-white">
              <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Help & Support</h2>
              <p className="text-sm text-slate-500 mb-6">Have questions or need assistance? Fill out the form below to get in touch with our team.</p>
              
              <form onSubmit={(e) => { e.preventDefault(); alert("Thank you for contacting support. We will get back to you shortly."); e.target.reset(); }} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Full Name</label>
                  <input type="text" placeholder="John Doe" required className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm w-full focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Email Address</label>
                  <input type="email" placeholder="john@example.com" required className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm w-full focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Message</label>
                  <textarea rows="4" placeholder="How can we help you today?" required className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm w-full focus:border-blue-500 resize-none focus:outline-none"></textarea>
                </div>
                <button type="submit" className="btn-primary w-full py-3 rounded-lg text-sm font-bold cursor-pointer">
                  Send Message
                </button>
              </form>
            </div>

            <div className="space-y-6">
              <div className="card-clean p-6 bg-white">
                <h3 className="font-bold text-slate-900 text-base mb-3">Contact Info</h3>
                <div className="space-y-4 text-sm text-slate-600">
                  <div>
                    <span className="font-semibold block text-slate-800 text-xs uppercase tracking-wider mb-1">Email Support</span>
                    <span className="text-slate-600">support@netservicedata.site</span>
                  </div>
                  <div>
                    <span className="font-semibold block text-slate-800 text-xs uppercase tracking-wider mb-1">Business Hours</span>
                    <span className="text-slate-600">Monday - Sunday, 24/7 Available</span>
                  </div>
                </div>
              </div>

              <div className="card-clean p-6 bg-white">
                <h3 className="font-bold text-slate-900 text-base mb-3">Quick Help</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  For issues regarding delivery delays, please include the recipient phone number in your support request.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* VIEW E: GATEWAY REDIRECTING */}
        {currentPage === 'redirecting' && (
          <div className="py-24 px-4 text-center max-w-md mx-auto">
            <div className="card-clean p-8 bg-white">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
              <h3 className="font-bold text-slate-950 mb-1 text-lg">Redirecting to checkout...</h3>
              <p className="text-xs text-slate-500">Opening secure billing host. Do not refresh your web browser.</p>
            </div>
          </div>
        )}

      </main>

      {/* 3. Footer Bar Component */}
      <footer className="bg-white border-t border-slate-200 mt-20 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg text-white">
                <Globe className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-900">NetService</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ghana's premier online platform for instant mobile money and credit card data bundle delivery.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2.5 text-xs text-slate-500">
              <li><button onClick={() => setCurrentPage('buy')} className="hover:text-slate-900 cursor-pointer">Buy Bundles</button></li>
              <li><button onClick={() => setCurrentPage('support')} className="hover:text-slate-900 cursor-pointer font-medium text-left">Help & Support</button></li>
              <li><a href="#" className="hover:text-slate-900">Coverage Checker</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-4">Supported Operators</h4>
            <ul className="space-y-2.5 text-xs text-slate-500">
              <li>MTN Ghana</li>
              <li>Telecel Ghana (formerly Vodafone)</li>
              <li>AT Money (formerly AirtelTigo)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-4">Secure Transactions</h4>
            <div className="flex items-center gap-2 text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold">
              <ShieldCheck className="w-5 h-5 flex-shrink-0 text-slate-500" />
              <span>100% Encrypted Transactions</span>
            </div>
          </div>

        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© {new Date().getFullYear()} NetService Inc. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-600">Privacy Policy</a>
            <span>•</span>
            <a href="#" className="hover:text-slate-600">Terms of Service</a>
            <span>•</span>
            <a href="#" className="hover:text-slate-600">Contact Help</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
