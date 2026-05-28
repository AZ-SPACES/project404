import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, DeviceEventEmitter, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { formatBytes, StorageDetails, Message, CategoryStats } from '../../../components/chat/chatTypes';
import { RootStackParamList } from '../../../navigation/types';
import { BackButton } from '../../../components/ui/BackButton';

type ManageStorageRouteProp = RouteProp<RootStackParamList, 'ManageStorage'> & {
  params: {
    storageStats?: StorageDetails;
  };
};

export default function ManageStorageScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation();
  const route = useRoute<ManageStorageRouteProp>();

  // Local state to reflect immediate deletion without waiting for ChatScreen reload
  const [stats, setStats] = useState<StorageDetails>(
    route.params?.storageStats || { 
      photos: { size: 0, messages: [] }, 
      videos: { size: 0, messages: [] }, 
      docs: { size: 0, messages: [] }, 
      audio: { size: 0, messages: [] }, 
      totalSize: 0 
    }
  );

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const total = stats.totalSize > 0 ? stats.totalSize : 1; // prevent division by zero

  const STORAGE_DATA = [
    { key: 'photos', label: 'Photos', category: stats.photos, color: '#6366F1', percentage: (stats.photos.size / total) * 100 },
    { key: 'videos', label: 'Videos', category: stats.videos, color: '#0EA5E9', percentage: (stats.videos.size / total) * 100 },
    { key: 'docs', label: 'Documents', category: stats.docs, color: '#F59E0B', percentage: (stats.docs.size / total) * 100 },
    { key: 'audio', label: 'Voice Notes', category: stats.audio, color: '#10B981', percentage: (stats.audio.size / total) * 100 },
  ].filter(item => item.percentage > 0 || stats.totalSize === 0);

  if (stats.totalSize === 0) {
    STORAGE_DATA.forEach(item => item.percentage = 0);
  }

  const toggleCategory = (key: string) => {
    setExpandedCategory(prev => (prev === key ? null : key));
  };

  const handleClearCategory = (key: 'photos' | 'videos' | 'docs' | 'audio', categoryData: CategoryStats) => {
    if (categoryData.messages.length === 0) return;
    const ids = categoryData.messages.map(m => m.id);
    
    // Emit event to actual chat screen state
    DeviceEventEmitter.emit('clear_media_messages', ids);
    
    // Update local state to reflect deletion immediately
    setStats(prev => {
      const removedSize = prev[key].size;
      return {
        ...prev,
        [key]: { size: 0, messages: [] },
        totalSize: Math.max(0, prev.totalSize - removedSize)
      };
    });
    
    if (expandedCategory === key) {
      setExpandedCategory(null);
    }
  };

  const renderFileIcon = (message: Message) => {
    if (message.type === 'image' && message.uri) {
      return <Image source={{ uri: message.uri }} style={styles.fileThumbnail} />;
    }
    if (message.type === 'video' && message.uri) {
      return (
        <View style={[styles.fileThumbnail, { backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }]}>
          <Feather name="video" size={16} color="#fff" />
        </View>
      );
    }
    if (message.type === 'audio') {
      return (
        <View style={[styles.fileThumbnail, { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
          <Feather name="mic" size={16} color={Colors.primary} />
        </View>
      );
    }
    return (
      <View style={[styles.fileThumbnail, { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
        <Feather name="file-text" size={16} color={Colors.primary} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle={Colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
      
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Manage Storage</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.totalStorageCard}>
          <Text style={styles.totalLabel}>Total Space Used</Text>
          <Text style={styles.totalValue}>{formatBytes(stats.totalSize)}</Text>
          
          <View style={styles.progressBarContainer}>
            {STORAGE_DATA.map((item, index) => (
              <View 
                key={item.label} 
                style={[
                  styles.progressSegment, 
                  { 
                    backgroundColor: item.color, 
                    width: `${item.percentage}%`,
                    borderTopLeftRadius: index === 0 ? 8 : 0,
                    borderBottomLeftRadius: index === 0 ? 8 : 0,
                    borderTopRightRadius: index === STORAGE_DATA.length - 1 ? 8 : 0,
                    borderBottomRightRadius: index === STORAGE_DATA.length - 1 ? 8 : 0,
                  }
                ]} 
              />
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.listContainer}>
          {STORAGE_DATA.map((item, index) => {
            const isExpanded = expandedCategory === item.key;
            return (
              <React.Fragment key={item.key}>
                <TouchableOpacity 
                  style={styles.listItem} 
                  activeOpacity={0.7} 
                  onPress={() => toggleCategory(item.key)}
                >
                  <View style={styles.listLeft}>
                    <View style={[styles.dot, { backgroundColor: item.color }]} />
                    <Text style={styles.listLabel}>{item.label}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.listSize}>{formatBytes(item.category.size)}</Text>
                    {item.category.messages.length > 0 && (
                      <Feather 
                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                        size={20} 
                        color={Colors.textSecondary} 
                        style={{ marginLeft: Spacing.sm }} 
                      />
                    )}
                  </View>
                </TouchableOpacity>

                {isExpanded && item.category.messages.length > 0 && (
                  <View style={styles.expandedContent}>
                    {item.category.messages.map((msg) => (
                      <View key={msg.id} style={styles.fileRow}>
                        {renderFileIcon(msg)}
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName} numberOfLines={1}>
                            {msg.fileName || msg.text || `${item.label} File`}
                          </Text>
                          <Text style={styles.fileMeta}>{msg.time} • {formatBytes(msg.resolvedSize || 0)}</Text>
                        </View>
                      </View>
                    ))}
                    <TouchableOpacity 
                      style={styles.clearCategoryButton} 
                      onPress={() => handleClearCategory(item.key as 'photos' | 'videos' | 'docs' | 'audio', item.category)}
                    >
                      <Feather name="trash-2" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                      <Text style={styles.clearCategoryText}>Clear {item.label}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {index < STORAGE_DATA.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            );
          })}
        </View>

      </ScrollView>
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
  scrollContent: { padding: Spacing.lg },
  totalStorageCard: {
    backgroundColor: Colors.isDark ? Colors.surface : Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  totalLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.xs },
  totalValue: { ...Typography.h1, color: Colors.textPrimary, marginBottom: Spacing.xl },
  progressBarContainer: {
    flexDirection: 'row',
    height: 16,
    width: '100%',
    borderRadius: 8,
    backgroundColor: Colors.border,
  },
  progressSegment: {
    height: '100%',
  },
  sectionTitle: { ...Typography.caption, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm, marginLeft: Spacing.xs },
  listContainer: {
    backgroundColor: Colors.isDark ? Colors.surface : Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl * 2,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  listLeft: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: Spacing.md },
  listLabel: { ...Typography.body, color: Colors.textPrimary, fontWeight: '500' },
  listSize: { ...Typography.body, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md + 12 + Spacing.md },
  
  expandedContent: {
    backgroundColor: Colors.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  fileThumbnail: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    marginRight: Spacing.sm,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  fileMeta: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  clearCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
    borderRadius: Radius.md,
  },
  clearCategoryText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});
