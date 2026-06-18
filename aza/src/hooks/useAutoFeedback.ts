import { useState, useCallback } from 'react';
import { useProfile } from '../providers/ProfileProvider';
import { useFeedbackPromptStore } from '../store/feedbackPromptStore';

type Opts = { globalCooldownDays?: number; onceOnly?: boolean };

export function useAutoFeedback(context: string, opts?: Opts) {
  const { notificationPreferences } = useProfile();
  const [visible, setVisible] = useState(false);
  const canAutoPrompt = useFeedbackPromptStore((s) => s.canAutoPrompt);
  const recordPrompt = useFeedbackPromptStore((s) => s.recordPrompt);
  const recordAnswered = useFeedbackPromptStore((s) => s.recordAnswered);

  const tryPrompt = useCallback(() => {
    const prefs = notificationPreferences;
    // Full opt-out: both feedback channels switched off in notification settings.
    const optedOut = !!prefs && prefs.feedbackEmail === false && prefs.feedbackPush === false;
    if (optedOut) return false;
    if (!canAutoPrompt(context, opts)) return false;
    recordPrompt(context);
    setVisible(true);
    return true;
  }, [notificationPreferences, canAutoPrompt, recordPrompt, context, opts]);

  const close = useCallback(() => setVisible(false), []);
  const onSubmitted = useCallback(() => recordAnswered(context), [recordAnswered, context]);

  return { visible, tryPrompt, close, onSubmitted };
}
