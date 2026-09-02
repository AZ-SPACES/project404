/**
 * Contacts, contact requests and the block list — all server state, so React
 * Query owns them.
 *
 * This replaces `contactStore`, which kept its own copies of these arrays in
 * Zustand and refilled them via `queryClient.fetchQuery`. Two caches for one
 * fact meant invalidation didn't reach the UI: a `CONTACT_REQUEST_ACCEPTED`
 * push called `invalidateQueries({ queryKey: queryKeys.contacts() })`, which
 * only marked a query nobody observed as stale, while the screens went on
 * rendering the untouched Zustand array. Contacts accepted elsewhere didn't
 * appear until something happened to call `fetchContacts()` again.
 *
 * With the query as the single source, the same invalidation now refetches and
 * re-renders on its own — from a push, from a mutation, from anywhere.
 */

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getContacts,
  getContactRequests,
  searchContacts as searchContactsApi,
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
import type {
  Contact,
  BlockedUser,
  PublicProfile,
  ContactRequest,
  SentContactRequest,
} from '../features/contacts/types';
import { queryKeys } from '../lib/queryKeys';
import { extractErrorMessage } from '../utils/errorUtils';
import { useAuth } from '../providers/AuthProvider';

/** Stable empty arrays — a fresh `[]` default would change identity every render. */
const NO_CONTACTS: Contact[] = [];
const NO_REQUESTS: ContactRequest[] = [];
const NO_SENT_REQUESTS: SentContactRequest[] = [];
const NO_BLOCKED: BlockedUser[] = [];

/**
 * One page size for the whole app. These screens all want "my contacts", and
 * they share a single query key — so a per-caller size would mean whichever
 * screen mounted last silently decided how many everyone else saw.
 */
const CONTACTS_PAGE_SIZE = 200;

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useContacts() {
  const { userToken } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.contacts(),
    queryFn: async (): Promise<Contact[]> => {
      const { data } = await getContacts(0, CONTACTS_PAGE_SIZE);
      return data.data?.content || data.data || [];
    },
    enabled: !!userToken,
  });

  return {
    contacts: data ?? NO_CONTACTS,
    isLoading,
    error: error ? extractErrorMessage(error, 'Failed to fetch contacts') : null,
    refetch,
  };
}

export function useContactRequests() {
  const { userToken } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.contactRequests(),
    queryFn: async (): Promise<ContactRequest[]> => {
      const { data } = await getContactRequests();
      return data.data?.content || data.data || [];
    },
    enabled: !!userToken,
  });

  return { contactRequests: data ?? NO_REQUESTS, isLoading, refetch };
}

export function useSentContactRequests() {
  const { userToken } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.sentContactRequests(),
    queryFn: async (): Promise<SentContactRequest[]> => {
      const { data } = await getSentContactRequests();
      return data.data?.content || data.data || [];
    },
    enabled: !!userToken,
  });

  return { sentContactRequests: data ?? NO_SENT_REQUESTS, isLoading, refetch };
}

export function useBlockedUsers() {
  const { userToken } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.blockedUsers(),
    queryFn: async (): Promise<BlockedUser[]> => {
      const { data } = await getBlockedUsers();
      return data.data || [];
    },
    enabled: !!userToken,
  });

  return { blockedUsers: data ?? NO_BLOCKED, isLoading, refetch };
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Contact mutations. Each one invalidates the queries it affects, which is now
 * enough on its own — the screens observe those queries directly.
 */
export function useContactActions() {
  const queryClient = useQueryClient();

  const invalidate = useCallback(
    (...keys: readonly (readonly unknown[])[]) => {
      for (const queryKey of keys) queryClient.invalidateQueries({ queryKey });
    },
    [queryClient],
  );

  /**
   * Optimistic, with a real rollback. The old version mutated a Zustand copy
   * and invalidated the query separately, so a failed request rolled back one
   * cache and left the other holding the opposite value.
   */
  const { mutateAsync: toggleFavorite } = useMutation({
    mutationFn: async ({ contactId, isFavorite }: { contactId: string; isFavorite: boolean }) => {
      if (isFavorite) await unmarkContactFavorite(contactId);
      else await markContactFavorite(contactId);
    },
    onMutate: async ({ contactId, isFavorite }) => {
      const queryKey = queryKeys.contacts();
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Contact[]>(queryKey);
      queryClient.setQueryData<Contact[]>(queryKey, (current) =>
        (current ?? []).map((c) => (c.id === contactId ? { ...c, isFavorite: !isFavorite } : c)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.contacts(), context.previous);
    },
    onSettled: () => invalidate(queryKeys.contacts()),
  });

  const { mutateAsync: blockUser } = useMutation({
    mutationFn: (userId: string) => blockUserApi(userId),
    onSuccess: () => invalidate(queryKeys.contacts(), queryKeys.blockedUsers()),
  });

  const { mutateAsync: unblockUser } = useMutation({
    mutationFn: (userId: string) => unblockUserApi(userId),
    onSuccess: () => invalidate(queryKeys.contacts(), queryKeys.blockedUsers()),
  });

  const { mutateAsync: addContactByUserId } = useMutation({
    mutationFn: (userId: string) => addContact(userId),
    onSuccess: () => invalidate(queryKeys.contacts(), queryKeys.contactRequests()),
  });

  const { mutateAsync: requestContact } = useMutation({
    mutationFn: (userId: string) => requestContactApi(userId),
    onSuccess: () => invalidate(queryKeys.sentContactRequests()),
    onError: (error) => {
      throw new Error(extractErrorMessage(error, 'Failed to send contact request'));
    },
  });

  const { mutateAsync: approveContactRequest } = useMutation({
    mutationFn: (requestId: string) => approveContactRequestApi(requestId),
    onSuccess: () => invalidate(queryKeys.contacts(), queryKeys.contactRequests()),
    onError: (error) => {
      throw new Error(extractErrorMessage(error, 'Failed to approve request'));
    },
  });

  const { mutateAsync: rejectContactRequest } = useMutation({
    mutationFn: (requestId: string) => rejectContactRequestApi(requestId),
    onSuccess: () => invalidate(queryKeys.contactRequests()),
    onError: (error) => {
      throw new Error(extractErrorMessage(error, 'Failed to reject request'));
    },
  });

  return {
    toggleFavorite: useCallback(
      (contactId: string, isFavorite: boolean) => toggleFavorite({ contactId, isFavorite }),
      [toggleFavorite],
    ),
    blockUser,
    unblockUser,
    addContactByUserId,
    requestContact,
    approveContactRequest,
    rejectContactRequest,
  };
}

// ─── One-shot lookups ────────────────────────────────────────────────────────
// Searches are typed into a box and thrown away; caching them by query string
// would fill the cache with entries nothing reads again.

export async function findUserByHandle(handle: string): Promise<PublicProfile | null> {
  try {
    const { data } = await getUserByHandle(handle);
    return data.data;
  } catch (error) {
    console.error('Failed to find user by handle', error);
    return null;
  }
}

export async function searchGlobal(query: string): Promise<PublicProfile[]> {
  try {
    if (!query || query.length < 2) return [];
    const { data } = await searchUsersGlobal(query);
    return data.data?.content || data.data || [];
  } catch (error) {
    console.error('Global search failed', error);
    return [];
  }
}

export async function searchContacts(query: string): Promise<Contact[]> {
  try {
    const { data } = await searchContactsApi(query);
    return data.data?.content || data.data || [];
  } catch (error) {
    console.error('Search failed', error);
    return [];
  }
}
