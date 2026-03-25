import { useState, useRef, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ArrowLeft } from '@phosphor-icons/react/ArrowLeft';
import { Image as ImageIcon } from '@phosphor-icons/react/Image';
import { Lightning } from '@phosphor-icons/react/Lightning';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { Paperclip } from '@phosphor-icons/react/Paperclip';
import { PaperPlaneRight } from '@phosphor-icons/react/PaperPlaneRight';
import { Plus } from '@phosphor-icons/react/Plus';
import { Robot } from '@phosphor-icons/react/Robot';
import { Sparkle } from '@phosphor-icons/react/Sparkle';
import { SpinnerGap } from '@phosphor-icons/react/SpinnerGap';
import { Star } from '@phosphor-icons/react/Star';
import { Trash } from '@phosphor-icons/react/Trash';
import { VideoCamera } from '@phosphor-icons/react/VideoCamera';
import { X } from '@phosphor-icons/react/X';
import type { Conversation, Message, ConversationMode, MediaType } from '@/types';
import { generateId, formatDateTime } from '@/lib/helpers';
import { getModeConfig, getAllModes } from '@/lib/modes';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getModelDisplayName } from '@/utils/model-cache';
import { MediaUploader, type MediaFile } from '@/components/MediaUploader';
import { supabase, supabaseConfigured } from '@/lib/supabase-client';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { useAIControl } from '@/context/ai-control-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { runAI } from '@/services/ai-orchestrator';
import { getUserInitials } from '@/services/user-identity-service';

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
  const { user: authUser } = useAuth();
  const { prefs } = useSettings();
  const { orchestratorConfig } = useAIControl();
  const [conversations, setConversations] = useLocalStorage<Conversation[]>('conversations', []);
  const [activeConvId, setActiveConvId] = useState<string | null>(
    (conversations && conversations.length > 0) ? conversations[0].id : null
  );
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<MediaFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const activeConversation = conversations?.find(c => c.id === activeConvId);
  const userInitials = getUserInitials(prefs.display_name, authUser?.email);
  const modes = getAllModes();

  /** Scroll to bottom of messages */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll when messages change or streaming text updates
  useEffect(() => {
    if (isStreaming || (activeConversation?.messages.length ?? 0) > 0) {
      scrollToBottom();
    }
  }, [activeConversation?.messages.length, streamingText, isStreaming]);

  /** Filter conversations by search query */
  const filteredConversations = (conversations || []).filter((conv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      conv.title.toLowerCase().includes(q) ||
      conv.mode.toLowerCase().includes(q) ||
      conv.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  });

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
    const userId = authUser?.id;

    if (!supabaseConfigured || !userId) {
      console.warn('Supabase not configured or user not authenticated — converting to base64 data URL');
      return fileToDataUrl(media.file);
    }

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
    if (!orchestratorConfig.capabilities.chat) {
      toast.error('Chat capability is disabled in Control Center');
      return;
    }

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
    setStreamingText('');
    if (mediaUrl) setIsAnalyzing(true);

    try {
      const modeConfig = getModeConfig(activeConversation.mode);

      // Pass the last 10 turns of the local conversation history so the backend
      // has real context even when the Supabase table hasn't been populated yet.
      const conversation_history = activeConversation.messages
        .slice(-10)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const result = await runAI<{
        data?: { response?: string; media_url?: string; media_type?: MediaType };
        response?: string;
        media_url?: string;
        media_type?: MediaType;
      }>({
        type: 'chat',
        input: {
          message: userMessage.content,
          user_id: authUser?.id || 'anonymous',
          conversation_id: activeConversation.id,
          model: orchestratorConfig.model || 'gpt-4.1',
          mode: activeConversation.mode,
          ai_name: modeConfig.name,
          conversation_history,
          ...(mediaUrl && { media_url: mediaUrl }),
          ...(mediaType && { media_type: mediaType }),
        },
        config: orchestratorConfig,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Chat request failed');
      }

      const payload = result.data.data ?? result.data;
      const responseText = (payload as { response?: string }).response || '';
      const responseMediaUrl = (payload as { media_url?: string }).media_url;
      const responseMediaType = (payload as { media_type?: MediaType }).media_type;

      // Detect media response (image or video generated by the AI)
      const isMediaResponse = !!responseMediaUrl && !!responseMediaType;

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: responseText || (isMediaResponse ? `[${responseMediaType} generated]` : ''),
        timestamp: Date.now(),
        ...(isMediaResponse && { media_url: responseMediaUrl }),
        ...(isMediaResponse && { media_type: responseMediaType }),
      };

      setStreamingText('');
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
      const message = error instanceof Error ? error.message : 'Could not reach the AI service.';
      console.error('[ChatView] AI request failed:', message);
      toast.error(message);
      setStreamingText('');
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

  const handleDeleteConversation = (convId: string) => {
    const conv = conversations?.find(c => c.id === convId);
    const remaining = (conversations || []).filter(c => c.id !== convId);
    setConversations(remaining);
    if (activeConvId === convId) {
      setActiveConvId(remaining.length > 0 ? remaining[0].id : null);
    }
    toast.success(`Deleted "${conv?.title || 'conversation'}"`);
  };

  const handleClearMessages = (convId: string) => {
    setConversations((prev) => {
      const current = prev || [];
      return current.map(c =>
        c.id === convId ? { ...c, messages: [], updatedAt: Date.now() } : c
      );
    });
    toast.success('Conversation cleared');
  };

  return (
    <div className="chat-shell flex flex-col md:flex-row h-full bg-transparent">
      {/* Conversation list — full width on mobile when no active conv, hidden when viewing chat */}
      <div className={cn(
        'chat-panel border-r border-border/70 flex flex-col backdrop-blur-sm',
        'w-full md:w-80',
        activeConversation ? 'hidden md:flex' : 'flex'
      )}>
        <div className="p-4 border-b border-border/75">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Messaging</p>
              <h2 className="font-semibold tracking-tight">Conversations</h2>
            </div>
            <Button size="sm" onClick={() => handleCreateConversation()} className="min-h-[44px] min-w-[44px]">
              <Plus size={16} className="mr-1" /> New
            </Button>
          </div>
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 bg-background/80 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  'chat-list-item group relative rounded-xl transition-colors',
                  activeConvId === conv.id 
                    ? 'bg-primary/10 border border-primary/35 shadow-[0_8px_18px_rgba(176,188,205,0.24)]' 
                    : 'hover:bg-muted/50'
                )}
              >
                <button
                  onClick={() => setActiveConvId(conv.id)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-medium line-clamp-1 flex-1">{conv.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(conv.id);
                      }}
                      title={conv.isPinned ? 'Unpin conversation' : 'Pin conversation'}
                      aria-label={conv.isPinned ? 'Unpin conversation' : 'Pin conversation'}
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
                {/* Delete button appears on hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(conv.id);
                  }}
                  className="absolute top-2 right-8 opacity-0 group-hover:opacity-60 hover:opacity-100! transition-opacity p-1 rounded hover:bg-destructive/10 hover:text-destructive"
                  title="Delete conversation"
                >
                  <Trash size={13} />
                </button>
              </div>
            ))}

            {filteredConversations.length === 0 && searchQuery.trim() && (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No conversations match "{searchQuery}"</p>
              </div>
            )}

            {(!conversations || conversations.length === 0) && !searchQuery.trim() && (
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
          <div className="p-4 border-b border-border/75 bg-[oklch(0.18_0.014_255/0.74)] backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveConvId(null)}
                  className="focus-ring-lux touch-target md:hidden flex items-center justify-center w-11 h-11 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 className="font-semibold tracking-tight mb-1">{activeConversation.title}</h2>
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
                  title="Conversation mode"
                  aria-label="Conversation mode"
                  className="px-3 py-2 bg-background/80 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {modes.map(mode => (
                    <option key={mode.id} value={mode.id}>{mode.name}</option>
                  ))}
                </select>
                {activeConversation.messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    title="Clear conversation"
                    onClick={() => handleClearMessages(activeConversation.id)}
                  >
                    <Trash size={16} />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 p-5 md:p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {activeConversation.messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/12 border border-primary/30 mb-4">
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
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduceMotion ? 0.1 : 0.2 }}
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
                        'max-w-[82%] p-4 rounded-xl border',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground border-primary/80'
                          : 'bg-card/85 border-border/75 shadow-[0_10px_24px_rgba(4,7,13,0.22)]'
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
                      <Avatar className="w-8 h-8 shrink-0 mt-1 border border-border/60">
                        {prefs.avatar_url && <AvatarImage src={prefs.avatar_url} alt="User avatar" />}
                        <AvatarFallback className="text-[10px] bg-accent/10 text-accent">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </motion.div>
                ))
              )}
              {isStreaming && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Robot size={18} weight="fill" className="text-primary animate-pulse" />
                  </div>
                  <div className="bg-card/85 border border-border/75 p-4 rounded-xl max-w-[82%]">
                    {isAnalyzing ? (
                      <div className="flex items-center gap-2">
                        <SpinnerGap size={16} className="text-primary animate-spin" />
                        <span className="text-sm text-muted-foreground">Analyzing media…</span>
                      </div>
                    ) : streamingText ? (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{streamingText}<span className="inline-block w-0.5 h-4 bg-primary/80 ml-0.5 animate-pulse align-text-bottom" aria-hidden="true" /><span className="sr-only"> Generating response…</span></p>
                    ) : (
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce anim-delay-150" />
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce anim-delay-300" />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="chat-composer p-4 sticky bottom-0 safe-area-bottom">
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
                  <div className="flex items-center gap-1.5 bg-primary/12 border border-primary/30 rounded-lg px-3 py-1.5">
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
                      title="Remove pending media"
                      aria-label="Remove pending media"
                      className="text-primary/60 hover:text-primary transition-colors ml-1"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 items-end">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowUploader(!showUploader)}
                  disabled={isStreaming}
                  className="focus-ring-lux touch-target self-end shrink-0"
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
                  className="resize-none min-h-[60px] max-h-[200px] border-border/75 bg-background/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                  disabled={isStreaming}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={(!input.trim() && !pendingMedia) || isStreaming}
                  className="focus-ring-lux touch-target self-end min-h-[44px] min-w-[44px]"
                >
                  <PaperPlaneRight size={18} weight="fill" />
                </Button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Press Enter to send, Shift+Enter for new line
                </p>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/70 border border-border/70 px-2 py-0.5 rounded-md">
                  <Lightning size={12} weight="fill" className="text-primary" />
                  {getModelDisplayName('chat', orchestratorConfig.model)}
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
