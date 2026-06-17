import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MiniAppProps, MiniAppTheme, resolveTheme } from '../types';

const STORAGE_KEY = '@aza_notepad_notes';

interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function NotepadApp({ onClose, theme }: MiniAppProps) {
  const colors = resolveTheme(theme);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');

  // Load persisted notes on mount.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setNotes(JSON.parse(raw));
      } catch {
        // Corrupt or missing store — start empty.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Persist whenever notes change (after initial load).
  const persist = useCallback((next: Note[]) => {
    setNotes(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const sorted = useMemo(
    () => [...notes].sort((a, b) => b.updatedAt - a.updatedAt),
    [notes],
  );

  const openNote = (note: Note) => {
    setEditingId(note.id);
    setDraftTitle(note.title);
    setDraftBody(note.body);
  };

  const createNote = () => {
    setEditingId('__new__');
    setDraftTitle('');
    setDraftBody('');
  };

  const saveDraft = useCallback(() => {
    const title = draftTitle.trim();
    const body = draftBody.trim();

    // Discard empty notes silently.
    if (!title && !body) {
      setEditingId(null);
      return;
    }

    if (editingId === '__new__') {
      persist([
        { id: newId(), title, body, updatedAt: Date.now() },
        ...notes,
      ]);
    } else {
      persist(
        notes.map((n) =>
          n.id === editingId ? { ...n, title, body, updatedAt: Date.now() } : n,
        ),
      );
    }
    setEditingId(null);
  }, [draftTitle, draftBody, editingId, notes, persist]);

  const deleteNote = (id: string) => {
    persist(notes.filter((n) => n.id !== id));
    setEditingId(null);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // ---- Editor view ----
  if (editingId !== null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={saveDraft}
            style={styles.headerBtn}
            accessibilityLabel="Back"
          >
            <Text style={styles.headerBtnText}>‹ Notes</Text>
          </TouchableOpacity>
          {editingId !== '__new__' && (
            <TouchableOpacity
              onPress={() => deleteNote(editingId)}
              style={styles.headerBtn}
              accessibilityLabel="Delete note"
            >
              <Text style={[styles.headerBtnText, styles.deleteText]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TextInput
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="Title"
            placeholderTextColor={colors.textSecondary}
            style={styles.titleInput}
            autoFocus={editingId === '__new__'}
          />
          <TextInput
            value={draftBody}
            onChangeText={setDraftBody}
            placeholder="Start writing…"
            placeholderTextColor={colors.textSecondary}
            style={styles.bodyInput}
            multiline
            textAlignVertical="top"
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ---- List view ----
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notes</Text>
        <TouchableOpacity onPress={onClose} style={styles.headerBtn} accessibilityLabel="Close">
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {sorted.length === 0 ? (
        <View style={[styles.flex, styles.center]}>
          <Text style={styles.emptyTitle}>No notes yet</Text>
          <Text style={styles.emptySub}>Tap + to create your first note</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.noteCard} onPress={() => openNote(item)}>
              <Text style={styles.noteTitle} numberOfLines={1}>
                {item.title || 'Untitled'}
              </Text>
              {!!item.body && (
                <Text style={styles.noteSnippet} numberOfLines={2}>
                  {item.body}
                </Text>
              )}
              <Text style={styles.noteTime}>{relativeTime(item.updatedAt)}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={createNote} accessibilityLabel="New note">
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function makeStyles(c: MiniAppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    title: { fontSize: 22, fontWeight: '700', color: c.textPrimary },
    headerBtn: { paddingVertical: 6, minWidth: 60 },
    headerBtnText: { fontSize: 16, fontWeight: '600', color: c.primary },
    deleteText: { color: '#FF5C5C', textAlign: 'right' },
    closeText: { fontSize: 18, color: c.textSecondary },
    listContent: { padding: 16, paddingBottom: 100 },
    noteCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    noteTitle: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
    noteSnippet: { fontSize: 14, color: c.textSecondary, marginTop: 4, lineHeight: 19 },
    noteTime: { fontSize: 12, color: c.textSecondary, marginTop: 8 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: c.textPrimary },
    emptySub: { fontSize: 14, color: c.textSecondary, marginTop: 6 },
    titleInput: {
      fontSize: 22,
      fontWeight: '700',
      color: c.textPrimary,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    bodyInput: {
      flex: 1,
      fontSize: 16,
      lineHeight: 23,
      color: c.textPrimary,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    fab: {
      position: 'absolute',
      right: 24,
      bottom: 32,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    fabText: { fontSize: 32, lineHeight: 36, color: c.background, fontWeight: '400' },
  });
}
