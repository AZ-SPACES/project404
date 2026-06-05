import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Image,
  StatusBar, Dimensions, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { useChatStore } from '../../../store/chatStore';
import type { LocalMessage } from '../../../store/chatTypes';
import type { RootStackParamList } from '../../../navigation/types';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SIZE = (width - 2) / COLUMN_COUNT; // 2px for gap between columns

const URL_REGEX = /https?:\/\/[^\s]+/g;

type Tab = 'media' | 'docs' | 'links';

type LinkItem = { id: string; url: string; domain: string; timestamp: number };

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function SharedMediaScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'SharedMedia'>>();
  const chatId = route.params?.chatId;

  const [activeTab, setActiveTab] = useState<Tab>('media');

  const allMessages = useChatStore(s => chatId ? (s.messagesByChat[chatId] ?? []) : []);

  const { mediaMessages, docMessages, linkItems } = useMemo(() => {
    const active = allMessages.filter(m => !m.isDeleted);

    const mediaMessages = active.filter(
      m => (m.type === 'IMAGE' || m.type === 'VIDEO') && !!m.mediaKey,
    ).sort((a, b) => b.timestamp - a.timestamp);

    const docMessages = active.filter(
      m => m.type === 'DOCUMENT' && !!m.mediaKey,
    ).sort((a, b) => b.timestamp - a.timestamp);

    const seen = new Set<string>();
    const linkItems: LinkItem[] = [];
    for (const m of active) {
      if (m.type === 'TEXT' && m.text) {
        const matches = m.text.match(URL_REGEX) ?? [];
        for (const url of matches) {
          if (!seen.has(url)) {
            seen.add(url);
            linkItems.push({
              id: `${m.clientId}_${url}`,
              url,
              domain: extractDomain(url),
              timestamp: m.timestamp,
            });
          }
        }
      }
    }
    linkItems.sort((a, b) => b.timestamp - a.timestamp);

    return { mediaMessages, docMessages, linkItems };
  }, [allMessages]);

  const tabData = { media: mediaMessages.length, docs: docMessages.length, links: linkItems.length };

  const renderTabBar = () => (
    <View style={styles.tabContainer}>
      {(['media', 'docs', 'links'] as Tab[]).map(key => {
        const labels: Record<Tab, string> = { media: 'Media', docs: 'Docs', links: 'Links' };
        const isActive = activeTab === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.tab, isActive && styles.activeTab]}
            onPress={() => setActiveTab(key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, isActive && styles.activeTabText]}>
              {labels[key]}
            </Text>
            {tabData[key] > 0 && (
              <View style={[styles.badge, isActive && styles.badgeActive]}>
                <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
                  {tabData[key]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderMediaItem = ({ item }: { item: LocalMessage }) => (
    <TouchableOpacity activeOpacity={0.85} style={styles.mediaItemWrapper}>
      <Image source={{ uri: item.mediaKey! }} style={styles.mediaItem} resizeMode="cover" />
      {item.type === 'VIDEO' && (
        <View style={styles.videoOverlay}>
          <Feather name="play" size={18} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderDocItem = ({ item }: { item: LocalMessage }) => (
    <TouchableOpacity
      style={styles.rowItem}
      activeOpacity={0.8}
      onPress={() => item.mediaKey && Linking.openURL(item.mediaKey).catch(() => {})}
    >
      <View style={styles.docIconBox}>
        <Feather name="file-text" size={22} color={Colors.primary} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.text || 'Document'}</Text>
        <Text style={styles.rowMeta}>{new Date(item.timestamp).toLocaleDateString()}</Text>
      </View>
      <Feather name="download" size={18} color={Colors.textSecondary} />
    </TouchableOpacity>
  );

  const renderLinkItem = ({ item }: { item: LinkItem }) => (
    <TouchableOpacity
      style={styles.rowItem}
      activeOpacity={0.8}
      onPress={() => Linking.openURL(item.url).catch(() => {})}
    >
      <View style={styles.linkIconBox}>
        <Feather name="link" size={18} color={Colors.primary} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.domain}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{item.url}</Text>
      </View>
      <Feather name="external-link" size={16} color={Colors.textSecondary} />
    </TouchableOpacity>
  );

  const EmptyState = ({ icon, message }: { icon: string; message: string }) => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Feather name={icon as any} size={28} color={Colors.textSecondary} />
      </View>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={Colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Shared Media</Text>
        <View style={{ width: 24 }} />
      </View>

      {renderTabBar()}

      {activeTab === 'media' && (
        mediaMessages.length > 0 ? (
          <FlatList
            data={mediaMessages}
            keyExtractor={item => item.clientId}
            numColumns={COLUMN_COUNT}
            renderItem={renderMediaItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <EmptyState icon="image" message="No photos or videos shared yet" />
        )
      )}

      {activeTab === 'docs' && (
        docMessages.length > 0 ? (
          <FlatList
            data={docMessages}
            keyExtractor={item => item.clientId}
            renderItem={renderDocItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <EmptyState icon="file-text" message="No documents shared yet" />
        )
      )}

      {activeTab === 'links' && (
        linkItems.length > 0 ? (
          <FlatList
            data={linkItems}
            keyExtractor={item => item.id}
            renderItem={renderLinkItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <EmptyState icon="link" message="No links shared yet" />
        )
      )}
    </SafeAreaView>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    headerTitle: { ...Typography.bodyLg, fontWeight: '600', color: Colors.textPrimary },

    tabContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      gap: 6,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    activeTab: { borderBottomColor: Colors.primary },
    tabText: { ...Typography.body, color: Colors.textSecondary, fontWeight: '500' },
    activeTabText: { color: Colors.primary, fontWeight: '600' },
    badge: {
      backgroundColor: Colors.border,
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    badgeActive: { backgroundColor: Colors.primary + '22' },
    badgeText: { ...Typography.caption, fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
    badgeTextActive: { color: Colors.primary },

    listContent: { paddingBottom: Spacing.xl },

    // Media grid
    mediaItemWrapper: { position: 'relative' },
    mediaItem: {
      width: ITEM_SIZE,
      height: ITEM_SIZE,
      borderWidth: 0.5,
      borderColor: Colors.background,
    },
    videoOverlay: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 12,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Shared row style for docs + links
    rowItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
      gap: Spacing.md,
    },
    rowInfo: { flex: 1 },
    rowTitle: { ...Typography.body, fontWeight: '500', color: Colors.textPrimary, marginBottom: 2 },
    rowMeta: { ...Typography.caption, color: Colors.textSecondary },
    docIconBox: {
      width: 46,
      height: 46,
      borderRadius: Radius.md,
      backgroundColor: Colors.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    linkIconBox: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Empty state
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl * 2,
      marginTop: 80,
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: Colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    emptyText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  });
