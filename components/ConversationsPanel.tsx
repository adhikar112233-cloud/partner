import React from 'react';
import { Conversation, ConversationParticipant } from '../types';
import { Timestamp } from 'firebase/firestore';

interface ConversationsPanelProps {
  conversations: Conversation[];
  isLoading: boolean;
  onSelect: (participant: ConversationParticipant) => void;
}

const formatTimestamp = (timestamp: any): string => {
  if (!timestamp || typeof timestamp.toDate !== 'function') {
    return '';
  }
  const date = timestamp.toDate();
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMins = Math.round(diffInMs / (1000 * 60));
  const diffInHours = Math.round(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMins < 60) return `${diffInMins}m`;
  if (diffInHours < 24) return `${diffInHours}h`;
  if (diffInDays < 7) return `${diffInDays}d`;
  return date.toLocaleDateString();
};

const ConversationsPanel: React.FC<ConversationsPanelProps> = ({ conversations, isLoading, onSelect }) => {
  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Recent Conversations</h3>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No conversations yet.</div>
        ) : (
          <ul>
            {conversations.map(convo => (
              <li key={convo.id}>
                <button
                  onClick={() => onSelect(convo.participant)}
                  className="w-full text-left flex items-center p-3 space-x-3 hover:bg-gray-50 transition-colors"
                >
                  <img
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    src={convo.participant.avatar}
                    alt={convo.participant.name}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-sm text-gray-800 truncate">{convo.participant.name}</p>
                      <p className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {convo.lastMessage.timestamp ? formatTimestamp(convo.lastMessage.timestamp) : ''}
                      </p>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{convo.lastMessage.text}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ConversationsPanel;