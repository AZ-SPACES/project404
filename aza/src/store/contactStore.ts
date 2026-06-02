import { create } from 'zustand';
import {
  getContacts,
  getContactRequests,
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
  rejectContactRequest as rejectContactRequestApi,
  getSentContactRequests,
} from '../services/api';
import { Contact, BlockedUser, PublicProfile, ContactRequest, SentContactRequest } from '../features/contacts/types';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queryKeys';

interface ContactState {
  contacts: Contact[];
  contactRequests: ContactRequest[];
  sentContactRequests: SentContactRequest[];
  blockedUsers: BlockedUser[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchContacts: (page?: number, size?: number) => Promise<void>;
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
  fetchSentContactRequests: () => Promise<void>;
  approveContactRequest: (requestId: string) => Promise<void>;
  rejectContactRequest: (requestId: string) => Promise<void>;
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  contactRequests: [],
  sentContactRequests: [],
  blockedUsers: [],
  isLoading: false,
  error: null,

  fetchContacts: async (page = 0, size = 100) => {
    try {
      set({ isLoading: true, error: null });
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.contacts(),
        queryFn: async () => {
          const { data } = await getContacts(page, size);
          return data.data?.content || data.data || [];
        },
        staleTime: 30_000,
      });
      set({ contacts: data });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch contacts' });
    } finally {
      set({ isLoading: false });
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
    // Optimistic update
    set((state) => ({
      contacts: state.contacts.map(c =>
        c.id === contactId ? { ...c, isFavorite: !isFavorite } : c
      ),
    }));
    try {
      if (isFavorite) {
        await unmarkContactFavorite(contactId);
      } else {
        await markContactFavorite(contactId);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts() });
    } catch (error) {
      // Roll back optimistic update
      set((state) => ({
        contacts: state.contacts.map(c =>
          c.id === contactId ? { ...c, isFavorite } : c
        ),
      }));
      console.error('Failed to toggle favorite', error);
    }
  },

  blockUser: async (userId: string) => {
    try {
      await blockUserApi(userId);
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.blockedUsers() });
      await get().fetchBlockedUsers();
      await get().fetchContacts();
    } catch (error) {
      console.error('Failed to block user', error);
    }
  },

  unblockUser: async (userId: string) => {
    try {
      await unblockUserApi(userId);
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.blockedUsers() });
      await get().fetchBlockedUsers();
    } catch (error) {
      console.error('Failed to unblock user', error);
    }
  },

  fetchBlockedUsers: async () => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.blockedUsers(),
        queryFn: async () => {
          const { data } = await getBlockedUsers();
          return data.data || [];
        },
        staleTime: 30_000,
      });
      set({ blockedUsers: data });
    } catch (error) {
      console.error('Failed to fetch blocked users', error);
    }
  },

  addContactByUserId: async (userId: string) => {
    try {
      set({ isLoading: true });
      await addContact(userId);
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.contactRequests() });
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
      return data.data;
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
      queryClient.invalidateQueries({ queryKey: queryKeys.sentContactRequests() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.contactRequests() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.contactRequests() });
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
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.contactRequests(),
        queryFn: async () => {
          const { data } = await getContactRequests();
          return data.data || [];
        },
        staleTime: 30_000,
      });
      set({ contactRequests: data });
    } catch (error) {
      console.error('Failed to fetch contact requests', error);
    }
  },

  fetchSentContactRequests: async () => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.sentContactRequests(),
        queryFn: async () => {
          const { data } = await getSentContactRequests();
          return data.data || [];
        },
        staleTime: 30_000,
      });
      set({ sentContactRequests: data });
    } catch (error) {
      console.error('Failed to fetch sent contact requests', error);
    }
  },
}));
