import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, StatusBar, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SIZE = width / COLUMN_COUNT;

// Mock data
const MOCK_MEDIA: any[] = [];

const MOCK_DOCS: any[] = [];

const MOCK_LINKS: any[] = [];

export default function SharedMediaScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'media' | 'docs' | 'links'>('media');

  const renderTab = (key: 'media' | 'docs' | 'links', label: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === key && styles.activeTab]}
      onPress={() => setActiveTab(key)}
      activeOpacity={0.8}
    >
      <Text style={[styles.tabText, activeTab === key && styles.activeTabText]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={Colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shared Media</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabContainer}>
        {renderTab('media', 'Media')}
        {renderTab('docs', 'Docs')}
        {renderTab('links', 'Links')}
      </View>

      {activeTab === 'media' && (
        <FlatList
          data={MOCK_MEDIA}
          keyExtractor={item => item.id}
          numColumns={COLUMN_COUNT}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.9}>
              <Image source={{ uri: item.uri }} style={styles.mediaItem} />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      {activeTab === 'docs' && (
        <FlatList
          data={MOCK_DOCS}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.docItem}>
              <View style={styles.docIconBox}>
                <Feather name="file-text" size={24} color={Colors.primary} />
              </View>
              <View style={styles.docInfo}>
                <Text style={styles.docName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.docMeta}>{item.size} • {item.date}</Text>
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      {activeTab === 'links' && (
        <FlatList
          data={MOCK_LINKS}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.linkItem}>
              <View style={styles.linkIconBox}>
                <Feather name="link" size={20} color={Colors.primary} />
              </View>
              <View style={styles.linkInfo}>
                <Text style={styles.linkTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.linkDomain} numberOfLines={1}>{item.domain}</Text>
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: Spacing.xs, marginLeft: -Spacing.xs },
  headerTitle: { ...Typography.bodyLg, fontWeight: '600', color: Colors.textPrimary },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: Colors.primary },
  tabText: { ...Typography.body, color: Colors.textSecondary, fontWeight: '500' },
  activeTabText: { color: Colors.primary, fontWeight: '600' },
  listContent: { paddingBottom: Spacing.xl },
  // Media
  mediaItem: { width: ITEM_SIZE, height: ITEM_SIZE, borderWidth: 0.5, borderColor: Colors.background },
  // Docs
  docItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  docIconBox: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  docInfo: { flex: 1, marginLeft: Spacing.md },
  docName: { ...Typography.body, fontWeight: '500', color: Colors.textPrimary, marginBottom: 4 },
  docMeta: { ...Typography.caption, color: Colors.textSecondary },
  // Links
  linkItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  linkIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  linkInfo: { flex: 1, marginLeft: Spacing.md },
  linkTitle: { ...Typography.body, fontWeight: '500', color: Colors.textPrimary, marginBottom: 2 },
  linkDomain: { ...Typography.caption, color: Colors.textSecondary },
});
