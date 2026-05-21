export interface Contact {
  id: string;
  contactUserId?: string;
  displayName: string;
  phoneNumber?: string;
  email?: string;
  isAzaUser: boolean;
  isFavorite: boolean;
  profileImageUrl?: string;
  handle?: string;
}

export interface BlockedUser {
  blockedUserId: string;
  displayName: string;
  handle?: string;
  profileImageUrl?: string;
  blockedAt?: string;
}

export interface ContactSyncResponse {
  totalSynced: number;
  azaUsersFound: number;
  contacts: Contact[];
}

export interface PublicProfile {
  id: string;
  displayName: string;
  handle: string;
  profileImageUrl?: string;
  onlineStatus?: string;
}

export interface ContactRequest {
  id: string;
  senderUserId: string;
  receiverUserId: string;
  status: string;
  senderDisplayName: string;
  senderUsername: string;
  senderProfileImageUrl?: string;
  createdAt: string;
}

export interface SentContactRequest {
  id: string;
  receiverUserId: string;
  receiverDisplayName: string;
  receiverUsername: string;
  receiverProfileImageUrl?: string;
  status: string;
  createdAt: string;
}
