import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Animated, Alert, ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@react-native-vector-icons/feather';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';
import { ChatMessageBubble, FullScreenImageViewer } from './ChatMessageBubble';
import { ChatAttachmentModal } from './ChatAttachmentModal';
import { ChatMoreModal } from './ChatMoreModal';
import { ChatCallModal } from './ChatCallModal';
import { ForwardModal } from './ForwardModal';
import { ChatPaymentSheet } from './ChatPaymentSheet';
import { BlockContactModal, ReportModal } from './ChatSettingsModals';
import { GifPickerModal } from './GifPickerModal';
import { StickerPickerModal } from './StickerPickerModal';
import { ContactPickerSheet } from './ContactPickerSheet';
import { PollCreatorSheet } from './PollCreatorSheet';
import Button from '../ui/Button';
import { Message, Contact, MoreAction, MenuAnchor, AttachmentAnchor } from './chatTypes';
import { useSettledRequestsStore } from '../../store/settledRequestsStore';
import { blockUser } from '../../services/api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

export type ChatScreenModalsProps = {
  // Contact info
  id: string;
  name: string;
  avatar: string;
  payIdentifier?: string | undefined;
  navigation: NativeStackNavigationProp<RootStackParamList, 'ChatScreen'>;
  chatId: string | null;
  sendText: (text: string) => Promise<void>;

  // Attachment modal
  showAttachment: boolean;
  attachmentAnchor: AttachmentAnchor | null;
  handleCloseAttachment: () => void;
  handlePickPhoto: () => void;
  handleOpenCamera: () => void;
  handlePickDocument: () => void;
  handleShareLocation: () => void;
  setPaymentSheet: React.Dispatch<React.SetStateAction<{ visible: boolean; mode: 'send' | 'request' | 'pay'; prefillAmount?: number; requestId?: string; settleMsgId?: string }>>;

  // More menu
  showMoreMenu: boolean;
  menuAnchor: MenuAnchor | null;
  handleCloseMoreMenu: () => void;
  moreMenuActions: MoreAction[];
  effectiveMuted: boolean;

  // Call menu
  showCallMenu: boolean;
  callMenuAnchor: MenuAnchor | null;
  handleCloseCallMenu: () => void;
  handleAudioCall: () => void;
  handleVideoCall: () => void;

  // Message long-press modal
  selectedMessage: Message | null;
  handleCloseMessageModal: () => void;
  messageActions: MoreAction[];
  chatBubbleColor: string;
  addReaction: (messageId: string, emoji: string) => void;

  // Forward
  showForwardModal: boolean;
  setShowForwardModal: (v: boolean) => void;
  forwardMessage: Message | null;
  handleForwardAction: (contacts: Contact[], message: Message) => void;

  // Payment
  paymentSheet: { visible: boolean; mode: 'send' | 'request' | 'pay'; prefillAmount?: number; requestId?: string; settleMsgId?: string };

  // Block / Report
  showBlockModal: boolean;
  setShowBlockModal: (v: boolean) => void;
  showReportModal: boolean;
  setShowReportModal: (v: boolean) => void;
  setToastMessage: (v: string | null) => void;

  // FAB
  showFab: boolean;
  fabAnim: Animated.Value;
  fabUnread: number;
  handleScrollToBottom: () => void;

  // Full-screen viewer
  fullScreenUri: string | null;
  setFullScreenUri: (v: string | null) => void;

  // Pickers
  showGifPicker: boolean;
  setShowGifPicker: (v: boolean) => void;
  handleSendSticker: (url: string) => void;
  showStickerPicker: boolean;
  setShowStickerPicker: (v: boolean) => void;
  showContactPicker: boolean;
  setShowContactPicker: (v: boolean) => void;
  handleShareContact: (name: string, avatar: string, handle: string) => void;
  showPollCreator: boolean;
  setShowPollCreator: (v: boolean) => void;
  handleCreatePoll: (question: string, options: string[]) => void;

  // Chat lock overlay
  showChatLock: boolean;
  handleBiometricUnlock: () => void;
  handleBack: () => void;

  // Toast
  toastMessage: string | null;
};

export function ChatScreenModals(props: ChatScreenModalsProps) {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = React.useMemo(() => createStyles(Colors, isDark), [Colors, isDark]);

  const {
    id, name, avatar, payIdentifier, navigation, chatId, sendText,
    showAttachment, attachmentAnchor, handleCloseAttachment,
    handlePickPhoto, handleOpenCamera, handlePickDocument, handleShareLocation,
    setPaymentSheet,
    showMoreMenu, menuAnchor, handleCloseMoreMenu, moreMenuActions, effectiveMuted,
    showCallMenu, callMenuAnchor, handleCloseCallMenu, handleAudioCall, handleVideoCall,
    selectedMessage, handleCloseMessageModal, messageActions, chatBubbleColor, addReaction,
    showForwardModal, setShowForwardModal, forwardMessage, handleForwardAction,
    paymentSheet,
    showBlockModal, setShowBlockModal, showReportModal, setShowReportModal, setToastMessage,
    showFab, fabAnim, fabUnread, handleScrollToBottom,
    fullScreenUri, setFullScreenUri,
    showGifPicker, setShowGifPicker, handleSendSticker, showStickerPicker, setShowStickerPicker,
    showContactPicker, setShowContactPicker, handleShareContact,
    showPollCreator, setShowPollCreator, handleCreatePoll,
    showChatLock, handleBiometricUnlock, handleBack,
    toastMessage,
  } = props;

  return (
    <>
      <ChatAttachmentModal
        visible={showAttachment}
        isDark={isDark}
        anchor={attachmentAnchor}
        onClose={handleCloseAttachment}
        onPhotos={handlePickPhoto}
        onCamera={handleOpenCamera}
        onDocument={handlePickDocument}
        onSendMoney={() => { handleCloseAttachment(); setPaymentSheet({ visible: true, mode: 'send' }); }}
        onRequestMoney={() => { handleCloseAttachment(); setPaymentSheet({ visible: true, mode: 'request' }); }}
        onGif={() => { handleCloseAttachment(); setShowGifPicker(true); }}
        onLocation={() => { handleShareLocation(); }}
        onContact={() => { handleCloseAttachment(); setShowContactPicker(true); }}
        onPoll={() => { handleCloseAttachment(); setShowPollCreator(true); }}
        onSticker={() => { handleCloseAttachment(); setShowStickerPicker(true); }}
      />

      <ChatMoreModal
        visible={showMoreMenu}
        isDark={isDark}
        isMuted={effectiveMuted}
        contactName={name}
        anchor={menuAnchor}
        onClose={handleCloseMoreMenu}
        actions={moreMenuActions}
      />

      <ChatCallModal
        visible={showCallMenu}
        isDark={isDark}
        anchor={callMenuAnchor}
        onClose={handleCloseCallMenu}
        onAudioCall={handleAudioCall}
        onVideoCall={handleVideoCall}
      />

      {/* Message long-press modal */}
      <Modal visible={!!selectedMessage} transparent animationType="fade" onRequestClose={handleCloseMessageModal}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseMessageModal}>
          <BlurView intensity={25} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        </Pressable>
        {selectedMessage && (
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            pointerEvents="box-none"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.modalInner}>
              <View style={{ width: '100%', paddingHorizontal: Spacing.lg }}>
                <ChatMessageBubble message={selectedMessage} bubbleColor={chatBubbleColor || undefined} />
              </View>
              <View style={styles.reactionPicker}>
                {['👍','❤️','😂','😮','😢','🙏','🔥','🎉','💯','😍','🤔','👏'].map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.reactionPickerBtn}
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      addReaction(selectedMessage.id, emoji);
                      handleCloseMessageModal();
                    }}
                  >
                    <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.actionMenu}>
                {messageActions.map((action, i) => (
                  <React.Fragment key={action.label}>
                    {i > 0 && <View style={styles.actionDivider} />}
                    <TouchableOpacity style={styles.actionItem} onPress={action.onPress} activeOpacity={0.7}>
                      <Feather name={action.icon as any} size={19} color={action.color ?? Colors.textPrimary} />
                      <Text style={[styles.actionLabel, { color: action.color ?? Colors.textPrimary }]}>{action.label}</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
            </View>
          </ScrollView>
        )}
      </Modal>

      <ForwardModal
        visible={showForwardModal}
        message={forwardMessage}
        onClose={() => setShowForwardModal(false)}
        onForward={handleForwardAction}
      />

      <ChatPaymentSheet
        visible={paymentSheet.visible}
        mode={paymentSheet.mode}
        recipientName={name}
        recipientAvatar={avatar}
        recipientIdentifier={payIdentifier ?? id}
        payRequestId={paymentSheet.requestId}
        prefillAmount={paymentSheet.prefillAmount}
        onClose={() => setPaymentSheet(s => ({ ...s, visible: false }))}
        onSuccess={(amount, paidMode, requestId) => {
          const settleMsgId = paymentSheet.settleMsgId;
          setPaymentSheet(s => ({ ...s, visible: false }));
          // Requests carry their money-request id so the payer's card can settle
          // them; paying sends a receipt carrying paysRequestId (or paysMsgId
          // for legacy cards keyed by the request message's id) so both sides'
          // request cards flip to Paid (messages are E2EE and can't be edited).
          const payload =
            paidMode === 'request'
              ? { __payment: true, amount, mode: 'request', status: 'pending', requestId }
              : paidMode === 'pay' || settleMsgId
                ? {
                    __payment: true, amount, mode: 'send',
                    ...(requestId ? { paysRequestId: requestId } : {}),
                    ...(settleMsgId ? { paysMsgId: settleMsgId } : {}),
                  }
                : { __payment: true, amount, mode: 'send' };
          // Legacy settles run through the plain transfer flow, so the sheet
          // can't record them against a request id — flip the card locally
          // here so it never offers "Pay" again even if the receipt fails.
          if (paidMode === 'send' && settleMsgId) {
            useSettledRequestsStore.getState().markPaid(settleMsgId);
          }
          sendText(JSON.stringify(payload)).catch(() => {});
        }}
      />

      <BlockContactModal
        visible={showBlockModal}
        contactName={name}
        isDark={isDark}
        Colors={Colors}
        onClose={() => setShowBlockModal(false)}
        onBlock={async () => {
          setShowBlockModal(false);
          try { await blockUser(id); } catch {}
          navigation.goBack();
        }}
      />

      <ReportModal
        visible={showReportModal}
        contactName={name}
        isDark={isDark}
        Colors={Colors}
        onClose={() => setShowReportModal(false)}
        onReport={() => {
          setShowReportModal(false);
          setToastMessage('Report submitted. Thank you for keeping AZA safe.');
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />

      {/* Scroll-to-bottom FAB */}
      <Animated.View
        pointerEvents={showFab ? 'auto' : 'none'}
        style={[styles.fab, { opacity: fabAnim, transform: [{ scale: fabAnim }] }]}
      >
        <TouchableOpacity style={styles.fabBtn} onPress={handleScrollToBottom} activeOpacity={0.85}>
          <Feather name="chevron-down" size={22} color="#fff" />
          {fabUnread > 0 && (
            <View style={styles.fabBadge}>
              <Text style={styles.fabBadgeText}>{fabUnread > 99 ? '99+' : fabUnread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {fullScreenUri && (
        <FullScreenImageViewer uri={fullScreenUri} onClose={() => setFullScreenUri(null)} />
      )}

      <GifPickerModal
        visible={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={(gifUrl) => {
          sendText(JSON.stringify({ __gif: true, url: gifUrl })).catch(() => {});
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }}
      />

      <StickerPickerModal
        visible={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelect={handleSendSticker}
      />

      <ContactPickerSheet
        visible={showContactPicker}
        onClose={() => setShowContactPicker(false)}
        onSelect={handleShareContact}
      />

      <PollCreatorSheet
        visible={showPollCreator}
        onClose={() => setShowPollCreator(false)}
        onCreate={handleCreatePoll}
      />

      {/* Biometric chat lock overlay */}
      {showChatLock && (
        <View style={[StyleSheet.absoluteFill, styles.chatLockOverlay]}>
          <View style={styles.chatLockCard}>
            <Feather name="lock" size={40} color={Colors.primary} />
            <Text style={styles.chatLockTitle}>Chat Locked</Text>
            <Text style={styles.chatLockSubtitle}>This chat is protected with biometric authentication</Text>
            <Button
              title="Unlock Chat"
              onPress={handleBiometricUnlock}
              leftIcon={<Feather name="unlock" size={18} color="#fff" />}
              backgroundColor={Colors.primary}
              borderRadius={Radius.full}
              paddingVertical={14}
              paddingHorizontal={Spacing.xl}
              width="auto"
              style={{ marginTop: 8 }}
              activeOpacity={0.85}
            />
            <Button
              title="Go Back"
              onPress={handleBack}
              backgroundColor="transparent"
              textColor={Colors.textSecondary}
              fontSize={14}
              fontWeight="normal"
              paddingVertical={0}
              paddingHorizontal={0}
              width="auto"
              style={{ marginTop: 12 }}
            />
          </View>
        </View>
      )}

      {toastMessage && (
        <View style={styles.toastContainer}>
          <View style={styles.toast}>
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}
    </>
  );
}

const createStyles = (Colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    modalScroll: { flex: 1 },
    modalContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 48,
    },
    modalInner: {
      alignItems: 'center',
      width: '100%',
    },
    actionMenu: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.lg,
      width: 260,
      marginTop: Spacing.lg,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      overflow: 'hidden',
    },
    actionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 11,
      paddingHorizontal: Spacing.md,
      gap: Spacing.md,
    },
    actionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
      marginHorizontal: Spacing.md,
    },
    actionLabel: { ...Typography.body, fontWeight: '500', fontSize: 15 },
    reactionPicker: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.lg,
      paddingVertical: 8,
      paddingHorizontal: Spacing.sm,
      marginTop: Spacing.lg,
      gap: 2,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      maxWidth: 300,
    },
    reactionPickerBtn: {
      width: 40, height: 40,
      alignItems: 'center', justifyContent: 'center',
      borderRadius: 20,
    },
    reactionPickerEmoji: { fontSize: 22 },
    fab: {
      position: 'absolute',
      bottom: 90,
      right: Spacing.lg,
      zIndex: 20,
    },
    fabBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: Colors.primary,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
    },
    fabBadge: {
      position: 'absolute', top: -4, right: -4,
      minWidth: 18, height: 18, borderRadius: 9,
      backgroundColor: '#EF4444',
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    },
    fabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    chatLockOverlay: {
      backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.92)',
      alignItems: 'center', justifyContent: 'center', zIndex: 200,
    },
    chatLockCard: { alignItems: 'center', gap: 12, paddingHorizontal: Spacing.xl },
    chatLockTitle: { ...Typography.body, fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
    chatLockSubtitle: { ...Typography.body, fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
    toastContainer: {
      position: 'absolute', bottom: 80,
      left: 0, right: 0, alignItems: 'center', zIndex: 100,
    },
    toast: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: '#111827',
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      borderRadius: Radius.full, gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
    },
    toastText: { ...Typography.body, color: '#fff', fontWeight: '500' },
  });
