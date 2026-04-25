import React, { ComponentProps } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  ThemeColors,
  Typography,
  Radius,
} from "../../../theme";
import { useAppTheme } from "../../../theme";

type ActionTargetProps = {
  icon: ComponentProps<typeof Feather>["name"];
  label: string;
  onPress?: () => void;
};

export function ActionTarget({ icon, label, onPress }: ActionTargetProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  return (
    <TouchableOpacity
      style={styles.actionContainer}
      activeOpacity={0.7}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.actionIconCircle}>
        <Feather name={icon} size={24} color={Colors.white} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    actionContainer: {
      alignItems: "center",
    },
    actionIconCircle: {
      width: 56,
      height: 56,
      borderRadius: Radius.full,
      backgroundColor: Colors.black30,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8, // Spacing.sm
    },
    actionLabel: {
      ...Typography.body,
      fontWeight: "600",
      color: Colors.white,
    },
  });
}
