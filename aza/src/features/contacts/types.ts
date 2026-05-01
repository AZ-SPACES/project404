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
