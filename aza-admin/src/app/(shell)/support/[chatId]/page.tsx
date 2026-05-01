"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  getSupportChatMessages, 
  getSupportChat, 
  sendSupportReply, 
  sendTypingIndicator, 
  SupportMessage, 
  SupportChatSummary,
  getToken 
} from "@/lib/admin-api";
import { ArrowLeft, Send, User, MoreVertical } from "lucide-react";
import * as SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export default function SupportChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const router = useRouter();
  
  const [chat, setChat] = useState<SupportChatSummary | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const stompRef = useRef<Client | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [chatData, msgsData] = await Promise.all([
        getSupportChat(chatId),
        getSupportChatMessages(chatId, 0, 50)
      ]);
      setChat(chatData);
      setMessages([...msgsData.content].reverse());
    } catch (e: any) {
      setError(e.message ?? "Failed to load chat data");
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const client = new Client({
      webSocketFactory: () => new (SockJS as any)(`${BASE_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe("/user/queue/chat", (frame) => {
          try {
            const event = JSON.parse(frame.body);
            if (event.payload?.chatId === chatId) {
              if (event.type === "CHAT_MESSAGE") {
                const msg = event.payload as SupportMessage;
                setMessages((prev) => {
                  if (prev.some((m) => m.id === msg.id)) return prev;
                  return [...prev, msg];
                });
                setIsOtherTyping(false);
              } else if (event.type === "CHAT_TYPING") {
                if (!event.payload.isSelf) {
                  setIsOtherTyping(event.payload.isTyping);
                }
              }
            }
          } catch (e) {
            console.error("WS parse error", e);
          }
        });
      },
    });

    client.activate();
    stompRef.current = client;

    return () => { client.deactivate(); };
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOtherTyping]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [replyText]);

  const handleSend = async () => {
    if (!replyText.trim() || sending) return;
    const content = replyText.trim();
    setReplyText("");
    setSending(true);
    
    try {
      const msg = await sendSupportReply(chatId, content);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Stop typing indicator immediately after sending
      sendTypingIndicator(chatId, false);
    } catch (e: any) {
      setError(e.message ?? "Failed to send reply");
      setReplyText(content); // Restore text on failure
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReplyText(e.target.value);
    
    // Debounced typing indicator
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    // Send "typing: true" if it's the first character or after a pause
    // We could optimize this to not send on every character, but for now simple debounce is fine
    sendTypingIndicator(chatId, true);
    
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(chatId, false);
    }, 3000);
  };

  function formatTime(iso: string | null) {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-5xl mx-auto bg-[#0d0d0d] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#121212]/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
              {chat?.userAvatar ? (
                <img src={chat.userAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={20} className="text-white/20" />
              )}
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white leading-tight">
                {chat?.userName ?? "Loading..."}
              </h1>
              <p className="text-xs text-white/40">
                {chat?.userHandle ? `@${chat.userHandle}` : "User Support"}
              </p>
            </div>
          </div>
        </div>
        
        <button className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition-all">
          <MoreVertical size={18} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 scrollbar-hide">
        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 1 ? "justify-end" : "justify-start"}`}>
                <div className={`h-12 w-48 rounded-2xl bg-white/5 animate-pulse ${i % 2 === 1 ? "rounded-br-sm" : "rounded-bl-sm"}`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <MessageCircle size={28} className="text-white/20" />
            </div>
            <p className="text-sm text-white/30 font-medium">No conversation history</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isAgent = msg.isSelf;
            return (
              <div key={msg.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                <div className={`flex flex-col ${isAgent ? "items-end" : "items-start"} max-w-[80%] lg:max-w-[70%]`}>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      isAgent
                        ? "bg-[#F5A623] text-black rounded-br-sm font-medium"
                        : "bg-[#1a1a1a] text-white/90 border border-white/5 rounded-bl-sm"
                    }`}
                  >
                    {msg.isDeleted ? (
                      <span className="italic opacity-50 text-xs">This message was deleted</span>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium tracking-wide ${isAgent ? "text-white/30 mr-1" : "text-white/30 ml-1"}`}>
                    {formatTime(msg.sentAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        
        {isOtherTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 bg-[#1a1a1a] border border-white/5 px-4 py-2 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce"></span>
              </div>
              <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">User is typing</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Input Area */}
      <div className="px-6 py-5 bg-[#121212]/50 border-t border-white/5">
        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
            <p className="text-xs text-red-400 font-medium">{error}</p>
            <button onClick={() => setError(null)} className="text-[10px] text-red-400/50 hover:text-red-400 uppercase font-bold tracking-widest">Dismiss</button>
          </div>
        )}
        
        <div className="flex items-end gap-3 bg-[#1a1a1a] border border-white/10 rounded-2xl p-2 focus-within:border-white/20 transition-all shadow-inner">
          <textarea
            ref={textareaRef}
            rows={1}
            value={replyText}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Write a message..."
            className="flex-1 bg-transparent border-none px-3 py-2 text-sm text-white placeholder-white/20 resize-none focus:ring-0 min-h-[40px] max-h-48 scrollbar-hide"
          />
          <button
            onClick={handleSend}
            disabled={!replyText.trim() || sending}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
              !replyText.trim() || sending
                ? "bg-white/5 text-white/20"
                : "bg-[#F5A623] text-black hover:scale-105 active:scale-95 shadow-lg shadow-[#F5A623]/20"
            }`}
          >
            <Send size={18} />
          </button>
        </div>
        <div className="mt-3 flex justify-between items-center px-1">
          <p className="text-[10px] text-white/20 font-medium uppercase tracking-widest">Press Enter to send, Shift + Enter for new line</p>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${stompRef.current?.connected ? "bg-green-500/50" : "bg-red-500/50"}`} />
            <span className="text-[10px] text-white/20 font-medium uppercase tracking-widest">
              {stompRef.current?.connected ? "Live Connection" : "Connecting..."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const MessageCircle = ({ size, className }: { size: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);
