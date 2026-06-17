import React, { useState, useRef, useEffect, useCallback } from 'react';
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
    StatusBar,
    Animated,
    Dimensions
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, Typography, Spacing, ThemeColors } from '../../../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { getWalletBalance, getUserLimits, suggestTransferCategory } from '../../../services/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { formatCurrency } from '../../../utils/transactionUtils';
import { BackButton } from '../../../components/ui/BackButton';
import { CloseButton } from '../../../components/ui/CloseButton';
import { useFocusEffect } from '@react-navigation/native';

const { height } = Dimensions.get('window');

import { CATEGORIES, CategoryKey } from '../../../utils/categories';

type SendAmountScreenProps = NativeStackScreenProps<RootStackParamList, 'SendAmount'>;

export default function SendAmountScreen({ navigation, route }: SendAmountScreenProps) {
    const { name, username, avatar, identifier, amount: initialAmount, note: initialNote } = route.params;
    const { colors: Colors } = useAppTheme();
    const styles = React.useMemo(() => createStyles(Colors), [Colors]);
    const isDark = Colors.isDark;
    const [amount, setAmount] = useState(initialAmount != null && initialAmount > 0 ? initialAmount.toFixed(2) : '0.00');
    const [note, setNote] = useState(initialNote ?? '');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [suggestedCategory, setSuggestedCategory] = useState<CategoryKey | null>(null);
    const [userOverrodeCategory, setUserOverrodeCategory] = useState(false);
    const amountInputRef = useRef<TextInput>(null);

    const bottomSheetAnim = useRef(new Animated.Value(height)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (showCategoryModal) {
            Keyboard.dismiss();
            Animated.parallel([
                Animated.timing(bottomSheetAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
                Animated.timing(backdropAnim, { toValue: 1, duration: 300, useNativeDriver: true })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(bottomSheetAnim, { toValue: height, duration: 300, useNativeDriver: true }),
                Animated.timing(backdropAnim, { toValue: 0, duration: 300, useNativeDriver: true })
            ]).start();
        }
    }, [showCategoryModal, bottomSheetAnim, backdropAnim]);
    // Debounced category suggestion when note changes
    useEffect(() => {
        if (userOverrodeCategory) return;
        const timer = setTimeout(async () => {
            if (!note.trim() && !name) return;
            try {
                const res = await suggestTransferCategory(identifier, note);
                const cat = res.data?.data?.suggestedCategory ?? res.data?.suggestedCategory;
                if (cat && !selectedCategory) {
                    setSuggestedCategory(cat as CategoryKey);
                }
            } catch { /* silent */ }
        }, 600);
        return () => clearTimeout(timer);
    }, [note, identifier, name, selectedCategory, userOverrodeCategory]);

    const { data: walletData } = useQuery({
      queryKey: queryKeys.wallet(),
      queryFn: async () => { const res = await getWalletBalance(); return res.data?.data || res.data; },
      staleTime: 30_000,
    });
    const { data: limitsData } = useQuery({
      queryKey: queryKeys.userLimits(),
      queryFn: async () => { const res = await getUserLimits(); return res.data?.data || res.data; },
      staleTime: 5 * 60_000,
    });
    const balance: number | null = walletData?.balance ?? null;
    const balanceCurrency: string = walletData?.currency ?? 'GHS';
    const singleLimit: number | null = limitsData?.singleTransactionLimitGhs ?? null;

    const numericAmount = amount === '' || amount === '.' ? 0 : (parseFloat(amount) || 0);
    const displayAmount = numericAmount > 0 ? numericAmount.toFixed(2) : '0.00';
    const isOverBalance = balance !== null && numericAmount > balance;
    const isOverSingleLimit = singleLimit !== null && numericAmount > singleLimit;
    const canSend = numericAmount > 0 && !isLoading && !isOverBalance && !isOverSingleLimit;

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

    // Reset loading state whenever the screen regains focus (e.g. user presses Back from SendConfirm).
    useFocusEffect(useCallback(() => { setIsLoading(false); }, []));

    const handleSend = () => {
        if (!canSend) return;
        setIsLoading(true);
        const effectiveCategory = selectedCategory ?? suggestedCategory;
        navigation.navigate('SendConfirm', {
            name: name ?? '',
            username: username ?? '',
            avatar: avatar ?? '',
            amount: numericAmount,
            note,
            identifier,
            ...(effectiveCategory ? { category: effectiveCategory } : {}),
        });
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
                            <BackButton onPress={() => navigation.goBack()} />
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
                                  underlineColorAndroid="transparent"
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

                            {/* Over-balance / over-limit warnings */}
                            {isOverBalance && (
                                <View style={styles.warningRow}>
                                    <Feather name="alert-circle" size={13} color={Colors.error || '#EF4444'} />
                                    <Text style={[styles.feeText, { color: Colors.error || '#EF4444', marginLeft: 4 }]}>
                                        Amount exceeds your balance
                                    </Text>
                                </View>
                            )}
                            {isOverSingleLimit && !isOverBalance && (
                                <View style={styles.warningRow}>
                                    <Feather name="alert-circle" size={13} color={Colors.error || '#EF4444'} />
                                    <Text style={[styles.feeText, { color: Colors.error || '#EF4444', marginLeft: 4 }]}>
                                        Exceeds your single transfer limit of {formatCurrency(singleLimit!, balanceCurrency)}
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
                                  underlineColorAndroid="transparent"
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

                        {/* Category Picker */}
                        <TouchableOpacity
                            style={styles.categoryRow}
                            activeOpacity={0.7}
                            onPress={() => setShowCategoryModal(true)}
                        >
                            {selectedCategory ? (
                                <>
                                    <View style={[styles.categoryIconBadge, { backgroundColor: CATEGORIES.find(c => c.key === selectedCategory)!.color + '1A' }]}>
                                        <Feather name={CATEGORIES.find(c => c.key === selectedCategory)!.icon as any} size={16} color={CATEGORIES.find(c => c.key === selectedCategory)!.color} />
                                    </View>
                                    <Text style={[styles.categorySelectedText, { color: Colors.textPrimary }]}>
                                        {CATEGORIES.find(c => c.key === selectedCategory)!.name}
                                    </Text>
                                </>
                            ) : suggestedCategory ? (
                                <>
                                    <View style={[styles.categoryIconBadge, { backgroundColor: CATEGORIES.find(c => c.key === suggestedCategory)!.color + '1A' }]}>
                                        <Feather name={CATEGORIES.find(c => c.key === suggestedCategory)!.icon as any} size={16} color={CATEGORIES.find(c => c.key === suggestedCategory)!.color} />
                                    </View>
                                    <Text style={[styles.categorySelectedText, { color: Colors.textSecondary }]}>
                                        {CATEGORIES.find(c => c.key === suggestedCategory)!.name}
                                    </Text>
                                    <View style={styles.aiSuggestBadge}>
                                        <Feather name="zap" size={10} color={Colors.primary} />
                                        <Text style={styles.aiSuggestText}>AI</Text>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <Feather name="tag" size={16} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                                    <Text style={styles.categoryPlaceholder}>Add a purpose</Text>
                                </>
                            )}
                            <View style={{ flex: 1 }} />
                            <Feather name="chevron-right" size={16} color={Colors.textSecondary} />
                        </TouchableOpacity>

                        {/* Categories have been moved to the Bottom Sheet below KeyboardAvoidingView */}
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

            {/* Bottom Sheet Overlay */}
            <View
                style={StyleSheet.absoluteFill}
                pointerEvents={showCategoryModal ? "auto" : "none"}
            >
                <Animated.View
                    style={[StyleSheet.absoluteFill, { opacity: backdropAnim, zIndex: 1000 }]}
                >
                    <TouchableOpacity
                        style={styles.bottomSheetBackdrop}
                        activeOpacity={1}
                        onPress={() => setShowCategoryModal(false)}
                    />
                </Animated.View>
                <Animated.View
                    style={[
                        styles.bottomSheetContainer,
                        {
                            zIndex: 1001,
                            transform: [{ translateY: bottomSheetAnim }]
                        },
                    ]}
                >
                    <View style={styles.bottomSheetHeader}>
                        <CloseButton onPress={() => setShowCategoryModal(false)} />
                    </View>
                    
                    <Text style={styles.bottomSheetTitle}>What's this for?</Text>
                    
                    <ScrollView 
                        style={{ maxHeight: height * 0.55 }}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: Spacing.xl }}
                    >
                        {CATEGORIES.map(cat => {
                            const isSelected = selectedCategory === cat.key;
                            return (
                                <TouchableOpacity
                                    key={cat.key}
                                    style={[
                                        styles.categoryListCell,
                                        isSelected && { backgroundColor: isDark ? Colors.surface : '#F8FAFC' }
                                    ]}
                                    activeOpacity={0.7}
                                    onPress={() => { setSelectedCategory(cat.key); setUserOverrodeCategory(true); setSuggestedCategory(null); setShowCategoryModal(false); }}
                                >
                                    <View style={[styles.categoryListIcon, { backgroundColor: cat.color + '1A' }]}>
                                        <Feather name={cat.icon as any} size={20} color={cat.color} />
                                    </View>
                                    <Text style={[styles.categoryListText, isSelected && { fontWeight: '700' }]}>{cat.name}</Text>
                                    {isSelected && (
                                        <Feather name="check" size={20} color={Colors.primary} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}

                        {selectedCategory && (
                            <TouchableOpacity style={styles.clearCategoryBtn} onPress={() => { setSelectedCategory(null); setSuggestedCategory(null); setUserOverrodeCategory(false); setShowCategoryModal(false); }}>
                                <Text style={styles.clearCategoryText}>Clear purpose</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
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

    // Category
    categoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
        backgroundColor: isDark ? Colors.surface : Colors.white,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 12,
        paddingHorizontal: Spacing.md,
        paddingVertical: 14 },
    categoryIconBadge: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8 },
    categorySelectedText: {
        ...Typography.body,
        fontWeight: '600' },
    categoryPlaceholder: {
        ...Typography.body,
        color: Colors.textSecondary },
    aiSuggestBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: Colors.primary + '18',
        borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3,
        marginLeft: 6,
    },
    aiSuggestText: {
        fontSize: 10, fontWeight: '700', color: Colors.primary },
    categoryListCell: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: Spacing.sm,
        borderRadius: 12,
        marginBottom: 4,
    },
    categoryListIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md
    },
    categoryListText: {
        ...Typography.body,
        fontWeight: '500',
        color: Colors.textPrimary,
        flex: 1
    },
    bottomSheetBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)" },
    bottomSheetContainer: {
        position: "absolute",
        bottom: 0,
        width: "100%",
        backgroundColor: isDark ? Colors.background : '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 48,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5 },
    bottomSheetHeader: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginBottom: 16 },
    bottomSheetTitle: {
        ...Typography.h3,
        fontWeight: "700",
        color: Colors.textPrimary,
        marginBottom: Spacing.xl },
    clearCategoryBtn: {
        alignItems: 'center',
        paddingVertical: Spacing.md,
        marginTop: Spacing.sm },
    clearCategoryText: {
        ...Typography.body,
        color: Colors.error || '#EF4444',
        fontWeight: '600' },

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
