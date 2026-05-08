import Link from 'next/link'
import { Phone, Shield, Globe, Zap } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 force-visible">
            NetService USSD
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto force-visible">
            Complete USSD service management platform for mobile data bundles.
            Manage packages, track transactions, and simulate USSD flows.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mb-6">
              <Globe className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold mb-4 force-visible text-gray-900">Browse Packages</h3>
            <p className="text-gray-600 mb-6 force-visible">
              View available data packages for MTN, AT, and Telecel networks with real-time pricing.
            </p>
            <a
              href="/packages"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Packages
            </a>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mb-6">
              <Phone className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-4 force-visible text-gray-900">USSD Simulator</h3>
            <p className="text-gray-600 mb-6 force-visible">
              Test the complete USSD flow with our interactive phone simulator.
            </p>
            <a
              href="/simulator"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Try Simulator
            </a>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
              <Shield className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold mb-4 force-visible text-gray-900">Admin Dashboard</h3>
            <p className="text-gray-600 mb-6 force-visible">
              Manage packages, track transactions, and monitor system performance.
            </p>
            <a
              href="/admin"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Admin Login
            </a>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
            Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="font-semibold mb-2 force-visible text-gray-900">Real-time Processing</h4>
              <p className="text-sm text-gray-600 force-visible">Instant payment processing with TheTeller integration</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Phone className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="font-semibold mb-2 force-visible text-gray-900">Multi-Network</h4>
              <p className="text-sm text-gray-600 force-visible">Support for MTN, AT, and Telecel networks</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <h4 className="font-semibold mb-2 force-visible text-gray-900">Secure Admin</h4>
              <p className="text-sm text-gray-600 force-visible">JWT-based authentication with role management</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Globe className="w-6 h-6 text-indigo-600" />
              </div>
              <h4 className="font-semibold mb-2 force-visible text-gray-900">API-First</h4>
              <p className="text-sm text-gray-600 force-visible">RESTful API with comprehensive documentation</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
