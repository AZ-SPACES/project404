import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator
} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, Spacing, Radius } from "../../../theme";
import { StatusBar } from "react-native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from "react-native-safe-area-context";
import { useSupportChat } from "../../../hooks/useSupportChat";
import { getAvailableSupportAgents, initiateCall } from "../../../services/api";
import { BackButton } from '../../../components/ui/BackButton';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "ChatWithUs">;


export default function ChatWithUsScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;
  const navigation = useNavigation<NavigationProp>();
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<{ uri: string; mimeType: string } | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const { messages, loading, sendMessage, sendAttachment, isOtherTyping, sendTypingStatus, loadHistory } = useSupportChat();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (isInitialFocus.current) {
        isInitialFocus.current = false;
        return;
      }
      loadHistory();
    }, [loadHistory])
  );

  const [callingSupport, setCallingSupport] = useState(false);

  const handleCallSupport = async () => {
    setCallingSupport(true);
    try {
      const res = await getAvailableSupportAgents();
      const agents: any[] = res.data?.data ?? [];
      if (agents.length === 0) {
        Alert.alert(
          "No agents available",
          "All support agents are currently busy.",
          [{ text: "OK" }]
        );
        return;
      }
      const agent = agents[0];
      await initiateCall(agent.userId, "VOICE");
      navigation.navigate("AudioCall", {
        name: agent.name ?? "AZA Support",
        avatar: agent.avatarUrl ?? "",
      });
    } catch (err) {
      Alert.alert("Error", "Could not connect to support. Please try again.");
    } finally {
      setCallingSupport(false);
    }
  };

  const handleAttach = async () => {
    // Attachment logic remains same but in a real app would upload to backend
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      alert("Permission to access photo library is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 1 });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      setSelectedImage({
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() && !selectedImage) return;

    const image = selectedImage;
    const text = inputText.trim();
    setInputText("");
    setSelectedImage(null);

    if (image) {
      sendAttachment(image.uri, image.mimeType, text || undefined).catch(() => {});
    } else {
      sendMessage(text).catch(() => {});
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTypingStatus(true);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 3000);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <BackButton onPress={() => navigation.goBack()} size={28} />
            
            <TouchableOpacity
              style={styles.callButton}
              onPress={handleCallSupport}
              disabled={callingSupport}
            >
              {callingSupport ? (
                <ActivityIndicator size="small" color={Colors.textPrimary} />
              ) : (
                <Feather name="phone" size={20} color={Colors.textPrimary} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>AZA Support</Text>
          <Text style={styles.subtitle}>Typically replies within a minute.</Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.chatContainer}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {loading && messages.length === 0 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          )}
          {messages.map((msg: any) => (
            <View key={msg.id} style={styles.messageRow}>
              <View
                style={[
                  styles.messageBubble,
                  msg.isSender ? styles.senderBubble : styles.receiverBubble,
                  msg.imageUri ? styles.imageBubble : null,
                  msg.status === 'sending' && styles.messagePending,
                  msg.status === 'failed' && styles.messageFailed,
                ]}
              >
                {msg.imageUri ? (
                  <Image source={{ uri: msg.imageUri }} style={styles.messageImage} />
                ) : null}
                {!!msg.text && (
                  <Text style={[
                    styles.messageText,
                    msg.isSender ? styles.senderText : styles.receiverText,
                    msg.imageUri ? styles.textWithImage : null,
                  ]}>
                    {msg.text}
                  </Text>
                )}
              </View>
              {msg.status === 'failed' && (
                <Text style={styles.failedLabel}>Not delivered · tap to retry</Text>
              )}
            </View>
          ))}
          {isOtherTyping && (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>Agent is typing...</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton} onPress={handleAttach}>
            <Feather name="paperclip" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.inputWrapper}>
            {selectedImage && (
              <View style={styles.previewContainer}>
                <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
                <TouchableOpacity 
                  style={styles.removeImageButton} 
                  onPress={() => setSelectedImage(null)}
                >
                  <MaterialIcons name="close" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
            <TextInput
              style={styles.textInput}
              placeholder="Ask me anything..."
              placeholderTextColor={Colors.textSecondary}
              value={inputText}
              onChangeText={handleInputChange}
              multiline
            />
          </View>
          <TouchableOpacity 
            style={[styles.sendButton, (!inputText.trim() && !selectedImage) && styles.sendButtonDisabled]} 
            onPress={handleSend}
            disabled={!inputText.trim() && !selectedImage}
          >
            <Feather name="arrow-up" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Colors: any) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background },
  container: {
    flex: 1 },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
    alignItems: "center",
    justifyContent: "center" },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
    alignItems: "center",
    justifyContent: "center" },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4 },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary },
  chatContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 12 },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12 },
  imageBubble: {
    paddingHorizontal: 8,
    paddingVertical: 8 },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8 },
  textWithImage: {
    marginTop: 8,
    paddingHorizontal: 8 },
  senderBubble: {
    backgroundColor: Colors.primary, 
    alignSelf: 'flex-end',
    borderTopRightRadius: 4 },
  receiverBubble: {
    backgroundColor: isDark ? Colors.surface : Colors.secondary, 
    alignSelf: 'flex-start',
    borderTopLeftRadius: 4 },
  messageText: {
    fontSize: 16,
    lineHeight: 22 },
  senderText: {
    color: "#FFFFFF" },
  receiverText: {
    color: Colors.textPrimary },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: isDark ? Colors.border : "rgba(0,0,0,0.05)" },
  attachButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8 },
  inputWrapper: {
    flex: 1,
    backgroundColor: isDark ? Colors.surface : Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.md },
  previewContainer: {
    marginBottom: Spacing.sm,
    position: 'relative',
    width: 60,
    height: 60 },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: Radius.sm },
  removeImageButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Radius.full,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center' },
  textInput: {
    fontSize: 16,
    color: Colors.textPrimary,
    maxHeight: 100 },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center' },
  sendButtonDisabled: {
    backgroundColor: Colors.border,
    opacity: 0.5 },
  typingIndicator: {
    alignSelf: 'flex-start',
    backgroundColor: isDark ? Colors.surface : Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderTopLeftRadius: 4,
    marginTop: 4 },
  typingText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic' },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24 },
  messageRow: {
    alignItems: 'flex-end' },
  messagePending: {
    opacity: 0.55 },
  messageFailed: {
    opacity: 0.8,
    borderWidth: 1,
    borderColor: '#EF4444' },
  failedLabel: {
    fontSize: 11,
    color: '#EF4444',
    alignSelf: 'flex-end',
    marginTop: 2,
    marginRight: 4 } });
}
