import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { Colors, Spacing, Typography, Radius } from "../../theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Feather from "@expo/vector-icons/Feather";
import { AntDesign } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../components/ui/Button";

const { height } = Dimensions.get("window");

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "TalkToUs">;

export default function TalkToUsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [language, setLanguage] = useState("English");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isBottomSheetVisible, setBottomSheetVisible] = useState(false);
  const bottomSheetAnim = useRef(new Animated.Value(height)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const languages = ["English", "Twi", "Ga", "Ewe", "Hausa"];

  useEffect(() => {
    if (isBottomSheetVisible) {
      Animated.parallel([
        Animated.timing(bottomSheetAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bottomSheetAnim, {
          toValue: height,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isBottomSheetVisible, bottomSheetAnim, backdropAnim]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons
            name="chevron-left"
            size={28}
            color={Colors.textPrimary}
          />
        </TouchableOpacity>
        <Text style={styles.title}>Talk to us</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Conversation Language</Text>
          <TouchableOpacity
            style={[
              styles.dropdownButton,
              isDropdownOpen && styles.dropdownButtonActive,
            ]}
            onPress={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <Text style={styles.dropdownText}>{language}</Text>
            <Feather
              name={isDropdownOpen ? "chevron-up" : "chevron-down"}
              size={24}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          {isDropdownOpen && (
            <View style={styles.dropdownList}>
              {languages.map((lang, index) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.dropdownItem,
                    index === languages.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => {
                    setLanguage(lang);
                    setIsDropdownOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      language === lang && styles.dropdownItemTextSelected,
                    ]}
                  >
                    {lang}
                  </Text>
                  {language === lang && (
                    <Feather
                      name="check"
                      size={16}
                      color={Colors.textPrimary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select an issue</Text>
          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.issueItem}
            onPress={() => navigation.navigate("ChatWithUs")}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: "rgba(234, 67, 53, 0.1)" },
              ]}
            >
              <Feather name="alert-triangle" size={20} color="#EA4335" />
            </View>
            <View style={styles.issueTextContainer}>
              <Text style={styles.issueTitle}>
                Report suspicious activity / Fraud
              </Text>
              <Text style={styles.issueSubtitle}>
                Priority immediate response
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.issueItem}
            onPress={() => navigation.navigate("EmailUs")}
          >
            <View style={styles.iconContainer}>
              <Feather name="mail" size={20} color={Colors.textPrimary} />
            </View>
            <View style={styles.issueTextContainer}>
              <Text style={styles.issueTitle}>Email us</Text>
              <Text style={styles.issueSubtitle}>
                We'll aim to respond with 24hours
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.issueItem}
            onPress={() => navigation.navigate("ChatWithUs")}
          >
            <View style={styles.iconContainer}>
              <Feather
                name="message-circle"
                size={20}
                color={Colors.textPrimary}
              />
            </View>
            <View style={styles.issueTextContainer}>
              <Text style={styles.issueTitle}>Chat with us</Text>
              <Text style={styles.issueSubtitle}>Immediate response</Text>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.issueItem}
            onPress={() => setBottomSheetVisible(true)}
          >
            <View style={styles.iconContainer}>
              <Feather name="smartphone" size={20} color={Colors.textPrimary} />
            </View>
            <View style={styles.issueTextContainer}>
              <Text style={styles.issueTitle}>Call us</Text>
              <Text style={styles.issueSubtitle}>Available</Text>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
          <View style={styles.separator} />
        </View>
      </View>

      {/* Bottom Sheet */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={isBottomSheetVisible ? "auto" : "none"}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: backdropAnim }]}
        >
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            activeOpacity={1}
            onPress={() => setBottomSheetVisible(false)}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.bottomSheetContainer,
            {
              position: "absolute",
              bottom: 0,
              width: "100%",
              transform: [{ translateY: bottomSheetAnim }],
            },
          ]}
        >
          <View style={styles.bottomSheetHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setBottomSheetVisible(false)}
            >
              <AntDesign name="close" size={20} color="#0E0F0C" />
            </TouchableOpacity>
          </View>
          <Text style={styles.bottomSheetTitle}>Call us</Text>
          <Text style={styles.bottomSheetDescription}>
            Reach us on our mobile or telephone lines.
          </Text>
          <View style={styles.bottomSheetDivider} />

          <Button
            title="+233 55 123 4567"
            onPress={() => {
              setBottomSheetVisible(false);
            }}
            backgroundColor="#1E5128"
            textColor="#B7ED7E"
            borderRadius={24}
          />
          <View style={{ height: 16 }} />
          <Button
            title="+233 30 212 3456"
            onPress={() => {
              setBottomSheetVisible(false);
            }}
            backgroundColor="#B7ED7E"
            textColor="#1E5128"
            borderRadius={24}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: "rgba(22,51,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "400",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  dropdownButtonActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomColor: "transparent",
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: "400",
    color: Colors.textSecondary,
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22,51,0,0.04)",
  },
  dropdownItemText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  dropdownItemTextSelected: {
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(22,51,0,0.08)",
  },
  issueItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: "rgba(22,51,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  issueTextContainer: {
    flex: 1,
  },
  issueTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  issueSubtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: Colors.textSecondary,
  },
  bottomSheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  bottomSheetContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  bottomSheetHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 16,
  },
  closeButton: {
    backgroundColor: "#F3F4F6",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomSheetTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0E0F0C",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  bottomSheetDescription: {
    fontSize: 16,
    color: "#0E0F0C",
    lineHeight: 22,
    marginBottom: 20,
  },
  bottomSheetDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginBottom: 24,
  },
});
