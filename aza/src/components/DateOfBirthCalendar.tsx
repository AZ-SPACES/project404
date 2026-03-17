import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Calendar, DateData } from 'react-native-calendars';
import { Colors, Typography, Spacing, Radius } from '../theme';

// Stable reference – avoids creating a new function on every Calendar render
const NOOP_HEADER = () => null;

// ── Month name lookup ──────────────────────────────────────────────────────────
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Props ──────────────────────────────────────────────────────────────────────
interface DateOfBirthCalendarProps {
    selectedDate: string;
    onDateSelect: (dateString: string) => void;
    currentMonth: string;
    onMonthChange: (dateString: string) => void;
    maxDate?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────
function DateOfBirthCalendar({
    selectedDate,
    onDateSelect,
    currentMonth,
    onMonthChange,
    maxDate,
}: DateOfBirthCalendarProps) {
    const [showPicker, setShowPicker] = useState(false);

    const maxDateStr = useMemo(() => {
        if (maxDate) return maxDate;
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }, [maxDate]);

    // ── Handlers ───────────────────────────────────────────────────────────────

    const handlePickerChange = useCallback(
        (_event: any, selected?: Date) => {
            if (Platform.OS === 'android') setShowPicker(false);
            if (selected) {
                const yyyy = selected.getFullYear();
                const mm = String(selected.getMonth() + 1).padStart(2, '0');
                onMonthChange(`${yyyy}-${mm}-01`);
            }
        },
        [onMonthChange],
    );

    const handleDayPress = useCallback(
        (day: DateData) => onDateSelect(day.dateString),
        [onDateSelect],
    );

    const handleMonthChange = useCallback(
        (month: DateData) => onMonthChange(month.dateString),
        [onMonthChange],
    );

    const openPicker = useCallback(() => setShowPicker(true), []);
    const closePicker = useCallback(() => setShowPicker(false), []);

    const goToPrevMonth = useCallback(() => {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() - 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        onMonthChange(`${yyyy}-${mm}-01`);
    }, [currentMonth, onMonthChange]);

    const goToNextMonth = useCallback(() => {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() + 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        onMonthChange(`${yyyy}-${mm}-01`);
    }, [currentMonth, onMonthChange]);

    // ── Memoised objects ───────────────────────────────────────────────────────

    const markedDates = useMemo(
        () =>
            selectedDate
                ? {
                      [selectedDate]: {
                          selected: true,
                          selectedColor: '#007AFF',
                          selectedTextColor: '#ffffff',
                      },
                  }
                : {},
        [selectedDate],
    );

    const calendarTheme = useMemo(
        () => ({
            backgroundColor: 'transparent',
            calendarBackground: 'transparent',
            textSectionTitleColor: '#8E8E93',
            selectedDayBackgroundColor: '#007AFF',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#007AFF',
            dayTextColor: '#1C1C1E',
            textDisabledColor: '#C7C7CC',
            arrowColor: '#007AFF',
            monthTextColor: '#1C1C1E',
            textDayFontWeight: '400' as const,
            textMonthFontWeight: '600' as const,
            textDayHeaderFontWeight: '600' as const,
            textDayFontSize: 16,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 10,
            // @ts-ignore
            'stylesheet.calendar.header': {
                week: {
                    marginTop: 4,
                    flexDirection: 'row' as const,
                    justifyContent: 'space-around' as const,
                },
            },
        }),
        [],
    );

    // ── Derived values ──────────────────────────────────────────────────────────
    const headerText = useMemo(() => {
        const d = new Date(currentMonth);
        return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    }, [currentMonth]);

    // Stable Date objects for the picker – avoids allocating on every render
    const pickerValue = useMemo(() => new Date(currentMonth), [currentMonth]);
    const maximumDate = useMemo(() => new Date(), []);

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <View style={styles.calendarContainer}>
            {/* Header: month/year left, arrows right */}
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={openPicker} style={styles.monthSelector}>
                    <Text style={styles.monthText}>{headerText}</Text>
                    <MaterialIcons name="chevron-right" size={20} color="#8E8E93" />
                </TouchableOpacity>

                <View style={styles.arrowGroup}>
                    <TouchableOpacity onPress={goToPrevMonth} style={styles.arrowButton}>
                        <MaterialIcons name="chevron-left" size={22} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={goToNextMonth} style={styles.arrowButton}>
                        <MaterialIcons name="chevron-right" size={22} color="#007AFF" />
                    </TouchableOpacity>
                </View>
            </View>

            <Calendar
                key={currentMonth}
                current={currentMonth}
                onMonthChange={handleMonthChange}
                onDayPress={handleDayPress}
                markedDates={markedDates}
                theme={calendarTheme}
                maxDate={maxDateStr}
                hideArrows
                renderHeader={NOOP_HEADER}
            />

            {/* iOS picker modal */}
            {showPicker && Platform.OS === 'ios' && (
                <Modal visible transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={closePicker}>
                                    <Text style={styles.modalDoneText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={pickerValue}
                                mode="date"
                                display="spinner"
                                onChange={handlePickerChange}
                                maximumDate={maximumDate}
                                themeVariant="light"
                            />
                        </View>
                    </View>
                </Modal>
            )}

            {/* Android picker */}
            {showPicker && Platform.OS === 'android' && (
                <DateTimePicker
                    value={pickerValue}
                    mode="date"
                    display="spinner"
                    onChange={handlePickerChange}
                    maximumDate={maximumDate}
                />
            )}
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    calendarContainer: {
        backgroundColor: '#ffffff',
        borderRadius: Radius.md,
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 8,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    monthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    monthText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1C1C1E',
    },
    arrowGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    arrowButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: Radius.md,
        borderTopRightRadius: Radius.md,
        paddingBottom: Spacing.xl,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    modalDoneText: {
        fontSize: Typography.bodyLg.fontSize,
        fontWeight: '600',
        color: '#007AFF',
    },
});

export default React.memo(DateOfBirthCalendar);
