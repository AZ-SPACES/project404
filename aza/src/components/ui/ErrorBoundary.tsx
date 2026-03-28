import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LightColors as AppColors, Typography, Spacing, Radius } from '../../theme';

const { height } = Dimensions.get('window');

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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
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
        <View style={styles.overlay}>
          <StatusBar barStyle="light-content" />
          <View style={styles.modal}>
            <View style={styles.grabber} />
            
            <View style={styles.illustrationContainer}>
              <View style={styles.tvFrame}>
                <Ionicons name="tv-outline" size={80} color="#3C4043" />
                <View style={styles.errorDot} />
              </View>
              <View style={styles.sparkContainer}>
                <Ionicons name="flash" size={20} color={AppColors.error} />
              </View>
            </View>

            <View style={styles.content}>
              <Text style={styles.title}>Something went wrong</Text>
              <Text style={styles.message}>
                Don't worry, our best minds are on it. You may retry or check back soon!
              </Text>

              <TouchableOpacity 
                style={styles.button} 
                onPress={this.handleReset}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Try again</Text>
              </TouchableOpacity>
              
              {__DEV__ && (
                <View style={styles.debugContainer}>
                  <ScrollView 
                    style={styles.errorScroll}
                    horizontal={true}
                    showsHorizontalScrollIndicator={false}
                  >
                    <Text style={styles.stackTrace}>
                      {this.state.error?.name}: {this.state.error?.message}
                    </Text>
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0E0F0C', // Match reference image background
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modal: {
    backgroundColor: '#1E1E1E', // Match dark modal color
    width: '100%',
    maxWidth: 380,
    borderRadius: 24, // Consistent with reference image
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3C4043',
  },
  grabber: {
    width: 40,
    height: 4,
    backgroundColor: '#3C4043',
    borderRadius: 2,
    marginBottom: Spacing.xl,
  },
  illustrationContainer: {
    width: 140,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  tvFrame: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AppColors.error,
    top: '40%',
    left: '40%',
    shadowColor: AppColors.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  sparkContainer: {
    position: 'absolute',
    right: 0,
    bottom: 10,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#9AA0A6',
    textAlign: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  button: {
    backgroundColor: '#DFE1E5', // Accurate light gray button from image
    width: '100%',
    height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#121212',
  },
  debugContainer: {
    width: '100%',
    marginTop: Spacing.lg,
    padding: Spacing.sm,
    backgroundColor: '#121212',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#3C4043',
  },
  errorScroll: {
    width: '100%',
  },
  stackTrace: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#F2F2F2',
  },
});

export default ErrorBoundary;
