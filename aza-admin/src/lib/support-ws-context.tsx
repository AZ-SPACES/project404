"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Client } from "@stomp/stompjs";
import * as SockJS from "sockjs-client";
import { getToken, SupportChatSummary } from "@/lib/admin-api";

const BASE_WS_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface SupportWsContextValue {
  unreadCount: number;
  clearUnread: () => void;
  addInboxListener: (fn: InboxListener) => void;
  removeInboxListener: (fn: InboxListener) => void;
}

type InboxListener = (summary: SupportChatSummary) => void;

const SupportWsContext = createContext<SupportWsContextValue>({
  unreadCount: 0,
  clearUnread: () => {},
  addInboxListener: () => {},
  removeInboxListener: () => {},
});

export function useSupportWs() {
  return useContext(SupportWsContext);
}

function requestBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function showBrowserNotification(userName: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.hasFocus()) return;
  try {
    new Notification("New support message", {
      body: `${userName} sent a message — check the inbox`,
      icon: "/favicon.ico",
      tag: "aza-support-inbox",
    });
  } catch {
    // Ignore — some browsers block programmatic notifications
  }
}

export function SupportWsProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const listenersRef = useRef<Set<InboxListener>>(new Set());

  useEffect(() => {
    requestBrowserNotificationPermission();
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const client = new Client({
      webSocketFactory: () => new (SockJS as any)(`${BASE_WS_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe("/topic/admin/support", (frame) => {
          try {
            const event = JSON.parse(frame.body) as {
              type: string;
              payload: SupportChatSummary;
            };
            if (
              event.type !== "SUPPORT_NEW_MESSAGE" &&
              event.type !== "SUPPORT_CHAT_UPDATED"
            )
              return;

            const summary = event.payload;

            // Notify all inbox-page listeners
            listenersRef.current.forEach((fn) => fn(summary));

            // Badge + browser notification only for new user messages
            if (event.type === "SUPPORT_NEW_MESSAGE") {
              setUnreadCount((c) => c + 1);
              showBrowserNotification(summary.userName ?? "Customer");
            }
          } catch {
            // Ignore malformed frames
          }
        });
      },
    });

    client.activate();
    return () => { client.deactivate(); };
  }, []);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  const addInboxListener = useCallback((fn: InboxListener) => {
    listenersRef.current.add(fn);
  }, []);

  const removeInboxListener = useCallback((fn: InboxListener) => {
    listenersRef.current.delete(fn);
  }, []);

  return (
    <SupportWsContext.Provider
      value={{ unreadCount, clearUnread, addInboxListener, removeInboxListener }}
    >
      {children}
    </SupportWsContext.Provider>
  );
}
