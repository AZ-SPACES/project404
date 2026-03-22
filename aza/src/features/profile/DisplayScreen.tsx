import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { useDisplayContext, BACKGROUND_IMAGES, ThemeOption, LanguageOption, THEMES, LANGUAGES } from '../../providers/DisplayProvider';

export function DisplayScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    theme: selectedTheme,
    setTheme,
    language: selectedLanguage,
    setLanguage,
    homeBackground,
    setHomeBackground,
  } = useDisplayContext();

  const renderOptionRow = (label: string, isSelected: boolean, onSelect: () => void) => (
    <TouchableOpacity 
      style={styles.optionRow} 
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <Text style={[Typography.body, styles.optionText]}>{label}</Text>
      {isSelected && (
        <Feather name="check" size={20} color={Colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[Typography.h3, styles.headerTitle]}>Display</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Theme</Text>
          <View style={styles.sectionCard}>
            {THEMES.map((theme: ThemeOption, index: number) => (
              <View key={theme}>
                {renderOptionRow(theme, selectedTheme === theme, () => setTheme(theme))}
                {index < THEMES.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Language</Text>
          <View style={styles.sectionCard}>
            {LANGUAGES.map((lang: LanguageOption, index: number) => (
              <View key={lang}>
                {renderOptionRow(lang, selectedLanguage === lang, () => setLanguage(lang))}
                {index < LANGUAGES.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Home Screen Background</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.backgroundsScrollContainer}
          >
            {BACKGROUND_IMAGES.map((bg) => {
              const isSelected = homeBackground === bg.uri;
              return (
                <TouchableOpacity
                  key={bg.id}
                  style={[
                    styles.bgThumbnailContainer,
                    isSelected && styles.bgThumbnailSelected
                  ]}
                  onPress={() => setHomeBackground(bg.uri)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: bg.uri }} style={styles.bgThumbnailImage} />
                  {isSelected && (
                    <View style={styles.bgCheckCircle}>
                      <Feather name="check" size={12} color={Colors.white} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface, // lightly off-white to make cards pop
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.textPrimary,
  },
  headerRightPlaceholder: {
    width: 40,
  },
  scrollContent: {
    paddingVertical: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.white,
  },
  optionText: {
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.lg,
  },
  backgroundsScrollContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  bgThumbnailContainer: {
    width: 100,
    height: 160,
    borderRadius: Radius.sm,
    marginRight: Spacing.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  bgThumbnailSelected: {
    borderColor: Colors.primary,
  },
  bgThumbnailImage: {
    flex: 1,
  },
  bgCheckCircle: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
