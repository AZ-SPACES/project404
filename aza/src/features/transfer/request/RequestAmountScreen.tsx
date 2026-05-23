import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    Pressable,
    ScrollView,
    Animated,
    Dimensions,
    StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, Typography, Spacing, ThemeColors } from '../../../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';

type RequestAmountScreenProps = NativeStackScreenProps<RootStackParamList, 'RequestAmount'>;

export default function RequestAmountScreen({ navigation, route }: RequestAmountScreenProps) {
    const { name, username, avatar } = route.params;
    const { colors: Colors } = useAppTheme();
    const styles = React.useMemo(() => createStyles(Colors), [Colors]);
    const isDark = Colors.isDark;
    const [amount, setAmount] = useState('0.00');
    const [note, setNote] = useState('');
    const amountInputRef = useRef<TextInput>(null);

    const [isSuccessModalVisible, setSuccessModalVisible] = useState(false);
    const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const showSuccessModal = () => {
        setSuccessModalVisible(true);
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                bounciness: 0,
                speed: 12,
                useNativeDriver: true,
            })
        ]).start();
    };

    const hideSuccessModal = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: Dimensions.get('window').height,
                duration: 250,
                useNativeDriver: true,
            })
        ]).start(() => {
            setSuccessModalVisible(false);
            navigation.goBack();
        });
    };

    const numericAmount = amount === '' || amount === '.' ? 0 : (parseFloat(amount) || 0);
    const displayAmount = numericAmount > 0 ? numericAmount.toFixed(2) : '0.00';

    const handleAmountChange = (text: string) => {
        const cleaned = text.replace(/[^0-9.]/g, '');
        const dotCount = (cleaned.match(/\./g) || []).length;
        if (dotCount > 1) return;
        const dotIndex = cleaned.indexOf('.');
        if (dotIndex !== -1 && cleaned.length - dotIndex - 1 > 2) return;
        const intPart = dotIndex !== -1 ? cleaned.slice(0, dotIndex) : cleaned;
        if (intPart.length > 8) return;
        setAmount(cleaned);
    };

    const handleAmountFocus = () => {
        if (amount === '0.00') {
            setAmount('');
        }
    };

    const handleAmountBlur = () => {
        if (amount === '' || amount === '.') {
            setAmount('0.00');
            return;
        }
        const num = parseFloat(amount);
        if (isNaN(num)) {
            setAmount('0.00');
            return;
        }
        setAmount(num.toFixed(2));
    };

    const handleRequest = () => {
        if (numericAmount <= 0) return;
        // Handle request logic
        showSuccessModal();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
            >
                <Pressable style={styles.flex} onPress={Keyboard.dismiss}>
                  <ScrollView
                      style={styles.flex}
                      contentContainerStyle={styles.scrollContent}
                      bounces={false}
                      keyboardShouldPersistTaps="handled"
                  >
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                style={styles.backButton}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Feather name="chevron-left" size={24} color={Colors.textPrimary} style={styles.backicon} />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>Request Money</Text>
                            <View style={styles.backButtonPlaceholder} />
                        </View>

                        {/* Recipient Card */}
                        <View style={styles.recipientCard}>
                            <Image source={{ uri: avatar }} style={styles.recipientAvatar} />
                            <View style={styles.recipientInfo}>
                                <Text style={styles.recipientName}>{name}</Text>
                                <Text style={styles.recipientUsername}>{username}</Text>
                            </View>
                            <View style={styles.recipientBadge}>
                                <Feather name="check" size={14} color={Colors.primary} />
                            </View>
                        </View>

                        {/* Amount Section */}
                        <View style={styles.amountCard}>
                            <Text style={styles.amountLabel}>Enter amount</Text>
                            <TouchableOpacity
                                style={styles.amountRow}
                                activeOpacity={1}
                                onPress={() => amountInputRef.current?.focus()}
                            >
                                <Text style={styles.currencySymbol}>GH¢</Text>
                                <TextInput
                                    ref={amountInputRef}
                                    style={styles.amountInput}
                                    value={amount}
                                    onChangeText={handleAmountChange}
                                    onFocus={handleAmountFocus}
                                    onBlur={handleAmountBlur}
                                    keyboardType="decimal-pad"
                                    selectionColor={Colors.primary}
                                    returnKeyType="done"
                                    maxLength={12}
                                />
                            </TouchableOpacity>

                            {/* Fee indicator */}
                            <View style={styles.feeRow}>
                                <Feather name="info" size={14} color={Colors.primary} />
                                <Text style={styles.feeText}>No fees on requests</Text>
                            </View>
                        </View>

                        {/* Spacer */}
                        <View style={styles.spacer} />

                        {/* Note Input */}
                        <View style={styles.noteContainer}>
                            <View style={styles.noteInputRow}>
                                <Feather
                                    name="edit-3"
                                    size={18}
                                    color={Colors.textSecondary}
                                    style={styles.noteIcon}
                                />
                                <TextInput
                                    style={styles.noteInput}
                                    placeholder="Add a note"
                                    placeholderTextColor={Colors.textSecondary}
                                    value={note}
                                    onChangeText={setNote}
                                    returnKeyType="done"
                                    maxLength={100}
                                />
                            </View>
                        </View>

                        {/* Request Button */}
                        <TouchableOpacity
                            style={[
                                styles.requestButton,
                                numericAmount > 0 && styles.requestButtonActive,
                            ]}
                            activeOpacity={0.7}
                            onPress={handleRequest}
                            disabled={numericAmount <= 0}
                        >
                            <Feather
                                name="arrow-down"
                                size={18}
                                color={numericAmount > 0 ? Colors.white : Colors.textSecondary}
                                style={styles.requestIcon}
                            />
                            <Text
                                style={[
                                    styles.requestButtonText,
                                    numericAmount > 0 && styles.requestButtonTextActive,
                                ]}
                            >
                                Request GH¢ {displayAmount}
                            </Text>
                        </TouchableOpacity>
                  </ScrollView>
                </Pressable>
            </KeyboardAvoidingView>

            {/* Success bottom sheet */}
            <View style={StyleSheet.absoluteFill} pointerEvents={isSuccessModalVisible ? 'auto' : 'none'}>
                <Animated.View style={[styles.modalBackdrop, { opacity: fadeAnim }]}>
                    <Pressable style={styles.flex} onPress={hideSuccessModal} />
                </Animated.View>
                <Animated.View style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}>
                    <View style={styles.modalContent}>
                        <View style={styles.successIconContainer}>
                            <Feather name="check" size={20} color={Colors.textPrimary} />
                        </View>
                        <Text style={styles.successMessage}>
                            You've requested GH¢ {displayAmount}{'\n'}from {name}
                        </Text>
                    </View>
                </Animated.View>
            </View>
        </SafeAreaView>
    );
}

const AVATAR_SIZE = 48;

function createStyles(Colors: ThemeColors) {
    const isDark = Colors.isDark;
    return StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background },
    flex: {
        flex: 1 },
    scrollContent: {
        flexGrow: 1 },
    spacer: {
        flex: 1,
        minHeight: Spacing.lg },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 50,
        backgroundColor: isDark ? Colors.surface : Colors.white,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center' },
    backicon: {
        fontSize: 28,
        color: Colors.textPrimary },
    headerTitle: {
        ...Typography.body,
        fontWeight: '600',
        color: Colors.textPrimary },
    backButtonPlaceholder: {
        width: 44 },

    // Recipient
    recipientCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.md,
        backgroundColor: isDark ? Colors.surface : Colors.white,
        borderRadius: 12,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border },
    recipientAvatar: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        backgroundColor: Colors.border },
    recipientInfo: {
        flex: 1,
        marginLeft: Spacing.md },
    recipientName: {
        ...Typography.body,
        fontWeight: '600',
        color: Colors.textPrimary },
    recipientUsername: {
        ...Typography.caption,
        color: Colors.textSecondary,
        marginTop: 2 },
    recipientBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.secondary,
        alignItems: 'center',
        justifyContent: 'center' },

    // Amount
    amountCard: {
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.md,
        backgroundColor: isDark ? Colors.surface : Colors.white,
        borderRadius: 12,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border },
    amountLabel: {
        ...Typography.caption,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm },
    amountRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border },
    currencySymbol: {
        fontSize: 36,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginRight: Spacing.xs },
    amountInput: {
        flex: 1,
        fontSize: 36,
        fontWeight: '700',
        color: Colors.textPrimary,
        padding: 0 },
    feeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.md,
        gap: 6 },
    feeText: {
        ...Typography.caption,
        color: Colors.primary,
        fontWeight: '500' },

    // Note
    noteContainer: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md },
    noteInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? Colors.surface : Colors.white,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 12,
        paddingHorizontal: Spacing.md,
        paddingVertical: 14 },
    noteIcon: {
        marginRight: Spacing.sm },
    noteInput: {
        flex: 1,
        ...Typography.body,
        color: Colors.textPrimary,
        padding: 0 },

    // Request
    requestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
        backgroundColor: isDark ? Colors.surface : Colors.border,
        borderRadius: 12,
        paddingVertical: 16 },
    requestButtonActive: {
        backgroundColor: Colors.primary },
    requestIcon: {
        marginRight: Spacing.sm },
    requestButtonText: {
        ...Typography.button,
        color: Colors.textSecondary },
    requestButtonTextActive: {
        color: Colors.white },
        
    // Success bottom sheet
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    modalSheet: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        backgroundColor: isDark ? Colors.background : Colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: Spacing.xl,
        paddingHorizontal: Spacing.xl,
        paddingBottom: Platform.OS === 'ios' ? 48 : Spacing.xl * 2,
    },
    modalContent: {
        alignItems: 'center',
    },
    successIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: isDark ? Colors.surface : '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
    },
    successMessage: {
        ...Typography.body,
        fontWeight: '600',
        color: Colors.textPrimary,
        textAlign: 'center',
        marginBottom: Spacing.xl * 2,
    } });
}
