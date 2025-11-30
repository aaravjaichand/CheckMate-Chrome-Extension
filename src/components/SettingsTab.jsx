import { RefreshCw, Mail, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * SettingsTab component - Account settings and preferences
 * @param {Object} props
 * @param {string} props.gradingStyle - Global grading style preferences
 * @param {string} props.testResponse - Response from AI connection test
 * @param {boolean} props.isTesting - Whether AI connection test is running
 * @param {boolean} props.isGmailConnected - Whether Gmail is connected (via Google auth)
 * @param {string} props.emailSignature - Email signature for outgoing emails
 * @param {Function} props.onGradingStyleChange - Handler for grading style change
 * @param {Function} props.onTestConnection - Handler for testing AI connection
 * @param {Function} props.onEmailSignatureChange - Handler for email signature change
 */
export default function SettingsTab({
  gradingStyle,
  testResponse,
  isTesting,
  isGmailConnected,
  emailSignature,
  onGradingStyleChange,
  onTestConnection,
  onEmailSignatureChange
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

      {/* Gmail Integration */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Gmail Integration</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          {/* Connection Status */}
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isGmailConnected ? 'bg-green-100' : 'bg-yellow-100'}`}>
              <Mail className={`w-5 h-5 ${isGmailConnected ? 'text-green-600' : 'text-yellow-600'}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Gmail Connection</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isGmailConnected ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-xs text-green-600">Connected via Google Sign-In</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                    <span className="text-xs text-yellow-600">Sign in to enable email features</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Email Signature */}
          {isGmailConnected && (
            <div className="pt-3 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Signature
                <span className="text-gray-500 text-xs font-normal ml-1">(appended to AI-drafted emails)</span>
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                rows="4"
                placeholder="Best regards,&#10;[Your Name]&#10;[Your Title]"
                value={emailSignature}
                onChange={(e) => onEmailSignatureChange(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-2">
                This signature will be added to emails you send through the Assistant. Leave blank for no signature.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
