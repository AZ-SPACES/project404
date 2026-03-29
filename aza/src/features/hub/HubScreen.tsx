import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput, Image, Dimensions, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDisplayContext } from '../../providers/DisplayProvider';

const { width, height } = Dimensions.get('window');
const COLUMN_WIDTH = (width - Spacing.lg * 2 - Spacing.md) / 2;

type MiniApp = {
  id: string;
  name: string;
  logo: string;
  backgroundColor?: string;
  url: string;
}

const MINI_APPS: MiniApp[] = [
  { 
    id: 'bolt', 
    name: 'Bolt', 
    logo: 'https://1000logos.net/wp-content/uploads/2021/06/Bolt-Logo-1536x966.png',
    backgroundColor: '#ffffffff',
    url: 'https://bolt.eu'
  },
  { 
    id: 'jumia', 
    name: 'Jumia', 
    logo: 'https://1000logos.net/wp-content/uploads/2021/02/Jumia-Logo.png',
    backgroundColor: '#FFFFFF',
    url: 'https://www.jumia.com.gh'
  },
  { 
    id: 'aliexpress', 
    name: 'AliExpress', 
    logo: 'https://1000logos.net/wp-content/uploads/2020/04/AliExpress-Logo.png',
    backgroundColor: '#FFFFFF',
    url: 'https://aliexpress.com'
  },
  { 
    id: 'kfc', 
    name: 'KFC', 
    logo: 'https://1000logos.net/wp-content/uploads/2017/03/KFC-Logo.png',
    backgroundColor: '#FFFFFF',
    url: 'https://www.kfc.com.gh'
  },
];

export default function HubScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { hubBackground } = useDisplayContext();
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredApps = React.useMemo(() => {
    return MINI_APPS.filter(app => 
      app.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.55 }}>
        <Image
          source={{ uri: hubBackground }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      </View>

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
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.grid}>
              {filteredApps.map((app) => (
                <TouchableOpacity 
                  key={app.id} 
                  style={styles.appItem} 
                  activeOpacity={0.8}
                  onPress={() => Linking.openURL(app.url)}
                >
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
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#174717',
    },
    safeArea: {
      flex: 1,
    },
    headerSpacer: {
      height: 100,
    },
    contentContainer: {
      flex: 1,
      backgroundColor: isDark ? Colors.background : Colors.surface,
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
      backgroundColor: isDark ? Colors.surface : Colors.white,
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


