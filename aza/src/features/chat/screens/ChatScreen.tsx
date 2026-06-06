import React, { useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, FlatList, StatusBar, Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { ChatHeader } from '../../../components/chat/ChatHeader';
import { ChatMessageBubble, ChatTypingIndicator } from '../../../components/chat/ChatMessageBubble';
import { ChatInputArea } from '../../../components/chat/ChatInputArea';
import { SwipeableMessageBubble } from '../../../components/chat/SwipeableMessageBubble';
import { ChatScreenModals } from '../../../components/chat/ChatScreenModals';
import { Message, isSameDay, formatDateHeader } from '../../../components/chat/chatTypes';
import { useChatScreen } from '../../../hooks/useChatScreen';

// ----------------------------------------------------------------------------
// Main Screen Component
// ----------------------------------------------------------------------------
export default function ChatScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = useMemo(() => createScreenStyles(Colors, isDark), [Colors, isDark]);

  const screen = useChatScreen();

  const {
    id, name, avatar, payIdentifier, navigation, chatId, sendText,
    online, lastSeenTs, peerIdentityChange,
    messages, filteredMessages, isOtherTyping,
    isDark: _isDark, chatBubbleColor, chatWallpaper, hasWallpaper,
    message, replyTo,
    showMoreMenu, menuAnchor, handleCloseMoreMenu, moreMenuActions, effectiveMuted,
    showCallMenu, callMenuAnchor, handleCloseCallMenu, handleAudioCall, handleVideoCall,
    showAttachment, attachmentAnchor, handleCloseAttachment,
    handlePickPhoto, handleOpenCamera, handlePickDocument, handleShareLocation,
    setPaymentSheet,
    searchActive, searchQuery, setSearchQuery, searchResultIndex,
    showForwardModal, setShowForwardModal, forwardMessage, handleForwardAction,
    toastMessage, setToastMessage,
    showBlockModal, setShowBlockModal, showReportModal, setShowReportModal,
    keyWarningDismissed, setKeyWarningDismissed,
    paymentSheet,
    fullScreenUri, setFullScreenUri,
    showGifPicker, setShowGifPicker, handleSendSticker,
    showStickerPicker, setShowStickerPicker,
    showContactPicker, setShowContactPicker, handleShareContact,
    showPollCreator, setShowPollCreator, handleCreatePoll,
    selectMode, selectedMsgIds,
    showChatLock, handleBiometricUnlock,
    editingMessage, editText, setEditText,
    showFab, fabUnread, fabAnim,
    pinnedMessages, pinnedMessage, pinnedIndex,
    selectedMessage, handleCloseMessageModal, messageActions, addReaction,
    flatListRef, newMsgIdsRef, initialMsgCountRef2,
    handleBack, handleProfilePress, handleMorePress, handleCallPress,
    handleAddPress,
    handleSelectMessage, handleEnterSelectMode, handleExitSelectMode,
    handleBulkDelete, handleBulkStar, handleBulkForward,
    handleSearchClose, handleSearchNext, handleSearchPrev,
    handleSwipeToReply, handleCancelReply,
    handleSend, handleMessageChange, handleSendAudio,
    handleViewOnce,
    handleEditSubmit, handleScrollToPinned, handlePinnedNext, handlePinnedPrev,
    handleScroll, handleScrollToBottom,
    handleScheduleSend,
    unpinMessage,
  } = screen;

  // --------------------------------------------------------------------------
  // FlatList helpers
  // --------------------------------------------------------------------------
  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => {
    const prev = index > 0 ? filteredMessages[index - 1] : undefined;
    const next = index < filteredMessages.length - 1 ? filteredMessages[index + 1] : undefined;
    const isFirstOfDay = index === 0 || !isSameDay(item.timestamp, prev?.timestamp ?? 0);
    const isLastInGroup = !next || next.sender !== item.sender || !isSameDay(item.timestamp, next.timestamp);
    const groupSpacing = isLastInGroup ? undefined : { marginBottom: 1 };
    const isNew = newMsgIdsRef.current.has(item.id);
    const showUnreadSep = initialMsgCountRef2.current !== null &&
      index === initialMsgCountRef2.current &&
      item.sender === 'other';
    return (
      <View style={groupSpacing}>
        {isFirstOfDay && (
          <View style={styles.dateHeaderContainer}>
            <Text style={styles.dateHeaderText}>{formatDateHeader(item.timestamp)}</Text>
          </View>
        )}
        {showUnreadSep && (
          <View style={styles.unreadSeparator}>
            <View style={styles.unreadLine} />
            <Text style={styles.unreadLabel}>New Messages</Text>
            <View style={styles.unreadLine} />
          </View>
        )}
        <SwipeableMessageBubble message={item} onSwipeToReply={handleSwipeToReply} disabled={selectMode || undefined}>
          <ChatMessageBubble
            message={item}
            onLongPress={() => handleSelectMessage(item)}
            onImagePress={setFullScreenUri}
            onPayPress={(amount) => setPaymentSheet({ visible: true, mode: 'send', prefillAmount: amount })}
            onStatusPress={item.sender === 'me' && item.status ? () => navigation.navigate('MessageInfo', { message: item }) : undefined}
            bubbleColor={chatBubbleColor || undefined}
            isLastInGroup={isLastInGroup}
            isNew={isNew}
            highlight={searchActive && searchQuery ? searchQuery : undefined}
            isSelected={selectMode ? selectedMsgIds.includes(item.id) : undefined}
            isSelectMode={selectMode || undefined}
            onSelectToggle={selectMode ? () => handleSelectMessage(item) : undefined}
            onViewOnce={handleViewOnce}
          />
        </SwipeableMessageBubble>
      </View>
    );
  }, [filteredMessages, styles.dateHeaderContainer, styles.dateHeaderText, styles.unreadSeparator, styles.unreadLine, styles.unreadLabel, handleSelectMessage, handleSwipeToReply, chatBubbleColor, setFullScreenUri, searchActive, searchQuery, selectMode, selectedMsgIds, navigation, setPaymentSheet, newMsgIdsRef, initialMsgCountRef2, handleViewOnce]);

  const keyExtractor = useCallback((item: Message) => item.id, []);
  const listFooter = useMemo(() => isOtherTyping ? <ChatTypingIndicator /> : null, [isOtherTyping]);

  // --------------------------------------------------------------------------
  // Shared bar content (rendered inside both iOS KAV and Android View)
  // --------------------------------------------------------------------------
  const selectBar = selectMode ? (
    <View style={styles.selectBar}>
      <TouchableOpacity onPress={handleExitSelectMode} style={styles.selectBarCancel}>
        <Feather name="x" size={20} color={Colors.textPrimary} />
      </TouchableOpacity>
      <Text style={[styles.selectBarCount, { color: Colors.textPrimary }]}>
        {selectedMsgIds.length} selected
      </Text>
      <View style={styles.selectBarActions}>
        <TouchableOpacity onPress={handleBulkForward} style={styles.selectBarBtn} disabled={selectedMsgIds.length === 0}>
          <Feather name="corner-up-right" size={20} color={selectedMsgIds.length > 0 ? Colors.primary : Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleBulkStar} style={styles.selectBarBtn} disabled={selectedMsgIds.length === 0}>
          <Feather name="star" size={20} color={selectedMsgIds.length > 0 ? Colors.primary : Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleBulkDelete} style={styles.selectBarBtn} disabled={selectedMsgIds.length === 0}>
          <Feather name="trash-2" size={20} color={selectedMsgIds.length > 0 ? '#EF4444' : Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  ) : null;

  const editBar = !selectMode && editingMessage ? (
    <View style={styles.editBar}>
      <Feather name="edit-2" size={16} color={Colors.primary} style={{ marginRight: Spacing.sm }} />
      <TextInput
        style={styles.editInput}
        value={editText}
        onChangeText={setEditText}
        autoFocus
        multiline
        onSubmitEditing={handleEditSubmit}
        blurOnSubmit
      />
      <TouchableOpacity onPress={handleEditSubmit} style={{ marginLeft: Spacing.sm }}>
        <Feather name="check" size={20} color={Colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setEditText('')} style={{ marginLeft: Spacing.sm }}>
        <Feather name="x" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
    </View>
  ) : null;

  const inputArea = !selectMode ? (
    <ChatInputArea
      message={message}
      setMessage={handleMessageChange}
      onSend={handleSend}
      isAddOpen={showAttachment}
      onAddPress={handleAddPress}
      replyTo={replyTo}
      onCancelReply={handleCancelReply}
      onSendAudio={handleSendAudio}
      onScheduleSend={handleScheduleSend}
    />
  ) : null;

  const messageList = (
    <FlatList
      ref={flatListRef}
      data={filteredMessages}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={styles.messagesList}
      showsVerticalScrollIndicator={false}
      ListFooterComponent={listFooter}
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={10}
      removeClippedSubviews
      onScroll={handleScroll}
      scrollEventThrottle={100}
    />
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: hasWallpaper ? 'transparent' : Colors.background }]}
      edges={['top', 'bottom']}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      {hasWallpaper && chatWallpaper?.type === 'solid' && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: chatWallpaper.value }]} />
      )}
      {hasWallpaper && chatWallpaper?.type === 'image' && !!chatWallpaper.value && (
        <Image source={{ uri: chatWallpaper.value }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}

      <ChatHeader
        name={name}
        avatar={avatar}
        online={online}
        lastSeen={lastSeenTs ?? undefined}
        isEncrypted={!!chatId}
        onBack={handleBack}
        onProfilePress={handleProfilePress}
        isMenuOpen={showMoreMenu}
        onMorePress={handleMorePress}
        isCallMenuOpen={showCallMenu}
        onCallPress={handleCallPress}
      />

      {peerIdentityChange === 'changed' && !keyWarningDismissed && (
        <TouchableOpacity style={styles.keyChangeBanner} activeOpacity={0.85} onPress={() => setKeyWarningDismissed(true)}>
          <Feather name="alert-triangle" size={15} color="#F59E0B" style={{ flexShrink: 0 }} />
          <Text style={styles.keyChangeBannerText} numberOfLines={2}>
            {name}'s encryption keys changed. Verify the safety number in Contact Info.
          </Text>
          <Feather name="x" size={15} color={Colors.textSecondary} style={{ flexShrink: 0 }} />
        </TouchableOpacity>
      )}

      {searchActive && (
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={Colors.textSecondary} style={{ marginRight: Spacing.sm }} />
          <TextInput
            underlineColorAndroid="transparent"
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.trim() && filteredMessages.length > 0 && (
            <View style={styles.searchNav}>
              <Text style={styles.searchCount}>{searchResultIndex + 1}/{filteredMessages.length}</Text>
              <TouchableOpacity onPress={handleSearchPrev} style={styles.searchNavBtn} activeOpacity={0.7}>
                <Feather name="chevron-up" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSearchNext} style={styles.searchNavBtn} activeOpacity={0.7}>
                <Feather name="chevron-down" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={handleSearchClose} activeOpacity={0.7} style={{ marginLeft: Spacing.xs }}>
            <Feather name="x" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {pinnedMessages.length > 0 && pinnedMessage && (
        <TouchableOpacity style={styles.pinnedBanner} activeOpacity={0.8} onPress={handleScrollToPinned}>
          <Feather name="bookmark" size={14} color={Colors.primary} style={{ flexShrink: 0 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pinnedLabel}>
              {pinnedMessages.length > 1 ? `Pinned (${pinnedIndex + 1}/${pinnedMessages.length})` : 'Pinned Message'}
            </Text>
            <Text style={styles.pinnedText} numberOfLines={1}>
              {pinnedMessage.text || pinnedMessage.caption || pinnedMessage.fileName || '📎 Media'}
            </Text>
          </View>
          {pinnedMessages.length > 1 && (
            <View style={{ flexDirection: 'row', gap: 2 }}>
              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={handlePinnedPrev}>
                <Feather name="chevron-up" size={14} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={handlePinnedNext}>
                <Feather name="chevron-down" size={14} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => { if (chatId && pinnedMessage) unpinMessage(chatId, pinnedMessage.id); }}
          >
            <Feather name="x" size={14} color={Colors.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior="padding">
          {messageList}
          {selectBar}
          {editBar}
          {inputArea}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.keyboardAvoidingView}>
          {messageList}
          {selectBar}
          {editBar}
          {inputArea}
        </View>
      )}

      <ChatScreenModals
        id={id}
        name={name}
        avatar={avatar}
        payIdentifier={payIdentifier}
        navigation={navigation}
        chatId={chatId}
        sendText={sendText}
        showAttachment={showAttachment}
        attachmentAnchor={attachmentAnchor}
        handleCloseAttachment={handleCloseAttachment}
        handlePickPhoto={handlePickPhoto}
        handleOpenCamera={handleOpenCamera}
        handlePickDocument={handlePickDocument}
        handleShareLocation={handleShareLocation}
        setPaymentSheet={setPaymentSheet}
        showMoreMenu={showMoreMenu}
        menuAnchor={menuAnchor}
        handleCloseMoreMenu={handleCloseMoreMenu}
        moreMenuActions={moreMenuActions}
        effectiveMuted={effectiveMuted}
        showCallMenu={showCallMenu}
        callMenuAnchor={callMenuAnchor}
        handleCloseCallMenu={handleCloseCallMenu}
        handleAudioCall={handleAudioCall}
        handleVideoCall={handleVideoCall}
        selectedMessage={selectedMessage}
        handleCloseMessageModal={handleCloseMessageModal}
        messageActions={messageActions}
        chatBubbleColor={chatBubbleColor}
        addReaction={addReaction}
        showForwardModal={showForwardModal}
        setShowForwardModal={setShowForwardModal}
        forwardMessage={forwardMessage}
        handleForwardAction={handleForwardAction}
        paymentSheet={paymentSheet}
        showBlockModal={showBlockModal}
        setShowBlockModal={setShowBlockModal}
        showReportModal={showReportModal}
        setShowReportModal={setShowReportModal}
        setToastMessage={setToastMessage}
        showFab={showFab}
        fabAnim={fabAnim}
        fabUnread={fabUnread}
        handleScrollToBottom={handleScrollToBottom}
        fullScreenUri={fullScreenUri}
        setFullScreenUri={setFullScreenUri}
        showGifPicker={showGifPicker}
        setShowGifPicker={setShowGifPicker}
        handleSendSticker={handleSendSticker}
        showStickerPicker={showStickerPicker}
        setShowStickerPicker={setShowStickerPicker}
        showContactPicker={showContactPicker}
        setShowContactPicker={setShowContactPicker}
        handleShareContact={handleShareContact}
        showPollCreator={showPollCreator}
        setShowPollCreator={setShowPollCreator}
        handleCreatePoll={handleCreatePoll}
        showChatLock={showChatLock}
        handleBiometricUnlock={handleBiometricUnlock}
        handleBack={handleBack}
        toastMessage={toastMessage}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// Styles
// ============================================================================
const createScreenStyles = (Colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1 },
    keyboardAvoidingView: { flex: 1 },
    messagesList: {
      paddingHorizontal: Spacing.sm,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xl,
      gap: 4,
    },
    dateHeaderContainer: { alignItems: 'center', marginVertical: Spacing.sm },
    dateHeaderText: {
      ...Typography.caption,
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textSecondary,
      backgroundColor: isDark ? Colors.surface : 'rgba(0,0,0,0.05)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      overflow: 'hidden',
    },
    keyChangeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(245,158,11,0.3)',
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
    },
    keyChangeBannerText: {
      ...Typography.caption,
      flex: 1,
      color: Colors.textPrimary,
      fontWeight: '500',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      backgroundColor: isDark ? Colors.surface : '#F3F4F6',
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    },
    searchInput: { flex: 1, ...Typography.body, fontSize: 15, color: Colors.textPrimary },
    searchNav: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    searchCount: {
      ...Typography.caption,
      fontSize: 12,
      color: Colors.textSecondary,
      marginRight: 4,
      minWidth: 36,
      textAlign: 'right',
    },
    searchNavBtn: { padding: 4 },
    pinnedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      backgroundColor: isDark ? 'rgba(23,71,23,0.15)' : 'rgba(23,71,23,0.07)',
      borderLeftWidth: 3,
      borderLeftColor: Colors.primary,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
    },
    pinnedLabel: {
      ...Typography.caption,
      fontSize: 11,
      fontWeight: '700',
      color: Colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    pinnedText: { ...Typography.body, fontSize: 13, color: Colors.textPrimary },
    unreadSeparator: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      gap: Spacing.sm,
    },
    unreadLine: { flex: 1, height: 1, backgroundColor: Colors.primary, opacity: 0.3 },
    unreadLabel: {
      ...Typography.caption,
      fontSize: 11,
      fontWeight: '700',
      color: Colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    editBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: isDark ? Colors.surface : '#F0F4EE',
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    editInput: {
      flex: 1,
      ...Typography.body,
      fontSize: 15,
      color: Colors.textPrimary,
      maxHeight: 80,
    },
    selectBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      gap: Spacing.sm,
    },
    selectBarCancel: { padding: 4 },
    selectBarCount: { flex: 1, ...Typography.body, fontWeight: '600', fontSize: 15 },
    selectBarActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    selectBarBtn: { padding: 8 },
  });
