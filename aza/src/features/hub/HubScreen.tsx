import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput, Image, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDisplayContext } from '../../providers/DisplayProvider';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - Spacing.lg * 2 - Spacing.md) / 2;

type MiniApp = {
  id: string;
  name: string;
  logo: string;
  backgroundColor?: string;
}

const MINI_APPS: MiniApp[] = [
  { 
    id: 'bolt', 
    name: 'Bolt', 
    logo: 'https://1000logos.net/wp-content/uploads/2021/06/Bolt-Logo-1536x966.png',
    backgroundColor: '#ffffffff'
  },
  { 
    id: 'jumia', 
    name: 'Jumia', 
    logo: 'https://1000logos.net/wp-content/uploads/2021/02/Jumia-Logo.png',
    backgroundColor: '#FFFFFF'
  },
  { 
    id: 'aliexpress', 
    name: 'AliExpress', 
    logo: 'https://1000logos.net/wp-content/uploads/2020/04/AliExpress-Logo.png',
    backgroundColor: '#FFFFFF'
  },
  { 
    id: 'kfc', 
    name: 'KFC', 
    logo: 'https://1000logos.net/wp-content/uploads/2017/03/KFC-Logo.png',
    backgroundColor: '#FFFFFF'
  },
];

export default function HubScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { homeBackground } = useDisplayContext();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      <Image
        source={{ uri: homeBackground }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerSpacer} />
        
        <View style={styles.contentContainer}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            bounces={true}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.searchWrapper}>
              <View style={styles.searchContainer}>
                <Feather name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
                <TextInput 
                  placeholder="Search mini apps..."
                  placeholderTextColor={Colors.textSecondary}
                  style={styles.searchInput}
                />
              </View>
            </View>

            <View style={styles.grid}>
              {MINI_APPS.map((app) => (
                <TouchableOpacity key={app.id} style={styles.appItem} activeOpacity={0.8}>
                  <View style={[styles.logoCard, { backgroundColor: app.backgroundColor || Colors.white }]}>
                    <Image 
                      source={{ uri: app.logo }} 
                      style={styles.logoImage} 
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.appName}>{app.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.background === '#121212';
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#174717',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(23, 71, 23, 0.45)",
    },
    safeArea: {
      flex: 1,
    },
    headerSpacer: {
      height: 100,
    },
    contentContainer: {
      flex: 1,
      backgroundColor: isDark ? Colors.background : '#F0F4EF',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      overflow: 'hidden',
    },
    scrollContent: {
      padding: Spacing.lg,
      paddingTop: Spacing.xl,
    },
    searchWrapper: {
      marginBottom: Spacing.xl,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.white,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      height: 56,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    searchIcon: {
      marginRight: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      ...Typography.bodyLg,
      color: Colors.textPrimary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    appItem: {
      width: COLUMN_WIDTH,
      marginBottom: Spacing.xl,
    },
    logoCard: {
      width: COLUMN_WIDTH,
      height: COLUMN_WIDTH,
      borderRadius: Radius.md,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    logoImage: {
      width: '80%',
      height: '80%',
    },
    appName: {
      ...Typography.body,
      color: Colors.textPrimary,
      fontWeight: '500',
    },
  });
}


