import { create } from 'zustand';
import { 
  getContacts, 
  syncContacts, 
  searchContacts, 
  markContactFavorite, 
  unmarkContactFavorite,
  blockUser as blockUserApi,
  unblockUser as unblockUserApi,
  getBlockedUsers,
  addContact,
  getUserByHandle,
  searchUsersGlobal,
  requestContact as requestContactApi,
  approveContactRequest as approveContactRequestApi,
  rejectContactRequest as rejectContactRequestApi
} from '../services/api';
import { Contact, BlockedUser, PublicProfile, ContactRequest } from '../features/contacts/types';

interface ContactState {
  contacts: Contact[];
  contactRequests: ContactRequest[];
  blockedUsers: BlockedUser[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;

  // Actions
  fetchContacts: (page?: number, size?: number) => Promise<void>;
  syncDeviceContacts: (deviceContacts: any[]) => Promise<void>;
  search: (query: string) => Promise<Contact[]>;
  toggleFavorite: (contactId: string, isFavorite: boolean) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  fetchBlockedUsers: () => Promise<void>;
  addContactByUserId: (userId: string) => Promise<void>;
  findUserByHandle: (handle: string) => Promise<PublicProfile | null>;
  searchGlobal: (query: string) => Promise<PublicProfile[]>;
  requestContact: (userId: string) => Promise<void>;
  fetchContactRequests: () => Promise<void>;
  approveContactRequest: (requestId: string) => Promise<void>;
  rejectContactRequest: (requestId: string) => Promise<void>;
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  contactRequests: [],
  blockedUsers: [],
  isLoading: false,
  isSyncing: false,
  error: null,

  fetchContacts: async (page = 0, size = 100) => {
    try {
      set({ isLoading: true, error: null });
      const { data } = await getContacts(page, size);
      // Backend returns ApiResponse<Page<ContactResponse>>
      // Spring Data Page content is in data.data.content
      const contactList = data.data?.content || data.data || [];
      set({ contacts: contactList });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch contacts' });
    } finally {
      set({ isLoading: false });
    }
  },

  syncDeviceContacts: async (deviceContacts: any[]) => {
    try {
      set({ isSyncing: true, error: null });
      const { data } = await syncContacts(deviceContacts);
      const syncedContacts = data.data?.contacts || [];
      
      // Update local contacts with synced ones
      set((state) => {
        const existingIds = new Set(state.contacts.map(c => c.id));
        const newContacts = syncedContacts.filter((c: Contact) => !existingIds.has(c.id));
        return { 
          contacts: [...state.contacts, ...newContacts],
          isSyncing: false 
        };
      });
    } catch (error: any) {
      set({ error: error.message || 'Failed to sync contacts', isSyncing: false });
    }
  },

  search: async (query: string) => {
    try {
      const { data } = await searchContacts(query);
      return data.data?.content || data.data || [];
    } catch (error) {
      console.error('Search failed', error);
      return [];
    }
  },

  toggleFavorite: async (contactId: string, isFavorite: boolean) => {
    try {
      if (isFavorite) {
        await unmarkContactFavorite(contactId);
      } else {
        await markContactFavorite(contactId);
      }
      
      // Update local state
      set((state) => ({
        contacts: state.contacts.map(c => 
          c.id === contactId ? { ...c, isFavorite: !isFavorite } : c
        )
      }));
    } catch (error) {
      console.error('Failed to toggle favorite', error);
    }
  },

  blockUser: async (userId: string) => {
    try {
      await blockUserApi(userId);
      // Refresh contacts and blocked users
      await get().fetchBlockedUsers();
      await get().fetchContacts();
    } catch (error) {
      console.error('Failed to block user', error);
    }
  },

  unblockUser: async (userId: string) => {
    try {
      await unblockUserApi(userId);
      await get().fetchBlockedUsers();
    } catch (error) {
      console.error('Failed to unblock user', error);
    }
  },

  fetchBlockedUsers: async () => {
    try {
      const { data } = await getBlockedUsers();
      set({ blockedUsers: data.data || [] });
    } catch (error) {
      console.error('Failed to fetch blocked users', error);
    }
  },

  addContactByUserId: async (userId: string) => {
    try {
      set({ isLoading: true });
      await addContact(userId);
      await get().fetchContacts();
    } catch (error: any) {
      set({ error: error.message || 'Failed to add contact' });
    } finally {
      set({ isLoading: false });
    }
  },

  findUserByHandle: async (handle: string): Promise<PublicProfile | null> => {
    try {
      const { data } = await getUserByHandle(handle);
      return data.data; // Public profile
    } catch (error) {
      console.error('Failed to find user by handle', error);
      return null;
    }
  },

  searchGlobal: async (query: string): Promise<PublicProfile[]> => {
    try {
      if (!query || query.length < 2) return [];
      const { data } = await searchUsersGlobal(query);
      return data.data?.content || data.data || [];
    } catch (error) {
      console.error('Global search failed', error);
      return [];
    }
  },

  requestContact: async (userId: string) => {
    try {
      set({ isLoading: true });
      await requestContactApi(userId);
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Failed to send contact request';
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ isLoading: false });
    }
  },

  approveContactRequest: async (requestId: string) => {
    try {
      set({ isLoading: true });
      await approveContactRequestApi(requestId);
      await get().fetchContacts();
      await get().fetchContactRequests();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Failed to approve request';
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ isLoading: false });
    }
  },

  rejectContactRequest: async (requestId: string) => {
    try {
      set({ isLoading: true });
      await rejectContactRequestApi(requestId);
      await get().fetchContactRequests();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Failed to reject request';
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchContactRequests: async () => {
    try {
      const { getContactRequests } = require('../services/api');
      const { data } = await getContactRequests();
      set({ contactRequests: data.data || [] });
    } catch (error) {
      console.error('Failed to fetch contact requests', error);
    }
  }
}));
