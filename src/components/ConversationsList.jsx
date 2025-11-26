import { Plus, MessageSquare, RefreshCw, X } from 'lucide-react';

/**
 * ConversationsList component - Displays list of saved conversations
 * @param {Object} props
 * @param {Array} props.conversations - List of conversations
 * @param {boolean} props.loading - Loading state
 * @param {boolean} props.isSelectMode - Whether in select mode
 * @param {Array} props.selectedConversationIds - Array of selected conversation IDs
 * @param {Function} props.onNewConversation - Handler for creating new conversation
 * @param {Function} props.onSelectConversation - Handler for selecting a conversation
 * @param {Function} props.onToggleSelectMode - Handler for toggling select mode
 * @param {Function} props.onToggleConversationSelection - Handler for toggling conversation selection
 * @param {Function} props.onDeleteSelectedConversations - Handler for deleting selected conversations
 */
export default function ConversationsList({
  conversations,
  loading,
  isSelectMode,
  selectedConversationIds,
  onNewConversation,
  onSelectConversation,
  onToggleSelectMode,
  onToggleConversationSelection,
  onDeleteSelectedConversations
}) {
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header with New Conversation Button / Select Button */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
        <h2 className="text-lg font-bold text-gray-900">Conversations</h2>
        <div className="flex items-center gap-2">
          {isSelectMode ? (
            <>
              <button
                onClick={onDeleteSelectedConversations}
                disabled={selectedConversationIds.length === 0}
                className="px-3 py-1 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete selected"
              >
                Delete
              </button>
              <button
                onClick={onToggleSelectMode}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Cancel"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onToggleSelectMode}
                className="px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Select conversations"
              >
                Select
              </button>
              <button
                onClick={onNewConversation}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="New Conversation"
              >
                <Plus className="w-5 h-5 text-blue-600" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="text-center py-12 px-4 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No conversations yet</p>
            <p className="text-sm mt-2 text-gray-400">
              Click the + button to start a new conversation
            </p>
          </div>
        )}

        {!loading && conversations.length > 0 && (
          <div className="space-y-1 p-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="flex items-center gap-2"
              >
                {isSelectMode && (
                  <input
                    type="checkbox"
                    checked={selectedConversationIds.includes(conversation.id)}
                    onChange={() => onToggleConversationSelection(conversation.id)}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                )}
                <button
                  onClick={() => {
                    if (isSelectMode) {
                      onToggleConversationSelection(conversation.id);
                    } else {
                      onSelectConversation(conversation);
                    }
                  }}
                  className="flex-1 text-left p-3 rounded-lg hover:bg-gray-100 transition-colors group"
                >
                  <div className="flex justify-between items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0">
                      {conversation.title}
                    </p>
                    <div className="text-xs text-gray-400 flex-shrink-0">
                      {formatDate(conversation.updatedAt)}
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
