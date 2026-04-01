export type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

// Session-scoped (in-memory) conversation history keyed by roomId.
// Stores the last 5 message pairs (10 messages).
const conversationHistory = new Map<string, ConversationMessage[]>();

export function getConversationHistory(roomId: string): ConversationMessage[] {
  return conversationHistory.get(roomId) ?? [];
}

export function appendConversationPair(opts: {
  roomId: string;
  userContent: string;
  assistantContent: string;
}) {
  const history = conversationHistory.get(opts.roomId) ?? [];
  history.push({ role: 'user', content: opts.userContent });
  history.push({ role: 'assistant', content: opts.assistantContent });
  conversationHistory.set(opts.roomId, history.slice(-10));
}

