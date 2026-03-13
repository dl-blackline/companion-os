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
  Star,
  Lightning,
  Paperclip,
  Image as ImageIcon,
  VideoCamera,
  X,
  SpinnerGap,
  ArrowLeft,
} from '@phosphor-icons/react';
import type { Conversation, Message, ConversationMode, MediaType } from '@/types';
import { generateId, formatDateTime } from '@/lib/helpers';
import { getModeConfig, getAllModes } from '@/lib/modes';
import { getPromptGenerationAwareness } from '@/lib/prompt-studio';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getModelSetting, getModelDisplayName } from '@/utils/model-cache';
import { MediaUploader, type MediaFile } from '@/components/MediaUploader';
import { createClient } from '@supabase/supabase-js';

/** Return the currently selected chat model id. */
function activeChatModel(): string {
  return getModelSetting('chat') || 'gpt-5.4';
}

/** Lazily initialise a Supabase client for storage uploads. */
function getSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Convert a File to a base64-encoded data URL (works without server access). */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function ChatView() {
  const [conversations, setConversations] = useLocalStorage<Conversation[]>('conversations', []);
  const [activeConvId, setActiveConvId] = useState<string | null>(
    (conversations && conversations.length > 0) ? conversations[0].id : null
  );
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<MediaFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  /** Upload a file to Supabase Storage and return its public URL. */
  const uploadToStorage = async (media: MediaFile): Promise<string | null> => {
    const supabase = getSupabase();
    if (!supabase) {
      console.warn('Supabase not configured — converting to base64 data URL');
      return fileToDataUrl(media.file);
    }

    const userId = 'default-user';
    const ext = media.file.name.split('.').pop() || 'bin';
    const path = `${userId}/${generateId()}.${ext}`;

    setIsUploading(true);
    setUploadProgress(10);

    const { data, error } = await supabase.storage
      .from('media_uploads')
      .upload(path, media.file, { cacheControl: '3600', upsert: false });

    setUploadProgress(80);

    if (error) {
      console.error('Storage upload error:', error.message);
      setIsUploading(false);
      console.warn('Falling back to base64 data URL');
      return fileToDataUrl(media.file);
    }

    const { data: publicUrlData } = supabase.storage
      .from('media_uploads')
      .getPublicUrl(data.path);

    setUploadProgress(100);
    setIsUploading(false);
    return publicUrlData.publicUrl;
  };

  /** Handle media selection from the uploader. */
  const handleMediaSelect = (media: MediaFile) => {
    setPendingMedia(media);
    setShowUploader(false);
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && !pendingMedia) || !activeConversation || isStreaming) return;

    let mediaUrl: string | undefined;
    let mediaType: MediaType | undefined;

    // Upload pending media
    if (pendingMedia) {
      const url = await uploadToStorage(pendingMedia);
      if (url) {
        mediaUrl = url;
        mediaType = pendingMedia.mediaType;
      }
      URL.revokeObjectURL(pendingMedia.previewUrl);
      setPendingMedia(null);
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: input.trim() || (mediaType === 'image' ? 'Analyze this image' : 'Describe this video'),
      timestamp: Date.now(),
      ...(mediaUrl && { media_url: mediaUrl }),
      ...(mediaType && { media_type: mediaType }),
    };

    setConversations((prev) => {
      const current = prev || [];
      return current.map(conv => {
        if (conv.id === activeConvId) {
          let title = conv.title;
          if (conv.messages.length === 0) {
            title = input.trim().slice(0, 50)
              || (mediaType === 'image' ? 'Image upload' : mediaType === 'video' ? 'Video upload' : 'New Conversation');
          }
          return {
            ...conv,
            messages: [...conv.messages, userMessage],
            updatedAt: Date.now(),
            title,
          };
        }
        return conv;
      });
    });

    setInput('');
    setIsStreaming(true);
    if (mediaUrl) setIsAnalyzing(true);

    try {
      const modeConfig = getModeConfig(activeConversation.mode);
      const promptAwareness = getPromptGenerationAwareness(activeConversation.mode);
      const conversationContext = activeConversation.messages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      const fullPrompt = `${modeConfig.systemPrompt}${promptAwareness}

Previous conversation:
${conversationContext}

User: ${userMessage.content}

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
            model: activeChatModel(),
            ...(mediaUrl && { media_url: mediaUrl }),
            ...(mediaType && { media_type: mediaType }),
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Chat API error:', res.status, errData);
        throw new Error(errData.error || `Chat request failed with status ${res.status}`);
      }

      const data = await res.json();

      // Detect media response (image or video generated by the AI)
      const isMediaResponse = data.media_url && data.media_type;

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: data.response || (isMediaResponse ? `[${data.media_type} generated]` : ''),
        timestamp: Date.now(),
        ...(isMediaResponse && { media_url: data.media_url }),
        ...(isMediaResponse && { media_type: data.media_type as MediaType }),
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
      setIsAnalyzing(false);
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
    <div className="flex flex-col md:flex-row h-full">
      {/* Conversation list — full width on mobile when no active conv, hidden when viewing chat */}
      <div className={cn(
        'border-r border-border flex flex-col bg-card',
        'w-full md:w-80',
        activeConversation ? 'hidden md:flex' : 'flex'
      )}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Conversations</h2>
            <Button size="sm" onClick={() => handleCreateConversation()} className="min-h-[44px] min-w-[44px]">
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
        <div className={cn(
          'flex-1 flex flex-col',
          activeConversation ? 'flex' : 'hidden md:flex'
        )}>
          <div className="p-4 border-b border-border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveConvId(null)}
                  className="md:hidden flex items-center justify-center w-11 h-11 rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={18} />
                </button>
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
                      {message.media_url && message.media_type === 'image' && (
                        <img
                          src={message.media_url}
                          alt="Uploaded media"
                          className="rounded mb-2 max-h-60 object-contain"
                        />
                      )}
                      {message.media_url && message.media_type === 'video' && (
                        <video
                          src={message.media_url}
                          controls
                          className="rounded mb-2 max-h-60 w-full"
                        />
                      )}
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
                    {isAnalyzing ? (
                      <div className="flex items-center gap-2">
                        <SpinnerGap size={16} className="text-primary animate-spin" />
                        <span className="text-sm text-muted-foreground">Analyzing media…</span>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border bg-card sticky bottom-0 safe-area-bottom">
            <div className="max-w-3xl mx-auto">
              {/* Media uploader panel */}
              {showUploader && (
                <div className="mb-3">
                  <MediaUploader
                    onSelect={handleMediaSelect}
                    onCancel={() => setShowUploader(false)}
                    uploadProgress={uploadProgress}
                    isUploading={isUploading}
                  />
                </div>
              )}

              {/* Pending media preview badge */}
              {pendingMedia && !showUploader && (
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-primary/10 rounded-lg px-3 py-1.5">
                    {pendingMedia.mediaType === 'image' ? (
                      <ImageIcon size={14} className="text-primary" />
                    ) : (
                      <VideoCamera size={14} className="text-primary" />
                    )}
                    <span className="text-xs text-primary font-medium truncate max-w-[200px]">
                      {pendingMedia.file.name}
                    </span>
                    <button
                      onClick={() => {
                        URL.revokeObjectURL(pendingMedia.previewUrl);
                        setPendingMedia(null);
                      }}
                      className="text-primary/60 hover:text-primary transition-colors ml-1"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowUploader(!showUploader)}
                  disabled={isStreaming}
                  className="self-end shrink-0"
                  title="Upload Photo/Video"
                >
                  <Paperclip size={18} />
                </Button>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={pendingMedia ? "Add a message or press send…" : "Type your message..."}
                  className="resize-none min-h-[60px] max-h-[200px]"
                  disabled={isStreaming}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={(!input.trim() && !pendingMedia) || isStreaming}
                  className="self-end min-h-[44px] min-w-[44px]"
                >
                  <PaperPlaneRight size={18} weight="fill" />
                </Button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Press Enter to send, Shift+Enter for new line
                </p>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                  <Lightning size={12} weight="fill" className="text-primary" />
                  {getModelDisplayName('chat', activeChatModel())}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center p-8">
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
