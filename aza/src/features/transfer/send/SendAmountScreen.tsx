import React, { useState, useRef, useEffect } from 'react';
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
    StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, Typography, Spacing, ThemeColors } from '../../../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { getWalletBalance } from '../../../services/api';
import { formatCurrency } from '../../../utils/transactionUtils';

type SendAmountScreenProps = NativeStackScreenProps<RootStackParamList, 'SendAmount'>;

export default function SendAmountScreen({ navigation, route }: SendAmountScreenProps) {
    const { name, username, avatar, identifier } = route.params;
    const { colors: Colors } = useAppTheme();
    const styles = React.useMemo(() => createStyles(Colors), [Colors]);
    const isDark = Colors.isDark;
    const [amount, setAmount] = useState('0.00');
    const [note, setNote] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [balance, setBalance] = useState<number | null>(null);
    const [balanceCurrency, setBalanceCurrency] = useState('GHS');
    const amountInputRef = useRef<TextInput>(null);

    useEffect(() => {
        let cancelled = false;
        getWalletBalance()
            .then(res => {
                if (cancelled) return;
                const data = res.data?.data || res.data;
                setBalance(data.balance);
                setBalanceCurrency(data.currency || 'GHS');
            })
            .catch(() => { /* balance remains null — safe */ });
        return () => { cancelled = true; };
    }, []);

    const numericAmount = amount === '' || amount === '.' ? 0 : (parseFloat(amount) || 0);
    const displayAmount = numericAmount > 0 ? numericAmount.toFixed(2) : '0.00';
    const isOverBalance = balance !== null && numericAmount > balance;
    const canSend = numericAmount > 0 && !isLoading && !isOverBalance;

    const handleAmountChange = (text: string) => {
        // Allow only digits and a single decimal point
        const cleaned = text.replace(/[^0-9.]/g, '');

        // Reject multiple decimal points
        const dotCount = (cleaned.match(/\./g) || []).length;
        if (dotCount > 1) return;

        // If there's a decimal, allow at most 2 digits after it
        const dotIndex = cleaned.indexOf('.');
        if (dotIndex !== -1 && cleaned.length - dotIndex - 1 > 2) return;

        // Cap integer part at 8 digits
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

    const handleSend = () => {
        if (!canSend) return;
        setIsLoading(true);
        navigation.navigate('SendConfirm', {
            name,
            username,
            avatar,
            amount: numericAmount,
            note,
            identifier,
        });
        // Reset after navigation so button is re-enabled if user goes back
        setTimeout(() => setIsLoading(false), 500);
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
                            <Text style={styles.headerTitle}>Send Money</Text>
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
                                    accessibilityLabel="Enter amount in cedis"
                                />
                            </TouchableOpacity>

                            {/* Fee indicator */}
                            <View style={styles.feeRow}>
                                <Feather name="info" size={14} color={Colors.primary} />
                                <Text style={styles.feeText}>No transfer fees</Text>
                            </View>

                            {/* Balance */}
                            <View style={styles.balanceRow}>
                                <Text style={styles.balanceLabel}>Available balance:</Text>
                                <Text style={styles.balanceAmount}>
                                    {balance !== null
                                        ? formatCurrency(balance, balanceCurrency)
                                        : '—'}
                                </Text>
                            </View>

                            {/* Over-limit warning */}
                            {isOverBalance && (
                                <View style={styles.warningRow}>
                                    <Feather name="alert-circle" size={13} color={Colors.error || '#EF4444'} />
                                    <Text style={[styles.feeText, { color: Colors.error || '#EF4444', marginLeft: 4 }]}>
                                        Amount exceeds your balance
                                    </Text>
                                </View>
                            )}
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
                                    accessibilityLabel="Add a note"
                                />
                            </View>
                        </View>

                        {/* Send Button */}
                        <TouchableOpacity
                            style={[
                                styles.sendButton,
                                canSend && styles.sendButtonActive,
                            ]}
                            activeOpacity={0.7}
                            onPress={handleSend}
                            disabled={!canSend}
                            accessibilityRole="button"
                            accessibilityLabel={`Send GH¢ ${displayAmount}`}
                            accessibilityState={{ disabled: !canSend }}
                        >
                            <Feather
                                name="arrow-up"
                                size={18}
                                color={canSend ? Colors.white : Colors.textSecondary}
                                style={styles.sendIcon}
                            />
                            <Text
                                style={[
                                    styles.sendButtonText,
                                    canSend && styles.sendButtonTextActive,
                                ]}
                            >
                                {isLoading ? 'Preparing…' : `Send GH¢ ${displayAmount}`}
                            </Text>
                        </TouchableOpacity>
                  </ScrollView>
                </Pressable>
            </KeyboardAvoidingView>
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
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: Spacing.sm },
    balanceLabel: {
        ...Typography.caption,
        color: Colors.textSecondary },
    balanceAmount: {
        ...Typography.caption,
        fontWeight: '600',
        color: Colors.textPrimary },
    warningRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.xs },

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

    // Send
    sendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
        backgroundColor: isDark ? Colors.surface : Colors.border,
        borderRadius: 12,
        paddingVertical: 16 },
    sendButtonActive: {
        backgroundColor: Colors.primary },
    sendIcon: {
        marginRight: Spacing.sm },
    sendButtonText: {
        ...Typography.button,
        color: Colors.textSecondary },
    sendButtonTextActive: {
        color: Colors.white } });
}
