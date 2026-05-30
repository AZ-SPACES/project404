import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAppTheme, Spacing, ThemeColors, Typography } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { sendAiMessage } from '../../../services/api';

type Message = { id: string; role: 'user' | 'assistant'; content: string };

const QUICK_PROMPTS = [
  'How is my spending this month?',
  'Am I on track with my budget?',
  'Where do I spend the most?',
  'Tips to save more money',
];

function uid() {
  return Math.random().toString(36).slice(2);
}

export default function AiAssistantScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText('');

    const userMsg: Message = { id: uid(), role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsLoading(true);
    scrollToBottom();

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await sendAiMessage(trimmed, history);
      const reply = res.data?.data?.response ?? res.data?.response;
      if (reply) {
        setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: reply }]);
        scrollToBottom();
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { id: uid(), role: 'assistant', content: "Sorry, I'm having trouble right now. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerCenter}>
          <View style={styles.headerIcon}>
            <Feather name="cpu" size={14} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Aza AI</Text>
            <Text style={styles.headerSubtitle}>Financial assistant</Text>
          </View>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.messageList, isEmpty && styles.messageListEmpty]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isEmpty ? (
            <View style={styles.welcomeWrap}>
              <View style={styles.welcomeIconWrap}>
                <Feather name="cpu" size={28} color={Colors.primary} />
              </View>
              <Text style={styles.welcomeTitle}>Ask me anything</Text>
              <Text style={styles.welcomeSubtitle}>
                I know your spending, income, and budgets. Ask me anything about your finances.
              </Text>

              <View style={styles.chipsWrap}>
                {QUICK_PROMPTS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={styles.chip}
                    onPress={() => sendMessage(p)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.chipText}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <>
              {messages.map(msg => (
                <View
                  key={msg.id}
                  style={[
                    styles.bubble,
                    msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                  ]}
                >
                  {msg.role === 'assistant' && (
                    <View style={styles.assistantAvatar}>
                      <Feather name="cpu" size={12} color={Colors.primary} />
                    </View>
                  )}
                  <View style={[
                    styles.bubbleBody,
                    msg.role === 'user' ? styles.bubbleBodyUser : styles.bubbleBodyAssistant,
                  ]}>
                    <Text style={[
                      styles.bubbleText,
                      msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
                    ]}>
                      {msg.content}
                    </Text>
                  </View>
                </View>
              ))}

              {isLoading && (
                <View style={[styles.bubble, styles.bubbleAssistant]}>
                  <View style={styles.assistantAvatar}>
                    <Feather name="cpu" size={12} color={Colors.primary} />
                  </View>
                  <View style={[styles.bubbleBody, styles.bubbleBodyAssistant, styles.typingBubble]}>
                    <ActivityIndicator size="small" color={Colors.textSecondary} />
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about your finances…"
            placeholderTextColor={Colors.textSecondary}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(inputText)}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
            activeOpacity={0.75}
          >
            <Feather name="send" size={18} color={!inputText.trim() || isLoading ? Colors.textSecondary : '#fff'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
    },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerIcon: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: Colors.primary + '18',
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
    headerSubtitle: { ...Typography.caption, color: Colors.textSecondary },

    messageList: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.md,
      flexGrow: 1,
    },
    messageListEmpty: { flex: 1, justifyContent: 'center' },

    welcomeWrap: { alignItems: 'center', paddingHorizontal: Spacing.md },
    welcomeIconWrap: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: Colors.primary + '18',
      alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg,
    },
    welcomeTitle: { ...Typography.h3, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xs },
    welcomeSubtitle: {
      ...Typography.body, color: Colors.textSecondary,
      textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl,
    },
    chipsWrap: { width: '100%', gap: 10 },
    chip: {
      paddingHorizontal: Spacing.md, paddingVertical: 12,
      backgroundColor: isDark ? Colors.surface : '#F8FAFC',
      borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    },
    chipText: { ...Typography.body, color: Colors.textPrimary },

    bubble: {
      flexDirection: 'row', alignItems: 'flex-end',
      marginBottom: Spacing.sm,
    },
    bubbleUser: { justifyContent: 'flex-end' },
    bubbleAssistant: { justifyContent: 'flex-start', gap: 8 },

    assistantAvatar: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: Colors.primary + '18',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },

    bubbleBody: {
      maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
    },
    bubbleBodyUser: {
      backgroundColor: Colors.primary,
      borderBottomRightRadius: 4,
    },
    bubbleBodyAssistant: {
      backgroundColor: isDark ? Colors.surface : '#F3F4F6',
      borderBottomLeftRadius: 4,
      borderWidth: 1, borderColor: Colors.border,
    },
    bubbleText: { ...Typography.body, lineHeight: 20 },
    bubbleTextUser: { color: '#fff' },
    bubbleTextAssistant: { color: Colors.textPrimary },
    typingBubble: { paddingVertical: 12, paddingHorizontal: 20 },

    inputWrap: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 10,
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
      backgroundColor: Colors.background,
    },
    input: {
      flex: 1, maxHeight: 100,
      backgroundColor: isDark ? Colors.surface : '#F3F4F6',
      borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
      paddingHorizontal: 16, paddingVertical: 10,
      ...Typography.body,
      color: Colors.textPrimary,
    },
    sendBtn: {
      width: 42, height: 42, borderRadius: 21,
      backgroundColor: Colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    sendBtnDisabled: {
      backgroundColor: isDark ? Colors.surface : '#E5E7EB',
      borderWidth: 1, borderColor: Colors.border,
    },
  });
}
