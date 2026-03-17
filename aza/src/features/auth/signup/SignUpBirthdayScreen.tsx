import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { Colors, Typography, Spacing } from '../../../theme';
import Button from '../../../components/Button';
import DateOfBirthCalendar from '../../../components/DateOfBirthCalendar';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SignUpBirthdayScreen() {
    const navigation = useNavigation<NavigationProp>();

    const [selectedDate, setSelectedDate] = useState<string>('');
    const [currentMonth, setCurrentMonth] = useState<string>('2004-07');

    // ── Stable callbacks ───────────────────────────────────────────────────────

    const handleDateSelect = useCallback((dateString: string) => {
        setSelectedDate(dateString);
    }, []);

    const handleMonthChange = useCallback((dateString: string) => {
        setCurrentMonth(dateString);
    }, []);

    const handleNext = useCallback(() => {
        console.log('Birthday complete!');
    }, []);


    const handleBack = useCallback(() => navigation.goBack(), [navigation]);

    // Derived — avoids inline expression in JSX causing Button re-renders
    const isDisabled = useMemo(() => !selectedDate, [selectedDate]);

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContentContainer}
                >
                    <Text style={styles.title}>When were you born?</Text>
                    <Text style={styles.subtitle}>
                        We may surprise you with a birthday gift.
                    </Text>

                    {/* Reusable calendar component */}
                    <DateOfBirthCalendar
                        selectedDate={selectedDate}
                        onDateSelect={handleDateSelect}
                        currentMonth={currentMonth}
                        onMonthChange={handleMonthChange}
                    />
                </ScrollView>

                {/* Footer */}
                <View style={styles.buttonContainer}>
                    <Button
                        title="Continue"
                        onPress={handleNext}
                        backgroundColor={Colors.primary}
                        textColor={Colors.secondary}
                        borderRadius={30}
                        paddingVertical={16}
                        fontSize={Number(Typography.button.fontSize)}
                        fontWeight={Typography.button.fontWeight as any}
                        disabled={isDisabled}
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.md,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 50,
        backgroundColor: 'rgba(22,51,0,0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipText: {
        fontSize: Typography.body.fontSize,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    content: {
        flex: 1,
    },
    scrollContentContainer: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.xl,
    },
    title: {
        fontSize: 34,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
        lineHeight: 20,
        marginBottom: Spacing.xl,
    },
    buttonContainer: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
});