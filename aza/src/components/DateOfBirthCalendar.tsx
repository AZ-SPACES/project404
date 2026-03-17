import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Calendar, DateData } from "react-native-calendars";
import { Colors, Typography, Spacing, Radius } from "../theme";

const NOOP_HEADER = () => null;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DateOfBirthCalendarProps {
  selectedDate: string;
  onDateSelect: (dateString: string) => void;
  currentMonth: string;
  onMonthChange: (dateString: string) => void;
  maxDate?: string;
}

export default function DateOfBirthCalendar({
  selectedDate,
  onDateSelect,
  currentMonth,
  onMonthChange,
  maxDate,
}: DateOfBirthCalendarProps) {
  const [viewMode, setViewMode] = useState<"calendar" | "month" | "year">("calendar");
  const [pickerYear, setPickerYear] = useState(() => new Date(currentMonth).getFullYear());
  const [yearPageStart, setYearPageStart] = useState(() => {
    const y = new Date(currentMonth).getFullYear();
    return Math.floor(y / 12) * 12;
  });

  const maxDateStr = useMemo(() => {
    if (maxDate) return maxDate;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [maxDate]);

  const maxD = useMemo(() => new Date(maxDateStr), [maxDateStr]);
  const maxYear = maxD.getFullYear();
  const maxMonth = maxD.getMonth();

  // Calculate years for the current page
  const yearsOnPage = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => yearPageStart + i);
  }, [yearPageStart]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDayPress = useCallback((day: DateData) => onDateSelect(day.dateString), [onDateSelect]);
  const handleMonthChange = useCallback((month: DateData) => onMonthChange(month.dateString), [onMonthChange]);

  const togglePicker = useCallback(() => {
    if (viewMode === "calendar") {
      setPickerYear(new Date(currentMonth).getFullYear());
      setViewMode("month");
    } else {
      setViewMode("calendar");
    }
  }, [viewMode, currentMonth]);

  const selectMonthAndYear = useCallback((monthIndex: number) => {
    const mm = String(monthIndex + 1).padStart(2, "0");
    onMonthChange(`${pickerYear}-${mm}-01`);
    setViewMode("calendar");
  }, [pickerYear, onMonthChange]);

  const selectYear = useCallback((year: number) => {
    setPickerYear(year);
    setViewMode("month");
  }, []);

  const incrementYearPage = () => setYearPageStart((prev) => prev + 12);
  const decrementYearPage = () => setYearPageStart((prev) => prev - 12);

  const goToPrevMonth = useCallback(() => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }, [currentMonth, onMonthChange]);

  const goToNextMonth = useCallback(() => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }, [currentMonth, onMonthChange]);

  const incrementPickerYear = () => setPickerYear((prev) => prev + 1);
  const decrementPickerYear = () => setPickerYear((prev) => prev - 1);

  // ── Memoised configurations ─────────────────────────────────────────────────

  const markedDates = useMemo(() => selectedDate ? {
    [selectedDate]: { selected: true, selectedColor: Colors.primary, selectedTextColor: Colors.surface },
  } : {}, [selectedDate, Colors.primary, Colors.surface]);

  const calendarTheme = useMemo(() => ({
    backgroundColor: "transparent",
    calendarBackground: "transparent",
    textSectionTitleColor: Colors.textSecondary,
    selectedDayBackgroundColor: Colors.primary,
    selectedDayTextColor: Colors.surface,
    todayTextColor: Colors.primary,
    dayTextColor: Colors.textPrimary,
    textDisabledColor: Colors.border,
    arrowColor: Colors.secondary,
    monthTextColor: Colors.textPrimary,
    textDayFontWeight: Typography.bodyLg.fontWeight,
    textMonthFontWeight: Typography.h3.fontWeight,
    textDayHeaderFontWeight: Typography.h3.fontWeight,
    textDayFontSize: Typography.bodyLg.fontSize,
    textMonthFontSize: Typography.h3.fontSize,
    textDayHeaderFontSize: Typography.caption.fontSize,
    // @ts-ignore
    "stylesheet.calendar.header": { week: { marginTop: Spacing.xs, flexDirection: "row", justifyContent: "space-around" } },
  }), []);

  const headerText = useMemo(() => {
    const d = new Date(currentMonth);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }, [currentMonth]);

  // ── Render Helpers ─────────────────────────────────────────────────────────

  // Exact height calculation for getItemLayout was removed

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={togglePicker} style={styles.monthSelector}>
          <Text style={styles.monthText}>{headerText}</Text>
          <MaterialIcons 
            name={viewMode !== "calendar" ? "keyboard-arrow-down" : "chevron-right"} 
            size={22} color={Colors.textSecondary} 
          />
        </TouchableOpacity>

        {viewMode === "calendar" && (
          <View style={styles.arrowGroup}>
            <TouchableOpacity onPress={goToPrevMonth} style={styles.arrowButton}>
              <MaterialIcons name="chevron-left" size={24} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={goToNextMonth} style={styles.arrowButton}>
              <MaterialIcons name="chevron-right" size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {viewMode === "calendar" && (
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
      )}

      {viewMode === "month" && (
        <View style={styles.pickerContainer}>
          <View style={styles.yearSelectorRow}>
            <TouchableOpacity onPress={decrementPickerYear} style={styles.yearArrow}>
              <MaterialIcons name="chevron-left" size={28} color={Colors.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.yearTextButton} onPress={() => setViewMode("year")}>
              <Text style={styles.pickerYearText}>{pickerYear}</Text>
              <MaterialIcons name="arrow-drop-down" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={incrementPickerYear} style={styles.yearArrow}
              disabled={pickerYear >= maxYear}
            >
              <MaterialIcons name="chevron-right" size={28} color={pickerYear >= maxYear ? Colors.border : Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.monthGrid}>
            {MONTH_NAMES.map((month, index) => {
              const isDisabled = pickerYear >= maxYear && index > maxMonth;
              const isSelected = pickerYear === new Date(currentMonth).getFullYear() && index === new Date(currentMonth).getMonth();

              return (
                <TouchableOpacity
                  key={month}
                  style={[styles.gridItem, isSelected && styles.gridItemSelected]}
                  disabled={isDisabled}
                  onPress={() => selectMonthAndYear(index)}
                >
                  <Text style={[styles.gridItemText, isSelected && styles.gridItemTextSelected, isDisabled && styles.gridItemTextDisabled]}>
                    {month.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {viewMode === "year" && (
        <View style={styles.pickerContainer}>
          <View style={styles.yearSelectorRow}>
            <TouchableOpacity onPress={decrementYearPage} style={styles.yearArrow}>
              <MaterialIcons name="chevron-left" size={28} color={Colors.primary} />
            </TouchableOpacity>
            
            <View style={styles.yearTextButton}>
              <Text style={styles.pickerYearText}>{yearPageStart} - {yearPageStart + 11}</Text>
            </View>

            <TouchableOpacity 
              onPress={incrementYearPage} style={styles.yearArrow}
              disabled={yearPageStart + 11 >= maxYear}
            >
              <MaterialIcons name="chevron-right" size={28} color={yearPageStart + 11 >= maxYear ? Colors.border : Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.monthGrid}>
            {yearsOnPage.map((y) => {
              const isDisabled = y > maxYear;
              const isSelected = y === pickerYear;

              return (
                <TouchableOpacity
                  key={y}
                  style={[styles.gridItem, isSelected && styles.gridItemSelected]}
                  disabled={isDisabled}
                  onPress={() => selectYear(y)}
                >
                  <Text style={[styles.gridItemText, isSelected && styles.gridItemTextSelected, isDisabled && styles.gridItemTextDisabled]}>
                    {y}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  calendarContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm + Spacing.xs, // 12
    paddingTop: Spacing.sm + Spacing.xs, // 12
    paddingBottom: Spacing.sm, // 8
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 350, 
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
  },
  monthText: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  arrowGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  arrowButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  pickerContainer: {
    flex: 1,
    paddingTop: 8,
  },
  yearSelectorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg, // 24
    paddingHorizontal: Spacing.md, // 16
  },
  yearTextButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  pickerYearText: {
    fontSize: Typography.h3.fontSize + 2,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  yearArrow: {
    padding: Spacing.xs,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  
  // Shared Grid Item Styles (Used by both Month and Year)
  gridItem: {
    width: "30%",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },
  gridItemSelected: { backgroundColor: Colors.primary },
  gridItemText: { 
    ...Typography.bodyLg,
    color: Colors.textPrimary, 
  },
  gridItemTextSelected: { color: Colors.surface, fontWeight: "600" },
  gridItemTextDisabled: { color: Colors.border },
});