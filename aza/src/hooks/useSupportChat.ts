import { useState, useEffect, useCallback, useRef } from 'react';
import { getOrCreateSupportChat, getSupportMessages, sendSupportMessage, BASE_URL, TOKEN_KEY } from '../services/api';
import * as SecureStore from 'expo-secure-store';

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
  const ws = useRef<WebSocket | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await getSupportMessages();
      const page = res.data?.data ?? res.data;
      const formatted: Message[] = (page?.content ?? []).map((m: any) => ({
        id: m.id,
        text: m.content ?? '',
        isSender: m.isSelf ?? false,
        timestamp: m.sentAt ? new Date(m.sentAt).getTime() : Date.now(),
      })).reverse();
      setMessages(formatted);
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

      const wsUrl = BASE_URL.replace('https', 'wss').replace('http', 'ws') + '/ws/websocket';
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        const connectFrame = `CONNECT\naccept-version:1.2\nhost:localhost\nAuthorization:Bearer ${token}\n\n\0`;
        socket.send(connectFrame);
      };

      socket.onmessage = (event) => {
        const data = event.data as string;
        if (data.startsWith('CONNECTED')) {
          const subFrame = `SUBSCRIBE\nid:sub-0\ndestination:/user/queue/chat\n\n\0`;
          socket.send(subFrame);
        } else if (data.includes('MESSAGE')) {
          const bodyStart = data.indexOf('\n\n') + 2;
          const bodyEnd = data.lastIndexOf('\0');
          const body = data.slice(bodyStart, bodyEnd > bodyStart ? bodyEnd : data.length);
          try {
            const msg = JSON.parse(body);
            if (msg.payload?.chatId === id) {
              if (msg.type === 'CHAT_MESSAGE') {
                const p = msg.payload;
                setMessages((prev) => {
                  if (prev.some((m) => m.id === p.id)) return prev;
                  return [
                    ...prev,
                    {
                      id: p.id,
                      text: p.content ?? '',
                      isSender: p.isSelf ?? false,
                      timestamp: p.sentAt ? new Date(p.sentAt).getTime() : Date.now(),
                    },
                  ];
                });
                setIsOtherTyping(false);
              } else if (msg.type === 'CHAT_TYPING') {
                if (!msg.payload.isSelf) {
                  setIsOtherTyping(msg.payload.isTyping);
                }
              }
            }
          } catch (e) {
            console.error('Failed to parse WS message', e);
          }
        }
      };

      socket.onerror = (e) => console.error('WS Error', e);
      socket.onclose = () => {
        setTimeout(() => connectWebSocket(id), 5000);
      };

      ws.current = socket;
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
      if (ws.current) ws.current.close();
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

  return { messages, loading, sendMessage, isOtherTyping, sendTypingStatus };
};
