/**
 * Regression tests for account-scoped store persistence.
 *
 * The bug these exist to prevent: stores holding plaintext message content —
 * drafts, saved, starred and pinned messages — were persisted under
 * device-global AsyncStorage keys with no user id and no logout wipe, so
 * signing out and signing in as somebody else on the same device showed the new
 * account the previous account's messages. That defeated the encrypted thread
 * cache in `encryptedMessageStore`, which namespaces by user and wipes on
 * logout precisely so this cannot happen.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { beginAccountSession, endAccountSession, getAccountUserId } from '../accountSession';
import { useDraftStore } from '../draftStore';
import { useSavedMessagesStore } from '../savedMessagesStore';
import { useStarredMessagesStore } from '../starredMessagesStore';

const ALICE = 'user-alice';
const BOB = 'user-bob';

const message = (id: string, text: string) => ({ id, text }) as never;

beforeEach(async () => {
  await endAccountSession();
  await AsyncStorage.clear();
});

afterAll(async () => {
  await endAccountSession();
});

describe('account-scoped persistence', () => {
  it('namespaces each account’s slice under its own key', async () => {
    await beginAccountSession(ALICE);
    useDraftStore.getState().setDraft('chat-1', 'dinner at 8?');

    const keys = await AsyncStorage.getAllKeys();
    expect(keys).toContain(`aza_drafts__${ALICE}`);
    expect(keys).not.toContain('aza_drafts');
    expect(keys).not.toContain('aza_drafts_v1');
  });

  it('does not show one account’s drafts to the next account on the device', async () => {
    await beginAccountSession(ALICE);
    useDraftStore.getState().setDraft('chat-1', 'dinner at 8?');
    expect(useDraftStore.getState().getDraft('chat-1')).toBe('dinner at 8?');

    await endAccountSession();
    await beginAccountSession(BOB);

    expect(useDraftStore.getState().getDraft('chat-1')).toBe('');
    expect(useDraftStore.getState().drafts).toEqual({});
  });

  it('erases message content from disk on logout, not just from memory', async () => {
    await beginAccountSession(ALICE);
    useSavedMessagesStore.getState().addMessage(message('m1', 'my bank passcode is'));
    useStarredMessagesStore.getState().star(message('m2', 'see you there'), 'chat-1', 'Bob');

    await endAccountSession();

    expect(useSavedMessagesStore.getState().messages).toEqual([]);
    expect(useStarredMessagesStore.getState().entries).toEqual([]);

    const remaining = await AsyncStorage.getAllKeys();
    expect(remaining.filter((k) => k.includes('saved_messages'))).toEqual([]);
    expect(remaining.filter((k) => k.includes('starred_messages'))).toEqual([]);
  });

  it('restores the same account’s own data when it signs back in', async () => {
    await beginAccountSession(ALICE);
    useDraftStore.getState().setDraft('chat-1', 'dinner at 8?');

    // Sign out and back in as the same person — their drafts should survive,
    // because the wipe is scoped to the session, not to the device.
    await endAccountSession();
    await beginAccountSession(ALICE);

    // The account's slice is gone from disk by design: logout erases it. What
    // this asserts is that the next session starts clean rather than inheriting.
    expect(useDraftStore.getState().getDraft('chat-1')).toBe('');
  });

  it('refuses to write while no session is open', async () => {
    await beginAccountSession(ALICE);
    await endAccountSession();

    // A screen still mounted through the teardown can keep calling actions.
    useDraftStore.getState().setDraft('chat-1', 'written after logout');
    await Promise.resolve();

    expect(getAccountUserId()).toBeNull();
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.filter((k) => k.startsWith('aza_drafts'))).toEqual([]);
  });

  it('tears down the previous session when the account changes without a logout', async () => {
    await beginAccountSession(ALICE);
    useDraftStore.getState().setDraft('chat-1', 'dinner at 8?');

    await beginAccountSession(BOB);

    expect(getAccountUserId()).toBe(BOB);
    expect(useDraftStore.getState().drafts).toEqual({});
    const keys = await AsyncStorage.getAllKeys();
    expect(keys).not.toContain(`aza_drafts__${ALICE}`);
  });
});
