import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { devicePersistOptions } from './persistence';

const DAY = 86_400_000;

type Opts = {
  globalCooldownDays?: number;
  onceOnly?: boolean;
};

type State = {
  lastPromptAt: number;
  promptedAt: Record<string, number>;
  answeredAt: Record<string, number>;
  recordPrompt: (context: string) => void;
  recordAnswered: (context: string) => void;
  canAutoPrompt: (context: string, opts?: Opts) => boolean;
};

export const useFeedbackPromptStore = create<State>()(
  persist(
    (set, get) => ({
      lastPromptAt: 0,
      promptedAt: {},
      answeredAt: {},

      recordPrompt: (context) =>
        set((s) => ({
          lastPromptAt: Date.now(),
          promptedAt: { ...s.promptedAt, [context]: Date.now() },
        })),

      recordAnswered: (context) =>
        set((s) => ({ answeredAt: { ...s.answeredAt, [context]: Date.now() } })),

      canAutoPrompt: (context, opts = {}) => {
        const { globalCooldownDays = 14, onceOnly = false } = opts;
        const now = Date.now();
        const s = get();
        if (globalCooldownDays > 0 && now - s.lastPromptAt < globalCooldownDays * DAY) return false;
        if (onceOnly && (s.promptedAt[context] || s.answeredAt[context])) return false;
        const answered = s.answeredAt[context];
        if (answered && now - answered < 60 * DAY) return false;
        return true;
      },
    }),
    // Device-scoped: this throttles the OS review prompt, which the OS itself
    // rate-limits per install. Key name kept so the cooldown survives upgrade.
    devicePersistOptions<State>({
      name: 'aza_feedback_prompt_v1',
      version: 1,
      partialize: (s) => ({
        lastPromptAt: s.lastPromptAt,
        promptedAt: s.promptedAt,
        answeredAt: s.answeredAt,
      }),
    }),
  ),
);
