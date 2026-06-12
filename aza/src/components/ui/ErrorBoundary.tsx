import React, { Component, ErrorInfo, ReactNode, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform, useColorScheme } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeColors, Typography, Spacing, Radius, LightColors, DarkColors } from '../../theme';
import Button from './Button';
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // errors are displayed in the ErrorScreen below
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorScreen 
          error={this.state.error} 
          onReset={this.handleReset} 
        />
      );
    }

    return this.props.children;
  }
}

function ErrorScreen({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Colors = isDark ? DarkColors : LightColors;
  const [showDetails, setShowDetails] = useState(false);
  const styles = React.useMemo(() => createStyles(Colors as any), [Colors]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="alert-circle" size={48} color={Colors.error} />
        </View>

        <Text style={styles.title}>Application Error</Text>
        <Text style={styles.message}>
          A problem occurred that prevented the application from continuing. You can try to reload the app or contact support if the issue persists.
        </Text>

        <View style={styles.actions}>
          <Button
            title="Reload Application"
            onPress={onReset}
            backgroundColor={Colors.textPrimary}
            textColor={Colors.white}
            borderRadius={Radius.md}
            style={{ height: 52 }}
          />

          {__DEV__ && (
            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={() => setShowDetails(!showDetails)}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>
                {showDetails ? 'Hide details' : 'Show technical details'}
              </Text>
              <Ionicons 
                name={showDetails ? "chevron-up" : "chevron-down"} 
                size={16} 
                color={Colors.textSecondary} 
              />
            </TouchableOpacity>
          )}
        </View>

        {showDetails && __DEV__ && (
          <View style={styles.debugContainer}>
            <ScrollView style={styles.errorScroll} showsVerticalScrollIndicator={true}>
              <Text style={styles.errorName}>{error?.name || 'Error'}</Text>
              <Text style={styles.errorMessage}>{error?.message || 'No message available'}</Text>
              {error?.stack && (
                <Text style={styles.stackTrace}>{error.stack}</Text>
              )}
            </ScrollView>
          </View>
        )}
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Aza v1.0.0 • Session Error
        </Text>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      maxWidth: 500,
      alignSelf: 'center',
      width: '100%',
    },
    iconContainer: {
      marginBottom: Spacing.lg,
    },
    title: {
      ...Typography.h2,
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
    },
    message: {
      ...Typography.bodyLg,
      color: Colors.textSecondary,
      lineHeight: 24,
      marginBottom: Spacing.xl,
    },
    actions: {
      gap: Spacing.md,
    },
    primaryButton: {
      backgroundColor: Colors.textPrimary,
      height: 52,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      ...Typography.button,
      color: Colors.white,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      height: 44,
    },
    secondaryButtonText: {
      ...Typography.body,
      color: Colors.textSecondary,
      fontWeight: '500',
    },
    debugContainer: {
      marginTop: Spacing.xl,
      backgroundColor: Colors.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      maxHeight: 300,
    },
    errorScroll: {
      padding: Spacing.md,
    },
    errorName: {
      ...Typography.body,
      fontWeight: '700',
      color: Colors.error,
      marginBottom: 4,
    },
    errorMessage: {
      ...Typography.body,
      color: Colors.textPrimary,
      marginBottom: Spacing.md,
    },
    stackTrace: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      fontSize: 12,
      color: Colors.textSecondary,
      lineHeight: 18,
    },
    footer: {
      padding: Spacing.lg,
      alignItems: 'center',
    },
    footerText: {
      ...Typography.caption,
      color: Colors.textSecondary,
      opacity: 0.7,
    },
  });
}

export default ErrorBoundary;
