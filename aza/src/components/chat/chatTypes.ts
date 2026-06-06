import * as FileSystem from 'expo-file-system';

// ----------------------------------------------------------------------------
// Shared types
// ----------------------------------------------------------------------------
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export type ReplyInfo = {
  id: string;
  text: string;
  sender: 'me' | 'other';
};

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  time: string;
  timestamp: number;
  status?: MessageStatus;
  replyTo?: string;
  replyToMessage?: ReplyInfo;
  type?: 'text' | 'image' | 'document' | 'audio' | 'video' | 'payment' | 'location' | 'contact' | 'poll' | 'call';
  latitude?: number | undefined;
  longitude?: number | undefined;
  locationName?: string | undefined;
  uri?: string | undefined;
  mimeType?: string | undefined;
  fileSize?: number | undefined;
  fileName?: string | undefined;
  caption?: string | undefined;
  duration?: number | undefined;
  isStarred?: boolean | undefined;
  isEdited?: boolean | undefined;
  isForwarded?: boolean | undefined;
  expiresAt?: number | null;
  resolvedSize?: number | undefined;
  paymentAmount?: number | undefined;
  paymentMode?: 'send' | 'request' | undefined;
  paymentStatus?: 'pending' | 'paid' | 'declined' | undefined;
  thumbnailUri?: string | undefined;
  contactCardName?: string | undefined;
  contactCardAvatar?: string | undefined;
  contactCardHandle?: string | undefined;
  pollQuestion?: string | undefined;
  pollOptions?: string[] | undefined;
  callMissed?: boolean | undefined;
  callDuration?: number | undefined;
  callType?: 'voice' | 'video' | undefined;
}

export type CategoryStats = { size: number; messages: Message[] };

export type StorageDetails = {
  photos: CategoryStats;
  videos: CategoryStats;
  docs: CategoryStats;
  audio: CategoryStats;
  totalSize: number;
};


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

export const INITIAL_MESSAGES: Message[] = [];

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

// ----------------------------------------------------------------------------
// Contacts Data
// ----------------------------------------------------------------------------
export interface Contact {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  avatar: string;
  isFavorite?: boolean;
  isArchived?: boolean;
}

export const CONTACTS: Contact[] = [
  {
    id: "1",
    name: "Michael Owusu Addo",
    lastMessage: "Thanks.",
    time: "2mins",
    unread: 0,
    online: true,
    avatar: "https://i.pravatar.cc/150?u=michael",
    isFavorite: true,
  },
  {
    id: "2",
    name: "Serwaa Amihere",
    lastMessage: "Did you receive the package?",
    time: "",
    unread: 1,
    online: true,
    avatar: "https://i.pravatar.cc/150?u=serwaa",
  },
  {
    id: "3",
    name: "Joselyn Dumas",
    lastMessage: "Okay, great!",
    time: "",
    unread: 2,
    online: true,
    avatar: "https://i.pravatar.cc/150?u=joselyn",
    isFavorite: true,
  },
  {
    id: "4",
    name: "Kwame Nkrumah",
    lastMessage: "I'm still waiting for the payment.",
    time: "30sec",
    unread: 0,
    online: false,
    avatar: "https://i.pravatar.cc/150?u=kwame",
  },
  {
    id: "5",
    name: "John Dumelo",
    lastMessage: "The funds should be ...",
    time: "1min",
    unread: 0,
    online: false,
    avatar: "https://i.pravatar.cc/150?u=john",
  },
  {
    id: "6",
    name: "Samuel Nartey George",
    lastMessage: "Sure hahaha",
    time: "45sec",
    unread: 0,
    online: false,
    avatar: "https://i.pravatar.cc/150?u=samuel",
    isArchived: true,
  },
];

export const formatBytes = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

// ----------------------------------------------------------------------------
// Storage helpers
// ----------------------------------------------------------------------------
export const calculateStorageAsync = async (messages: Message[]): Promise<StorageDetails> => {
  const details: StorageDetails = {
    photos: { size: 0, messages: [] },
    videos: { size: 0, messages: [] },
    docs: { size: 0, messages: [] },
    audio: { size: 0, messages: [] },
    totalSize: 0,
  };

  const promises = messages.map(async (m) => {
    let size = m.fileSize || 0;
    
    // If no explicit fileSize, try to fetch it if there is a local URI
    if (!size && m.uri && !m.uri.startsWith('http')) {
      try {
        const info = await FileSystem.getInfoAsync(m.uri);
        if (info.exists && !info.isDirectory) {
          size = info.size;
        }
      } catch (err) {
        // Fallback
      }
    } 
    
    // Final fallback estimation for mock items
    if (!size) {
      if (m.type === 'image') size = 2.5 * 1024 * 1024;
      else if (m.type === 'video') size = 15 * 1024 * 1024;
      else if (m.type === 'audio') size = Math.max(1, m.duration || 5) * 10 * 1024;
    }

    if (size > 0) {
      const updatedMsg = { ...m, resolvedSize: size };
      details.totalSize += size;
      if (m.type === 'image') {
        details.photos.size += size;
        details.photos.messages.push(updatedMsg);
      } else if (m.type === 'video') {
        details.videos.size += size;
        details.videos.messages.push(updatedMsg);
      } else if (m.type === 'document') {
        details.docs.size += size;
        details.docs.messages.push(updatedMsg);
      } else if (m.type === 'audio') {
        details.audio.size += size;
        details.audio.messages.push(updatedMsg);
      }
    }
  });

  await Promise.all(promises);

  return details;
};
