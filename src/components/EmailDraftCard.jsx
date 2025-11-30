import { useState, useEffect, useRef } from 'react';
import { Mail, Send, Edit3, X, User, Loader2 } from 'lucide-react';

/**
 * EmailDraftCard component - Displays streaming email draft with edit and send functionality
 * @param {Object} props
 * @param {Object} props.emailData - Email data {studentEmail, studentName, subject, body, purpose}
 * @param {boolean} props.isStreaming - Whether the email is currently being generated
 * @param {boolean} props.isSending - Whether the email is being sent
 * @param {Function} props.onSend - Handler for sending the email
 * @param {Function} props.onCancel - Handler for canceling/dismissing the draft
 */
export default function EmailDraftCard({
  emailData,
  isStreaming = false,
  isSending = false,
  onSend,
  onCancel
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedEmail, setEditedEmail] = useState({
    to: emailData?.studentEmail || '',
    subject: emailData?.subject || '',
    body: emailData?.body || ''
  });
  
  // For streaming animation
  const [displayedSubject, setDisplayedSubject] = useState('');
  const [displayedBody, setDisplayedBody] = useState('');
  const [streamingComplete, setStreamingComplete] = useState(false);
  const streamIntervalRef = useRef(null);

  // Update edited email when emailData changes
  useEffect(() => {
    if (emailData) {
      setEditedEmail({
        to: emailData.studentEmail || '',
        subject: emailData.subject || '',
        body: emailData.body || ''
      });
    }
  }, [emailData]);

  // Streaming animation effect
  useEffect(() => {
    if (!emailData || isEditing) return;

    const subject = emailData.subject || '';
    const body = emailData.body || '';
    
    // If we already have complete data and aren't streaming, show it all
    if (!isStreaming && emailData.isComplete) {
      // Animate the reveal
      let subjectIndex = 0;
      let bodyIndex = 0;
      const subjectSpeed = 15; // ms per character
      const bodySpeed = 8; // ms per character (faster for body)

      // Clear any existing interval
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }

      // Stream subject first
      const streamSubject = () => {
        streamIntervalRef.current = setInterval(() => {
          if (subjectIndex <= subject.length) {
            setDisplayedSubject(subject.slice(0, subjectIndex));
            subjectIndex++;
          } else {
            clearInterval(streamIntervalRef.current);
            // Then stream body
            streamBody();
          }
        }, subjectSpeed);
      };

      const streamBody = () => {
        streamIntervalRef.current = setInterval(() => {
          if (bodyIndex <= body.length) {
            setDisplayedBody(body.slice(0, bodyIndex));
            bodyIndex++;
          } else {
            clearInterval(streamIntervalRef.current);
            setStreamingComplete(true);
          }
        }, bodySpeed);
      };

      streamSubject();

      return () => {
        if (streamIntervalRef.current) {
          clearInterval(streamIntervalRef.current);
        }
      };
    }
  }, [emailData, isStreaming, isEditing]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, []);

  const handleFieldChange = (field, value) => {
    setEditedEmail(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSend = () => {
    if (onSend) {
      onSend({
        to: editedEmail.to,
        subject: editedEmail.subject,
        body: editedEmail.body,
        studentName: emailData?.studentName
      });
    }
  };

  const handleEdit = () => {
    // When entering edit mode, make sure we have the full content
    setEditedEmail({
      to: emailData?.studentEmail || '',
      subject: emailData?.subject || '',
      body: emailData?.body || ''
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset to original
    setEditedEmail({
      to: emailData?.studentEmail || '',
      subject: emailData?.subject || '',
      body: emailData?.body || ''
    });
  };

  // Show streaming state
  const showStreaming = isStreaming || (!streamingComplete && !isEditing);
  const showActions = streamingComplete || isEditing;

  if (isEditing) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden max-w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-900">Edit Email Draft</span>
          </div>
        </div>

        {/* Edit Form */}
        <div className="p-4 space-y-4">
          {/* To Field */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input
              type="email"
              value={editedEmail.to}
              onChange={(e) => handleFieldChange('to', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="student@email.com"
            />
          </div>

          {/* Subject Field */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
            <input
              type="text"
              value={editedEmail.subject}
              onChange={(e) => handleFieldChange('subject', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Email subject"
            />
          </div>

          {/* Body Field */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
            <textarea
              value={editedEmail.body}
              onChange={(e) => handleFieldChange('body', e.target.value)}
              rows={8}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Email content..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={handleCancelEdit}
            disabled={isSending}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !editedEmail.to || !editedEmail.subject}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Email
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Preview Mode
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden max-w-full">
      {/* Streaming Indicator */}
      {showStreaming && (
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <span className="text-sm font-medium text-white">Generating email...</span>
        </div>
      )}

      {/* Header - shown when not streaming */}
      {!showStreaming && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-900">Email Draft</span>
          </div>
        </div>
      )}

      {/* Email Preview Content */}
      <div className="p-4 space-y-3">
        {/* To Field */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium text-gray-500 w-14 pt-0.5">To:</span>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-900 truncate">
              {emailData?.studentEmail || (showStreaming ? '...' : '')}
            </span>
          </div>
        </div>

        {/* Subject Field */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium text-gray-500 w-14 pt-0.5">Subject:</span>
          <span className="text-sm font-medium text-gray-900 flex-1">
            {isEditing ? editedEmail.subject : (displayedSubject || (showStreaming ? '...' : ''))}
            {showStreaming && !displayedSubject && (
              <span className="inline-block w-1 h-4 bg-blue-500 animate-pulse ml-0.5" />
            )}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 my-2" />

        {/* Body Preview */}
        <div className="min-h-[120px] max-h-[300px] overflow-y-auto">
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {isEditing ? editedEmail.body : displayedBody}
            {showStreaming && displayedSubject && !streamingComplete && (
              <span className="inline-block w-1 h-4 bg-blue-500 animate-pulse ml-0.5" />
            )}
            {showStreaming && !displayedSubject && !displayedBody && (
              <span className="text-gray-400 italic">Composing message...</span>
            )}
          </p>
        </div>
      </div>

      {/* Actions - shown when streaming is complete */}
      {showActions && (
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isSending}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleEdit}
            disabled={isSending}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Email
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

