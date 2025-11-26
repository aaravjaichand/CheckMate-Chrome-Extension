import { RefreshCw } from 'lucide-react';

/**
 * SettingsTab component - Account settings and preferences
 * @param {Object} props
 * @param {string} props.gradingStyle - Global grading style preferences
 * @param {string} props.testResponse - Response from AI connection test
 * @param {boolean} props.isTesting - Whether AI connection test is running
 * @param {Function} props.onGradingStyleChange - Handler for grading style change
 * @param {Function} props.onTestConnection - Handler for testing AI connection
 */
export default function SettingsTab({
  gradingStyle,
  testResponse,
  isTesting,
  onGradingStyleChange,
  onTestConnection
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Account Info */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Account Information</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Status</label>
            <div className="font-medium text-green-600">Connected to Google Classroom</div>
          </div>
        </div>
      </div>

      {/* AI Connection Test */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">AI Connection</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm text-gray-600">
            Test your Vertex AI (Gemini) connection to ensure AI grading is working correctly.
          </p>
          <button
            onClick={onTestConnection}
            disabled={isTesting}
            className="w-full bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>
          {testResponse && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Response from Gemini:</p>
              <p className="text-sm font-medium text-gray-900">{testResponse}</p>
            </div>
          )}
        </div>
      </div>

      {/* Grading Style */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-2">Grading Preferences</h3>
        <label className="block text-sm text-gray-700 mb-2">
          Grading Style
          <span className="text-gray-500 text-xs ml-1">(applies to all grading)</span>
        </label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows="6"
          placeholder="Describe how you want your feedback to sound..."
          value={gradingStyle}
          onChange={(e) => onGradingStyleChange(e.target.value)}
        />
        <p className="text-xs text-gray-500 mt-2">
          This grading style will be used by AI when grading all worksheets. You can also add custom instructions for individual assignments.
        </p>
      </div>
    </div>
  );
}
