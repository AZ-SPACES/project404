import 'fast-text-encoding';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getOrCreateSupportChat, getSupportMessages, sendSupportMessage, BASE_URL, TOKEN_KEY } from '../services/api';
import * as SecureStore from 'expo-secure-store';
import { Client } from '@stomp/stompjs';

export interface Message {
  id: string;
  text: string;
  isSender: boolean;
  timestamp: number;
  imageUri?: string;
}

export const useSupportChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatId, setChatId] = useState<string | null>(null);
  const clientRef = useRef<Client | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const res = await getSupportMessages(0, 100);
      const page = res.data?.data ?? res.data;
      const fetched: Message[] = (page?.content ?? []).map((m: any) => ({
        id: m.id,
        text: m.content ?? '',
        isSender: m.isSelf ?? false,
        timestamp: m.sentAt ? new Date(m.sentAt).getTime() : Date.now(),
      })).reverse();
      
      setMessages((prev) => {
        const map = new Map(prev.map(m => [m.id, m]));
        fetched.forEach(m => map.set(m.id, m));
        return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
      });
    } catch (err) {
      console.error('Failed to load support messages', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const connectWebSocket = useCallback(async (id: string) => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) return;

      // Ensure proper protocol
      let wsUrl = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');
      if (!wsUrl.endsWith('/')) wsUrl += '/';
      wsUrl += 'ws/websocket';
      
      const client = new Client({
        brokerURL: wsUrl,
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        forceBinaryWSFrames: true,
        appendMissingNULLonIncoming: true,
        onConnect: () => {
          client.subscribe("/user/queue/chat", (frame) => {
            try {
              const msg = JSON.parse(frame.body);
              if (msg.payload?.chatId !== id) return;
              
              if (msg.type === "CHAT_MESSAGE") {
                const p = msg.payload;
                setMessages((prev) => {
                  if (prev.some((m) => m.id === p.id)) return prev;
                  return [
                    ...prev,
                    {
                      id: p.id,
                      text: p.content ?? "",
                      isSender: p.isSelf ?? false,
                      timestamp: p.sentAt ? new Date(p.sentAt).getTime() : Date.now(),
                    },
                  ];
                });
                setIsOtherTyping(false);
              } else if (msg.type === "CHAT_TYPING") {
                if (!msg.payload.isSelf) {
                  setIsOtherTyping(msg.payload.isTyping);
                }
              }
            } catch (e) {
              console.error("Failed to parse WS message", e);
            }
          });
        },
        onStompError: (frame) => {
          console.error("Broker reported error: " + frame.headers["message"]);
          console.error("Additional details: " + frame.body);
        },
        onWebSocketError: (event) => {
          console.error("WebSocket Error: ", event);
        }
      });

      client.activate();
      clientRef.current = client;
    } catch (err) {
      console.error('WS Connection failed', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await getOrCreateSupportChat();
        const payload = res.data?.data ?? res.data;
        const id: string = payload?.chatId ?? payload?.id;
        setChatId(id);
        await loadHistory();
        if (id) connectWebSocket(id);
      } catch (err) {
        console.error('Failed to init support chat', err);
        setLoading(false);
      }
    };

    init();

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, [loadHistory, connectWebSocket]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    try {
      const res = await sendSupportMessage(text.trim());
      const p = res.data?.data ?? res.data;
      const newMsg: Message = {
        id: p.id,
        text: p.content ?? text,
        isSender: true,
        timestamp: p.sentAt ? new Date(p.sentAt).getTime() : Date.now(),
      };
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setIsOtherTyping(false);
    } catch (err) {
      console.error('Failed to send support message', err);
      throw err;
    }
  }, []);

  const sendTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!chatId) return;
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      await fetch(`${BASE_URL}/api/v1/chats/typing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ chatId, isTyping })
      });
    } catch (err) {
      console.error('Failed to send typing status', err);
    }
  }, [chatId]);

  return { messages, loading, sendMessage, isOtherTyping, sendTypingStatus, loadHistory };
};
