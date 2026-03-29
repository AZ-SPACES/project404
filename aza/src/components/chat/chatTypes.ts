// ----------------------------------------------------------------------------
// Shared types
// ----------------------------------------------------------------------------
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  time: string;
  timestamp: number;
  status?: MessageStatus;
  replyTo?: string;
  type?: 'text' | 'image' | 'document';
  uri?: string;
  mimeType?: string;
  fileSize?: number;
  fileName?: string;
}

export type MoreAction = { icon: string; label: string; color?: string; onPress: () => void };

export type MenuAnchor = { top: number; right: number };

export type AttachmentAnchor = { top: number; left: number; buttonWidth: number };

// ----------------------------------------------------------------------------
// Module-level constants
// ----------------------------------------------------------------------------
export const AUTO_REPLIES = [
  'Okay, got it!',
  'Sure, no problem.',
  'Let me check and get back to you.',
  'Sounds good! 👍',
  'Alright, will do.',
] as const;

export const ATTACHMENT_TILES = [
  { icon: 'image', label: 'Photos', color: '#6366F1' },
  { icon: 'camera', label: 'Camera', color: '#0EA5E9' },
  { icon: 'file-text', label: 'Document', color: '#F59E0B' },
] as const;

export const MENU_WIDTH = 260;

export const INITIAL_MESSAGES: Message[] = [
  { id: '1', text: "I'm supposed to send your money. I will send it tomorrow, 7pm.", sender: 'other', time: '9:30 AM', timestamp: Date.now() - 3600000, type: 'text' },
  { id: '2', text: 'Will be waiting.', sender: 'me', time: '9:35 AM', timestamp: Date.now() - 3000000, status: 'read', type: 'text' },
  { id: '3', text: 'Thanks.', sender: 'other', time: '9:40 AM', timestamp: Date.now() - 2400000, type: 'text' },
];

// ----------------------------------------------------------------------------
// Date helpers
// ----------------------------------------------------------------------------
export const isSameDay = (d1: number, d2: number): boolean => {
  const a = new Date(d1);
  const b = new Date(d2);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

export const formatDateHeader = (timestamp: number): string => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(timestamp, today.getTime())) return 'Today';
  if (isSameDay(timestamp, yesterday.getTime())) return 'Yesterday';
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatTime = (): string =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ----------------------------------------------------------------------------
// Document helpers
// ----------------------------------------------------------------------------
export const getDocIcon = (mime?: string): { name: string; color: string } => {
  if (!mime) return { name: 'file', color: '#6B7280' };
  if (mime.includes('pdf')) return { name: 'file-text', color: '#EF4444' };
  if (mime.includes('word') || mime.includes('document')) return { name: 'file-text', color: '#2563EB' };
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return { name: 'file', color: '#16A34A' };
  if (mime.includes('audio')) return { name: 'music', color: '#7C3AED' };
  if (mime.includes('video')) return { name: 'video', color: '#0EA5E9' };
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('archive')) return { name: 'archive', color: '#F59E0B' };
  if (mime.includes('image')) return { name: 'image', color: '#6366F1' };
  return { name: 'file', color: '#6B7280' };
};

export const formatBytes = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};
