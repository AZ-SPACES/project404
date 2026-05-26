import React from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../../theme";
import Button from "../../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "MerchantKYBSubmitted">;

export default function MerchantKYBSubmittedScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();

  const handleGoToDashboard = () => {
    navigation.navigate("MiniApp", { appId: "my_business" });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <View style={styles.container}>
        {/* Center content */}
        <View style={styles.centerContent}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="check-circle" size={64} color={Colors.success} />
          </View>
          <Text style={styles.title}>Application Submitted</Text>
          <Text style={styles.subtitle}>
            Your application is now under review. We typically respond within 1–2 business days.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.buttonContainer}>
          <Button
            title="Go to Dashboard"
            onPress={handleGoToDashboard}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={Radius.sm}
            paddingVertical={16}
            fontSize={Typography.button.fontSize}
            fontWeight={Typography.button.fontWeight}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    container: {
      flex: 1,
      justifyContent: "space-between",
    },
    centerContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Spacing.lg,
    },
    iconContainer: {
      marginBottom: Spacing.xl,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: Colors.textPrimary,
      textAlign: "center",
      letterSpacing: -0.5,
      marginBottom: Spacing.md,
    },
    subtitle: {
      fontSize: 16,
      color: Colors.textSecondary,
      lineHeight: 22,
      textAlign: "center",
    },
    buttonContainer: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
  });
}
