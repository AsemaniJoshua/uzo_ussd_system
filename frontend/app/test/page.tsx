'use client'

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 force-visible">
          Frontend Test Page
        </h1>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Text Display Test */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 force-visible">
              Text Display Test
            </h2>
            <p className="text-gray-600 mb-4 force-visible">
              This text should be visible and properly styled.
            </p>
            <div className="space-y-2">
              <div className="text-sm text-gray-500 force-visible">Small text</div>
              <div className="text-base text-gray-700 force-visible">Base text</div>
              <div className="text-lg text-gray-800 force-visible">Large text</div>
              <div className="text-xl text-gray-900 force-visible">Extra large text</div>
            </div>
          </div>

          {/* Input Test */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 force-visible">
              Input Field Test
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 force-visible">
                  Text Input
                </label>
                <input
                  type="text"
                  placeholder="Enter text here"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 force-visible"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 force-visible">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="0244123456"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 force-visible"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 force-visible">
                  Select Option
                </label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 force-visible">
                  <option value="">Choose an option</option>
                  <option value="1">Option 1</option>
                  <option value="2">Option 2</option>
                  <option value="3">Option 3</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Button Test */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 force-visible">
            Button Test
          </h2>
          <div className="flex flex-wrap gap-4">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors force-visible">
              <span className="force-visible">Primary Button</span>
            </button>
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors force-visible">
              <span className="force-visible">Success Button</span>
            </button>
            <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors force-visible">
              <span className="force-visible">Danger Button</span>
            </button>
            <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors force-visible">
              <span className="force-visible">Secondary Button</span>
            </button>
          </div>
        </div>

        {/* Color Test */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 force-visible">
            Color Display Test
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-red-500 text-white p-4 rounded text-center force-visible">Red</div>
            <div className="bg-blue-500 text-white p-4 rounded text-center force-visible">Blue</div>
            <div className="bg-green-500 text-white p-4 rounded text-center force-visible">Green</div>
            <div className="bg-yellow-500 text-white p-4 rounded text-center force-visible">Yellow</div>
          </div>
        </div>

        {/* Link Test */}
        <div className="text-center mt-8">
          <a href="/" className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors force-visible">
            <span className="force-visible">Back to Home</span>
          </a>
        </div>
      </div>
    </div>
  )
}