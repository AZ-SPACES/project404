import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../theme";

type Props = {
  step: number;
  total: number;
};

export default function SignUpProgressBar({ step, total }: Props) {
  const { colors: Colors } = useAppTheme();
  const pct = `${Math.min((step / total) * 100, 100)}%` as `${number}%`;

  return (
    <View style={styles.container}>
      <View style={[styles.track, { backgroundColor: Colors.border }]}>
        <View style={[styles.fill, { width: pct, backgroundColor: Colors.primary }]} />
      </View>
      <Text style={[styles.label, { color: Colors.textSecondary }]}>
        Step {step} of {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 6,
  },
  track: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    width: "100%",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
  },
});
