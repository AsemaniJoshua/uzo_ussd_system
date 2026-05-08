'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminLayout from '@/components/AdminLayout'
import { Phone, Power, Hash, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminSimulatorPage() {
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15))
  const [msisdn, setMsisdn] = useState('0244123456')
  const [currentInput, setCurrentInput] = useState('')
  const [inputHistory, setInputHistory] = useState<string[]>([])
  const [responses, setResponses] = useState<{ input: string; response: string; timestamp: Date }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSessionActive, setIsSessionActive] = useState(false)

  const startSession = async () => {
    try {
      setIsLoading(true)
      const response = await apiClient.ussd.simulate(sessionId, msisdn, '')
      setResponses([{ input: '', response, timestamp: new Date() }])
      setInputHistory([])
      setCurrentInput('')
      setIsSessionActive(true)
      toast.success('USSD session started')
    } catch (error) {
      console.error('Failed to start USSD session:', error)
      toast.error('Failed to start USSD session')
    } finally {
      setIsLoading(false)
    }
  }

  const sendInput = async (input: string) => {
    if (!isSessionActive) {
      toast.error('Please start a session first')
      return
    }

    try {
      setIsLoading(true)
      const fullInput = [...inputHistory, input].join('*')
      const response = await apiClient.ussd.simulate(sessionId, msisdn, fullInput)
      
      setResponses(prev => [...prev, { input: fullInput, response, timestamp: new Date() }])
      setInputHistory(prev => [...prev, input])
      setCurrentInput('')
      
      if (response.startsWith('END')) {
        setIsSessionActive(false)
        toast.success('USSD session ended')
      }
    } catch (error) {
      console.error('Failed to send USSD input:', error)
      toast.error('Failed to send input')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeypadPress = (key: string) => {
    if (key === 'send' && currentInput.trim()) {
      sendInput(currentInput)
    } else if (key === 'clear') {
      setCurrentInput('')
    } else if (key === 'back' && currentInput.length > 0) {
      setCurrentInput(prev => prev.slice(0, -1))
    } else if (key !== 'send' && key !== 'back' && key !== 'clear') {
      setCurrentInput(prev => prev + key)
    }
  }

  const endSession = () => {
    setIsSessionActive(false)
    setResponses([])
    setInputHistory([])
    setCurrentInput('')
    toast.success('USSD session ended')
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">USSD Simulator</h1>
            <p className="text-gray-600">Test USSD flows in a simulated phone environment</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Phone Simulator */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="max-w-sm mx-auto">
                  {/* Phone Frame */}
                  <div className="bg-black rounded-3xl p-3 shadow-2xl" style={{ aspectRatio: '9/19' }}>
                    <div className="bg-gray-100 rounded-3xl h-full overflow-hidden flex flex-col">
                      {/* Status Bar */}
                      <div className="bg-black text-white px-4 py-2 flex justify-between items-center text-xs">
                        <span>9:41</span>
                        <div className="flex gap-1">
                          <span>📶</span>
                          <span>🔋</span>
                        </div>
                      </div>

                      {/* Screen */}
                      <div className="flex-1 bg-white overflow-hidden flex flex-col">
                        {/* Display */}
                        <div className="flex-1 p-4 overflow-y-auto bg-white border-b border-gray-200">
                          {responses.length === 0 ? (
                            <div className="text-center text-gray-500 flex items-center justify-center h-full">
                              <div>
                                <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Start a USSD session</p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {responses.map((msg, idx) => (
                                <div key={idx} className="space-y-1">
                                  {msg.input && (
                                    <div className="flex justify-end">
                                      <div className="bg-blue-500 text-white px-3 py-2 rounded-lg text-sm max-w-xs text-right font-mono">
                                        {msg.input}
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex justify-start">
                                    <div className="bg-gray-200 text-gray-900 px-3 py-2 rounded-lg text-sm max-w-xs">
                                      <p className="whitespace-pre-wrap text-xs">{msg.response}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Input Display */}
                        <div className="bg-gray-50 p-4 border-t border-gray-200">
                          <div className="text-center">
                            <input
                              type="text"
                              value={currentInput}
                              readOnly
                              className="w-full text-center text-2xl font-mono text-green-400 bg-gray-900 px-3 py-2 rounded border-2 border-green-400"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* Keypad */}
                        <div className="p-3 bg-gray-200 space-y-2">
                          {/* Numbers Grid */}
                          <div className="grid grid-cols-3 gap-2">
                            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(key => (
                              <button
                                key={key}
                                onClick={() => handleKeypadPress(key)}
                                disabled={!isSessionActive || isLoading}
                                className="bg-gray-300 hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold py-2 rounded text-lg transition-colors"
                              >
                                {key}
                              </button>
                            ))}
                          </div>

                          {/* Bottom Row */}
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => handleKeypadPress('*')}
                              disabled={!isSessionActive || isLoading}
                              className="bg-gray-300 hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold py-2 rounded text-lg transition-colors"
                            >
                              *
                            </button>
                            <button
                              onClick={() => handleKeypadPress('0')}
                              disabled={!isSessionActive || isLoading}
                              className="bg-gray-300 hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold py-2 rounded text-lg transition-colors"
                            >
                              0
                            </button>
                            <button
                              onClick={() => handleKeypadPress('#')}
                              disabled={!isSessionActive || isLoading}
                              className="bg-gray-300 hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold py-2 rounded text-lg transition-colors"
                            >
                              #
                            </button>
                          </div>

                          {/* Action Buttons */}
                          <div className="grid grid-cols-3 gap-2 mt-3">
                            <button
                              onClick={() => handleKeypadPress('back')}
                              disabled={!isSessionActive || isLoading || currentInput.length === 0}
                              className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold py-2 rounded text-xs transition-colors flex items-center justify-center"
                            >
                              <ArrowLeft className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleKeypadPress('send')}
                              disabled={!isSessionActive || isLoading || currentInput.trim().length === 0}
                              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 rounded text-xs transition-colors"
                            >
                              SEND
                            </button>
                            <button
                              onClick={() => handleKeypadPress('clear')}
                              disabled={!isSessionActive || isLoading || currentInput.length === 0}
                              className="bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 rounded text-xs transition-colors flex items-center justify-center"
                            >
                              C
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls Sidebar */}
            <div className="space-y-6">
              {/* Session Controls */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Session Controls</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number (MSISDN)
                    </label>
                    <input
                      type="text"
                      value={msisdn}
                      onChange={(e) => setMsisdn(e.target.value)}
                      disabled={isSessionActive}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 disabled:bg-gray-100 text-sm"
                      placeholder="0244123456"
                    />
                  </div>

                  <button
                    onClick={startSession}
                    disabled={isSessionActive || isLoading}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <Power className="w-4 h-4" />
                    Start Session
                  </button>

                  <button
                    onClick={endSession}
                    disabled={!isSessionActive || isLoading}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <Power className="w-4 h-4" />
                    End Session
                  </button>
                </div>

                {/* Status */}
                <div className="mt-6 p-3 bg-gray-100 rounded">
                  <p className="text-xs text-gray-600 font-semibold">SESSION STATUS</p>
                  <p className={`text-lg font-bold mt-1 ${isSessionActive ? 'text-green-600' : 'text-red-600'}`}>
                    {isSessionActive ? 'ACTIVE' : 'INACTIVE'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}
