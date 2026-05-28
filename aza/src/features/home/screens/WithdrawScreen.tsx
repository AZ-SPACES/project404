import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme, Typography, Spacing, Radius } from "../../../theme";
import { useNavigation } from "@react-navigation/native";
import { Feather } from '@react-native-vector-icons/feather';
import { BackButton } from "../../../components/ui/BackButton";

export function WithdrawScreen() {
  const { colors: Colors } = useAppTheme();
  const navigation = useNavigation();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[Typography.h2, { color: Colors.textPrimary, marginLeft: Spacing.md }]}>
          Withdraw
        </Text>
      </View>
      <View style={styles.content}>
        <Text style={[Typography.body, { color: Colors.textSecondary, marginTop: Spacing.xl }]}>
          Withdraw functionality coming soon.
        </Text>
      </View>
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
    flex: 1,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
});
