import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme, Typography, Spacing, Radius } from "../../../theme";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import Button from "../../../components/ui/Button";

const DURATIONS = [
  { id: '1m', label: 'Last 30 Days' },
  { id: '3m', label: 'Last 3 Months' },
  { id: '6m', label: 'Last 6 Months' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom Date Range' },
];

export function StatementDownloadScreen() {
  const { colors: Colors, isDark } = useAppTheme();
  const navigation = useNavigation();
  const [selectedDuration, setSelectedDuration] = useState('1m');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const onDayPress = (day: any) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(day.dateString);
      setEndDate('');
    } else if (startDate && !endDate) {
      if (day.dateString > startDate) {
        setEndDate(day.dateString);
      } else {
        setStartDate(day.dateString);
      }
    }
  };

  const getMarkedDates = () => {
    let marked: any = {};
    if (startDate) {
      marked[startDate] = { startingDay: true, color: Colors.primary, textColor: 'white' };
    }
    if (endDate) {
      marked[endDate] = { endingDay: true, color: Colors.primary, textColor: 'white' };
    }
    if (startDate && endDate) {
      let current = new Date(startDate);
      current.setDate(current.getDate() + 1);
      const end = new Date(endDate);
      while (current < end) {
        const dateString = current.toISOString().split('T')[0];
        if (dateString) {
          marked[dateString] = { color: Colors.primary + '40', textColor: isDark ? 'white' : 'black' };
        }
        current.setDate(current.getDate() + 1);
      }
    }
    return marked;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[Typography.h2, { color: Colors.textPrimary, marginLeft: Spacing.md }]}>
          Account Statement
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[Typography.body, { color: Colors.textSecondary, marginBottom: Spacing.xl }]}>
          Select the duration for your statement. We will generate a PDF of your transactions.
        </Text>

        {DURATIONS.map((duration) => {
          const isSelected = selectedDuration === duration.id;
          return (
            <TouchableOpacity
              key={duration.id}
              style={[
                styles.optionButton,
                { 
                  backgroundColor: isDark ? Colors.surface : Colors.white,
                  borderColor: isSelected ? Colors.primary : Colors.border,
                  borderWidth: isSelected ? 2 : 1,
                }
              ]}
              onPress={() => setSelectedDuration(duration.id)}
              activeOpacity={0.7}
            >
              <Text style={[
                Typography.bodyLg, 
                { color: isSelected ? Colors.primary : Colors.textPrimary, fontWeight: isSelected ? "600" : "400" }
              ]}>
                {duration.label}
              </Text>
              {isSelected && (
                <Feather name="check-circle" size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
          );
        })}

        {selectedDuration === 'custom' && (
          <View style={styles.calendarContainer}>
            <Calendar
              markingType={'period'}
              markedDates={getMarkedDates()}
              onDayPress={onDayPress}
              theme={{
                backgroundColor: Colors.background,
                calendarBackground: isDark ? Colors.surface : Colors.white,
                textSectionTitleColor: Colors.textSecondary,
                selectedDayBackgroundColor: Colors.primary,
                selectedDayTextColor: '#ffffff',
                todayTextColor: Colors.primary,
                dayTextColor: Colors.textPrimary,
                textDisabledColor: Colors.textSecondary + '80',
                monthTextColor: Colors.textPrimary,
                arrowColor: Colors.primary,
              }}
            />
          </View>
        )}

        <View style={styles.actionButtons}>
          <Button
            title="Download PDF"
            onPress={() => {}}
            backgroundColor={Colors.primary}
            textColor={Colors.white}
            leftIcon={<Feather name="download" size={20} color={Colors.white} />}
          />

          <Button
            title="Send via Email"
            onPress={() => {}}
            backgroundColor={isDark ? Colors.surface : Colors.white}
            textColor={Colors.textPrimary}
            style={{ borderWidth: 1, borderColor: Colors.border }}
            leftIcon={<Feather name="mail" size={20} color={Colors.textPrimary} />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  optionButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  calendarContainer: {
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb", // fallback border, overriden by theme mostly
  },
  actionButtons: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
});
