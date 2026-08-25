"use client";

import { createContext, useContext } from "react";
import type { SuperAgentMe } from "@/lib/superagent-api";

export type Session = {
  me: SuperAgentMe | null;
  /** Re-reads the master's profile — call it after anything that changes their float. */
  refresh: () => Promise<void>;
};

const SessionContext = createContext<Session>({
  me: null,
  refresh: async () => {},
});

export const SessionProvider = SessionContext.Provider;

/**
 * The shell owns the master's profile and shows their float in the header. Any page that moves
 * float has to be able to tell it to re-read, or the header keeps showing the balance from
 * before the movement — at exactly the moment the operator looks at it to decide what to send
 * next.
 */
export function useSession(): Session {
  return useContext(SessionContext);
}
