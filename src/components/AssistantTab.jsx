import { useEffect, useRef } from 'react';
import { RefreshCw, Send, Square, ChevronLeft, Search, Sparkles, FileText } from 'lucide-react';
import MessageRenderer from './MessageRenderer';
import ConversationsList from './ConversationsList';
import EmailDraftCard from './EmailDraftCard';

/**
 * Quick action chip prompts for common teacher queries
 */
const QUICK_ACTIONS = [
  { label: 'Struggling students', prompt: 'Which students are struggling and need extra help?' },
  { label: 'Common mistakes', prompt: 'What are the most common topics students struggle with?' },
  { label: 'Class performance', prompt: 'How is my class performing overall? Give me a summary.' },
  { label: 'Lesson plans', prompt: 'Show me the lesson plans I have created.' }
];

/**
 * Renders tool call UI for a message (only for generate_lesson_plan)
 */
function ToolCallUI({ toolCalls, onOpenLessonPlanModal, isGeneratingLessonPlan, hasGeneratedPlan }) {
  if (!toolCalls || toolCalls.length === 0) return null;

  const generateCall = toolCalls.find(t => t.type === 'generate_lesson_plan');
  if (!generateCall) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200">
      {isGeneratingLessonPlan ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Generating lesson plan for {generateCall.className}...</span>
        </div>
      ) : hasGeneratedPlan ? (
        <button
          onClick={onOpenLessonPlanModal}
          className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
        >
          <FileText className="w-4 h-4" />
          View Generated Plan
        </button>
      ) : null}
    </div>
  );
}

/**
 * AssistantTab component - AI chatbot interface with conversation history
 * @param {Object} props
 * @param {Array} props.conversations - Array of conversation objects
 * @param {Object} props.selectedConversation - Currently selected conversation
 * @param {Array} props.messages - Array of message objects with {role, content, toolCalls}
 * @param {string} props.inputMessage - Current input message
 * @param {boolean} props.isSendingMessage - Whether a message is being sent
 * @param {boolean} props.isSearchingData - Whether RAG is searching data
 * @param {boolean} props.isLoadingConversations - Whether conversations are loading
 * @param {boolean} props.isGeneratingLessonPlan - Whether a lesson plan is being generated
 * @param {boolean} props.hasGeneratedPlan - Whether a plan has been generated and is ready to view
 * @param {Object} props.emailDraft - Email draft data from AI tool call
 * @param {boolean} props.isEmailSending - Whether an email is being sent
 * @param {Function} props.onInputChange - Handler for input change
 * @param {Function} props.onSendMessage - Handler for sending message
 * @param {Function} props.onStopMessage - Handler for stopping AI message generation
 * @param {Function} props.onNewConversation - Handler for creating new conversation
 * @param {Function} props.onSelectConversation - Handler for selecting a conversation
 * @param {Function} props.onBackToList - Handler for going back to conversation list
 * @param {Function} props.onQuickAction - Handler for quick action chip clicks
 * @param {Function} props.onOpenLessonPlanModal - Handler to open the lesson plan modal
 * @param {Function} props.onSendEmail - Handler for sending email
 * @param {Function} props.onCancelEmailDraft - Handler for canceling email draft
 */
export default function AssistantTab({
  conversations,
  selectedConversation,
  messages,
  inputMessage,
  isSendingMessage,
  isSearchingData,
  isLoadingConversations,
  isSelectMode,
  selectedConversationIds,
  isGeneratingLessonPlan,
  hasGeneratedPlan,
  emailDraft,
  isEmailSending,
  onInputChange,
  onSendMessage,
  onStopMessage,
  onNewConversation,
  onSelectConversation,
  onBackToList,
  onToggleSelectMode,
  onToggleConversationSelection,
  onDeleteSelectedConversations,
  onQuickAction,
  onOpenLessonPlanModal,
  onSendEmail,
  onCancelEmailDraft
}) {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show conversations list if no conversation selected
  if (!selectedConversation) {
    return (
      <ConversationsList
        conversations={conversations}
        loading={isLoadingConversations}
        isSelectMode={isSelectMode}
        selectedConversationIds={selectedConversationIds}
        onNewConversation={onNewConversation}
        onSelectConversation={onSelectConversation}
        onToggleSelectMode={onToggleSelectMode}
        onToggleConversationSelection={onToggleConversationSelection}
        onDeleteSelectedConversations={onDeleteSelectedConversations}
      />
    );
  }

  // Show chat interface for selected conversation
  return (
    <div className="h-full flex flex-col overflow-x-hidden">
      {/* Header with back button */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onBackToList}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Back to conversations"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h2 className="text-sm font-semibold text-gray-900 truncate">{selectedConversation.title}</h2>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-scroll overflow-x-hidden p-4 space-y-4 message-container" style={{ scrollbarGutter: 'stable' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <span className="text-gray-700 font-medium">AI Teaching Assistant</span>
            </div>
            <p className="text-gray-500 text-sm mb-6 text-center max-w-xs">
              Ask questions about your students' performance, get insights, and receive teaching recommendations.
            </p>
            
            {/* Quick Action Chips */}
            <div className="flex flex-wrap justify-center gap-2 max-w-sm">
              {QUICK_ACTIONS.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => onQuickAction && onQuickAction(action.prompt)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full hover:bg-blue-100 transition-colors border border-blue-200"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex min-w-0 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`message-bubble rounded-lg px-4 py-2 min-w-0 overflow-hidden ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white max-w-[80%]'
                  : 'bg-gray-100 text-gray-900 w-full'
                }`}
                style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                ) : (
                  <>
                    <MessageRenderer content={msg.content} />
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <ToolCallUI
                        toolCalls={msg.toolCalls}
                        onOpenLessonPlanModal={onOpenLessonPlanModal}
                        isGeneratingLessonPlan={isGeneratingLessonPlan}
                        hasGeneratedPlan={hasGeneratedPlan}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
        
        {/* RAG Searching State */}
        {isSearchingData && (
          <div className="flex justify-start">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600 animate-pulse" />
              <span className="text-sm text-blue-700">Searching your data...</span>
            </div>
          </div>
        )}
        
        {/* AI Generating State */}
        {isSendingMessage && !isSearchingData && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-gray-600 animate-spin" />
              <span className="text-sm text-gray-600">Generating response...</span>
            </div>
          </div>
        )}

        {/* Email Draft Card */}
        {emailDraft && (
          <div className="flex justify-start">
            <div className="w-full max-w-md">
              <EmailDraftCard
                emailData={emailDraft}
                isStreaming={!emailDraft.isComplete}
                isSending={isEmailSending}
                onSend={onSendEmail}
                onCancel={onCancelEmailDraft}
              />
            </div>
          </div>
        )}
        
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="bg-white px-4 pb-6">
        <form onSubmit={onSendMessage} className="relative">
          <textarea
            value={inputMessage}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              // Submit on Enter, but allow Shift+Enter for new line
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendMessage(e);
              }
            }}
            placeholder="Ask anything..."
            disabled={isSendingMessage}
            rows={1}
            className="w-full min-h-[100px] max-h-[200px] pl-4 pr-16 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-sm resize-none overflow-y-auto"
            style={{ 
              scrollbarWidth: 'thin',
              scrollbarColor: '#cbd5e0 transparent'
            }}
          />
          {isSendingMessage ? (
            <button
              type="button"
              onClick={onStopMessage}
              className="absolute right-4 bottom-3 w-8 h-8 bg-red-500 rounded-md flex items-center justify-center cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 text-white fill-white" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="absolute right-4 bottom-3 w-8 h-8 flex items-center justify-center text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
