import { useState } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  PaperPlaneRight, 
  User, 
  Robot, 
  Sparkle,
  MagnifyingGlass,
  Star
} from '@phosphor-icons/react';
import type { Conversation, Message, ConversationMode } from '@/types';
import { generateId, formatDateTime } from '@/lib/helpers';
import { getModeConfig, getAllModes } from '@/lib/modes';
import { getPromptGenerationAwareness } from '@/lib/prompt-studio';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function ChatView() {
  const [conversations, setConversations] = useLocalStorage<Conversation[]>('conversations', []);
  const [activeConvId, setActiveConvId] = useState<string | null>(
    (conversations && conversations.length > 0) ? conversations[0].id : null
  );
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const activeConversation = conversations?.find(c => c.id === activeConvId);
  const modes = getAllModes();

  const handleCreateConversation = (mode: ConversationMode = 'neutral') => {
    const newConv: Conversation = {
      id: generateId(),
      title: 'New Conversation',
      mode,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPinned: false,
      isArchived: false,
      tags: [],
    };

    setConversations((prev) => {
      const current = prev || [];
      return [newConv, ...current];
    });
    setActiveConvId(newConv.id);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !activeConversation || isStreaming) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setConversations((prev) => {
      const current = prev || [];
      return current.map(conv => {
        if (conv.id === activeConvId) {
          const updated = {
            ...conv,
            messages: [...conv.messages, userMessage],
            updatedAt: Date.now(),
            title: conv.messages.length === 0 ? input.trim().slice(0, 50) : conv.title,
          };
          return updated;
        }
        return conv;
      });
    });

    setInput('');
    setIsStreaming(true);

    try {
      const modeConfig = getModeConfig(activeConversation.mode);
      const promptAwareness = getPromptGenerationAwareness(activeConversation.mode);
      const conversationContext = activeConversation.messages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      const fullPrompt = `${modeConfig.systemPrompt}${promptAwareness}

Previous conversation:
${conversationContext}

User: ${input.trim()}

Respond as the ${modeConfig.name} mode with the following characteristics:
- Tone: ${modeConfig.tone}
- Behavior rules: ${modeConfig.behaviorRules.join(', ')}

Please provide a helpful response.`;

      const res = await fetch('/.netlify/functions/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'chat',
          data: {
            conversation_id: activeConversation.id,
            user_id: 'default-user',
            message: fullPrompt,
            model: localStorage.getItem('chat_model') || undefined,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Chat API error:', res.status, errData);
        throw new Error(errData.error || `Chat request failed with status ${res.status}`);
      }

      const data = await res.json();
      const response = data.response;

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      setConversations((prev) => {
        const current = prev || [];
        return current.map(conv => {
          if (conv.id === activeConvId) {
            return {
              ...conv,
              messages: [...conv.messages, assistantMessage],
              updatedAt: Date.now(),
            };
          }
          return conv;
        });
      });
    } catch (error) {
      console.error('Error getting AI response:', error);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleTogglePin = (convId: string) => {
    setConversations((prev) => {
      const current = prev || [];
      return current.map(conv =>
        conv.id === convId ? { ...conv, isPinned: !conv.isPinned } : conv
      );
    });
  };

  return (
    <div className="flex h-full">
      <div className="w-80 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Conversations</h2>
            <Button size="sm" onClick={() => handleCreateConversation()}>
              <Plus size={16} className="mr-1" /> New
            </Button>
          </div>
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations?.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={cn(
                  'w-full p-3 rounded-lg text-left transition-colors relative',
                  activeConvId === conv.id 
                    ? 'bg-primary/10 border-l-2 border-l-primary' 
                    : 'hover:bg-muted'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-medium line-clamp-1 flex-1">{conv.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePin(conv.id);
                    }}
                    className="shrink-0 hover:scale-110 transition-transform"
                  >
                    <Star size={14} weight={conv.isPinned ? 'fill' : 'regular'} className={conv.isPinned ? 'text-accent' : 'text-muted-foreground'} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{conv.mode}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(conv.updatedAt)}</span>
                </div>
              </button>
            ))}

            {(!conversations || conversations.length === 0) && (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground mb-4">No conversations yet</p>
                <Button onClick={() => handleCreateConversation()}>
                  Start Your First Chat
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {activeConversation ? (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold mb-1">{activeConversation.title}</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {getModeConfig(activeConversation.mode).name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {activeConversation.messages.length} messages
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select 
                  value={activeConversation.mode}
                  onChange={(e) => {
                    setConversations((prev) => {
                      const current = prev || [];
                      return current.map(conv =>
                        conv.id === activeConvId 
                          ? { ...conv, mode: e.target.value as ConversationMode }
                          : conv
                      );
                    });
                  }}
                  className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {modes.map(mode => (
                    <option key={mode.id} value={mode.id}>{mode.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {activeConversation.messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                    <Sparkle size={32} weight="fill" className="text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Start a conversation</h3>
                  <p className="text-sm text-muted-foreground">
                    Ask anything or choose a different mode to get started
                  </p>
                </div>
              ) : (
                activeConversation.messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      'flex gap-4',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                        <Robot size={18} weight="fill" className="text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] p-4 rounded-lg',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      <span className="text-xs opacity-70 mt-2 block">
                        {formatDateTime(message.timestamp)}
                      </span>
                    </div>
                    {message.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-1">
                        <User size={18} weight="fill" className="text-accent" />
                      </div>
                    )}
                  </motion.div>
                ))
              )}
              {isStreaming && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Robot size={18} weight="fill" className="text-primary animate-pulse" />
                  </div>
                  <div className="bg-card border border-border p-4 rounded-lg">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border bg-card">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-3">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  className="resize-none min-h-[60px] max-h-[200px]"
                  disabled={isStreaming}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isStreaming}
                  className="self-end"
                >
                  <PaperPlaneRight size={18} weight="fill" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h3 className="font-semibold mb-2">No conversation selected</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Create a new conversation or select an existing one to start chatting
            </p>
            <Button onClick={() => handleCreateConversation()}>
              <Plus size={18} className="mr-2" /> Create New Conversation
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
