'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api'
import { Phone, Power, Hash, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function USSDSimulator() {
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15))
  const [msisdn, setMsisdn] = useState('0244123456')
  const [currentInput, setCurrentInput] = useState('')
  const [inputHistory, setInputHistory] = useState<string[]>([])
  const [responses, setResponses] = useState<{ input: string; response: string; timestamp: Date }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSessionActive, setIsSessionActive] = useState(false)

  const startSession = async () => {
    if (!msisdn || msisdn.length < 10) {
      toast.error('Please enter a valid phone number')
      return
    }
    
    try {
      setIsLoading(true)
      // Start with empty input to trigger the initial USSD menu
      const response = await apiClient.ussd.simulate(sessionId, msisdn, '')
      // Strip CON/END prefix from response
      const cleanResponse = response.replace(/^(CON|END)\s*/, '')
      setResponses([{ input: 'Dialed *203*178#', response: cleanResponse, timestamp: new Date() }])
      setInputHistory([])
      setCurrentInput('')
      setIsSessionActive(true)
      toast.success('USSD session started - Dialed *203*178#')
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

    if (!input || !input.trim()) {
      toast.error('Please enter a value')
      return
    }

    try {
      setIsLoading(true)
      // Build the input string - either the first input or subsequent with * separator
      const fullInput = inputHistory.length === 0 ? input : [...inputHistory, input].join('*')
      const response = await apiClient.ussd.simulate(sessionId, msisdn, fullInput)
      
      // Strip CON/END prefix from response
      const cleanResponse = response.replace(/^(CON|END)\s*/, '')
      setResponses(prev => [...prev, { input: fullInput, response: cleanResponse, timestamp: new Date() }])
      setInputHistory(prev => [...prev, input])
      setCurrentInput('')
      
      // Check if session ended (response starts with "END")
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
    console.log('Keypad pressed:', key) // Debug log
    
    if (key === 'send' && currentInput.trim()) {
      sendInput(currentInput)
    } else if (key === 'clear') {
      setCurrentInput('')
      console.log('Input cleared')
    } else if (key === 'back' && currentInput.length > 0) {
      setCurrentInput(prev => {
        const newInput = prev.slice(0, -1)
        console.log('Backspace - new input:', newInput)
        return newInput
      })
    } else if (key !== 'send' && key !== 'back' && key !== 'clear') {
      setCurrentInput(prev => {
        const newInput = prev + key
        console.log('Digit added - new input:', newInput)
        return newInput
      })
    }
  }

  const resetSession = () => {
    setResponses([])
    setInputHistory([])
    setCurrentInput('')
    setIsSessionActive(false)
    console.log('Session reset - input cleared')
  }

  const latestResponse = responses[responses.length - 1]?.response || ''
  const displayText = latestResponse.replace(/^(CON|END)\\s*/, '')
  const isSessionEnded = latestResponse.startsWith('END')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-4 force-visible">USSD Simulator</h1>
          <p className="text-gray-600 max-w-2xl mx-auto force-visible">
            Test the complete USSD flow with our interactive mobile phone simulator.
            Start a session and navigate through the menu options just like on a real mobile phone.
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8">
          {/* Phone Simulator */}
          <div className="flex justify-center">
            <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
              <div className="bg-black rounded-[2rem] p-4">
                {/* Phone Screen */}
                <div className="bg-green-900 rounded-lg p-1 mb-4">
                  <div className="bg-green-800 rounded h-48 p-3 flex flex-col justify-between text-green-100 font-mono text-sm">
                    {/* Header */}
                    <div className="flex justify-between items-center text-xs">
                      <span>MTN</span>
                      <span>{new Date().toLocaleTimeString()}</span>
                    </div>
                    
                    {/* USSD Content */}
                    <div className="flex-1 overflow-y-auto">
                      {displayText ? (
                        <div className="whitespace-pre-wrap break-words text-green-100 font-mono text-sm force-visible">
                          {displayText}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-green-300">
                          <Phone className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    
                    {/* Input Area - Always show when there's input or session is active */}
                    {(currentInput || isSessionActive) && (
                      <div className="border-t border-green-700 pt-2">
                        <div className="text-xs text-green-300 mb-1 force-visible">Your input:</div>
                        <div className="bg-green-800 rounded px-2 py-1 min-h-[20px] text-green-100 font-mono force-visible">
                          <span className="text-green-100 force-visible font-bold text-base">{currentInput || '_'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Current Input Display */}
                <div className="bg-gray-800 rounded-lg p-3 mb-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1 force-visible">Current Input</div>
                    <div className="bg-black rounded px-3 py-2 text-green-400 font-mono text-xl force-visible min-h-[40px] flex items-center justify-center">
                      <span className="force-visible">{currentInput || 'Type using keypad below...'}</span>
                    </div>
                  </div>
                </div>

                {/* Phone Keypad */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
                    <button
                      key={key}
                      onClick={() => handleKeypadPress(key)}
                      className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white rounded-lg py-4 px-2 text-xl font-bold transition-all force-visible shadow-lg hover:shadow-xl"
                    >
                      {key === '*' ? <span className="text-lg text-white force-visible">*</span> : key === '#' ? <Hash className="w-5 h-5 mx-auto text-white" /> : <span className="text-white force-visible text-xl">{key}</span>}
                    </button>
                  ))}
                </div>

                {/* Navigation Keys */}
                <div className="flex justify-center mb-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div></div>
                    <button className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-2 transition-colors">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <div></div>
                    <button className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-2 transition-colors">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-2 transition-colors">
                      {/* Center button */}
                    </button>
                    <button className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-2 transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <div></div>
                    <button className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-2 transition-colors">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <div></div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleKeypadPress('back')}
                    disabled={currentInput.length === 0}
                    className="bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 px-3 text-sm font-semibold transition-colors force-visible disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-white force-visible">Back</span>
                  </button>
                  <button
                    onClick={() => handleKeypadPress('send')}
                    disabled={!currentInput.trim() || isLoading || !isSessionActive || isSessionEnded}
                    className="bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 px-3 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed force-visible"
                  >
                    <span className="text-white force-visible">{isLoading ? 'Sending...' : 'Send'}</span>
                  </button>
                  <button
                    onClick={() => handleKeypadPress('clear')}
                    disabled={currentInput.length === 0}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg py-2 px-3 text-sm font-semibold transition-colors force-visible disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-white force-visible">Clear</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Controls and History */}
          <div className="space-y-6">
            {/* Settings */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 force-visible">Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 force-visible">
                    Phone Number (MSISDN)
                  </label>
                  <input
                    type="tel"
                    value={msisdn}
                    onChange={(e) => setMsisdn(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 force-visible"
                    placeholder="0244123456"
                    disabled={isSessionActive}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 force-visible">
                    Session ID
                  </label>
                  <input
                    type="text"
                    value={sessionId}
                    readOnly
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-500 font-mono text-sm force-visible"
                  />
                </div>
              </div>
            </div>

            {/* Session Controls */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Control</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={startSession}
                  disabled={isSessionActive || isLoading}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed force-visible"
                >
                  <Power className="w-4 h-4 mr-2" />
                  <span className="force-visible">Start Session</span>
                </button>
                <button
                  onClick={resetSession}
                  className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Reset
                </button>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isSessionActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {isSessionActive ? 'Session Active' : 'Session Inactive'}
                </span>
              </div>
            </div>

            {/* Session History */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Session History</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {responses.length === 0 ? (
                  <p className="text-gray-500 text-sm">Start a session to see the history</p>
                ) : (
                  responses.map((item, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-medium text-gray-500">
                          {index === 0 ? 'Initial' : `Input: ${item.input}`}
                        </span>
                        <span className="text-xs text-gray-400">
                          {item.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap">
                        {item.response.replace(/^(CON|END)\\s*/, '')}
                      </div>
                      {item.response.startsWith('END') && (
                        <span className="inline-block mt-1 px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                          Session Ended
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
