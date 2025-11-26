import { useEffect, useRef } from 'react';
import { RefreshCw, Send, Square, ChevronLeft } from 'lucide-react';
import MessageRenderer from './MessageRenderer';
import ConversationsList from './ConversationsList';

/**
 * AssistantTab component - AI chatbot interface with conversation history
 * @param {Object} props
 * @param {Array} props.conversations - Array of conversation objects
 * @param {Object} props.selectedConversation - Currently selected conversation
 * @param {Array} props.messages - Array of message objects with {role, content}
 * @param {string} props.inputMessage - Current input message
 * @param {boolean} props.isSendingMessage - Whether a message is being sent
 * @param {boolean} props.isLoadingConversations - Whether conversations are loading
 * @param {Function} props.onInputChange - Handler for input change
 * @param {Function} props.onSendMessage - Handler for sending message
 * @param {Function} props.onStopMessage - Handler for stopping AI message generation
 * @param {Function} props.onNewConversation - Handler for creating new conversation
 * @param {Function} props.onSelectConversation - Handler for selecting a conversation
 * @param {Function} props.onBackToList - Handler for going back to conversation list
 */
export default function AssistantTab({
  conversations,
  selectedConversation,
  messages,
  inputMessage,
  isSendingMessage,
  isLoadingConversations,
  isSelectMode,
  selectedConversationIds,
  onInputChange,
  onSendMessage,
  onStopMessage,
  onNewConversation,
  onSelectConversation,
  onBackToList,
  onToggleSelectMode,
  onToggleConversationSelection,
  onDeleteSelectedConversations
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
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Start a conversation with the AI assistant
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
                    : 'bg-gray-100 text-gray-900 max-w-[80%]'
                }`}
                style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                ) : (
                  <MessageRenderer content={msg.content} />
                )}
              </div>
            </div>
          ))
        )}
        {isSendingMessage && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <RefreshCw className="w-4 h-4 text-gray-600 animate-spin" />
            </div>
          </div>
        )}
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="bg-white px-6 pb-6">
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
            className="w-full min-h-[80px] max-h-[200px] pl-4 pr-16 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-sm resize-none overflow-y-auto"
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
