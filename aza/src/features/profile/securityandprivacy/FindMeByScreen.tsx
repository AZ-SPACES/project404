import React, { ComponentProps, useState, useRef, useEffect } from "react";
import { View,Text,StyleSheet,TouchableOpacity,ScrollView,StatusBar,Switch,Animated,Dimensions,Image } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from '@react-native-vector-icons/feather';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { AntDesign } from '@react-native-vector-icons/ant-design';
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import { useProfile } from "../../../providers/ProfileProvider";
import { removeSelfEverywhere as removeSelfEverywhereApi } from "../../../services/api";
import { BackButton } from '../../../components/ui/BackButton';
import { CloseButton } from '../../../components/ui/CloseButton';

const { height } = Dimensions.get("window");

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "FindMeBy">;



type SettingRowProps = (
  | { iconType: "Feather"; iconName: ComponentProps<typeof Feather>['name'] }
  | { iconType: "Ionicons"; iconName: ComponentProps<typeof Ionicons>['name'] }
  | { iconType: "MaterialCommunityIcons"; iconName: ComponentProps<typeof MaterialCommunityIcons>['name'] }
  | { iconType: "Custom"; iconName?: never }
) & {
  title: string;
  subtitle: string;
  switchValue: boolean;
  onSwitchChange: (value: boolean) => void;
};

function SettingRow(props: SettingRowProps) {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { title, subtitle, switchValue, onSwitchChange } = props;
  return (
    <View style={styles.row}>
      <View style={styles.iconContainer}>
        {props.iconType === "Feather" && (
          <Feather name={props.iconName} size={20} color={Colors.textPrimary} />
        )}
        {props.iconType === "Ionicons" && (
          <Ionicons name={props.iconName} size={20} color={Colors.textPrimary} />
        )}
        {props.iconType === "MaterialCommunityIcons" && (
          <MaterialCommunityIcons
            name={props.iconName}
            size={22}
            color={Colors.textPrimary}
          />
        )}
        {props.iconType === "Custom" && (
          <Image
            source={require("../../../assets/aza-z.png")}
            style={{ width: 24, height: 24 }}
            resizeMode="contain"
          />
        )}
      </View>

      <View style={styles.textContainer}>
        <Text style={[Typography.body, styles.rowTitle]}>{title}</Text>
        <Text style={[Typography.caption, styles.rowSubtitle]}>{subtitle}</Text>
      </View>
      <Switch
        value={switchValue}
        onValueChange={onSwitchChange}
        trackColor={{ false: isDark ? Colors.surface : "#E5E7EB", true: Colors.primary }}
        thumbColor={Colors.white}
        ios_backgroundColor={isDark ? Colors.surface : "#E5E7EB"}
        accessibilityRole="switch"
        accessibilityLabel={title}
      />
    </View>
  );
}

export function FindMeByScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const navigation = useNavigation<NavigationProp>();
  const { 
    handle, email, phone, 
    findMeByHandle, findMeByEmail, findMeByPhone,
    updateProfile, fetchProfile 
  } = useProfile();

  const handleWiseTagChange = (v: boolean) => { updateProfile({ findMeByHandle: v }); };
  const handleEmailChange = (v: boolean) => { updateProfile({ findMeByEmail: v }); };
  const handlePhoneChange = (v: boolean) => { updateProfile({ findMeByPhone: v }); };

  const [isModalVisible, setModalVisible] = useState(false);
  const modalAnim = useRef(new Animated.Value(height)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isModalVisible) {
      Animated.parallel([
        Animated.timing(modalAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(modalAnim, {
          toValue: height,
          duration: 300,
          useNativeDriver: true }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true }),
      ]).start();
    }
  }, [isModalVisible]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={[Typography.h1, styles.mainTitle]}>Find me by</Text>
          <Text style={[Typography.body, styles.description]}>
            Set how people on Aza can find you to send and request money.
          </Text>
        </View>

        <View style={styles.section}>
          <SettingRow
            iconType="Custom"
            title="Aza tag"
            subtitle={handle ? `@${handle}` : '@—'}
            switchValue={findMeByHandle ?? true}
            onSwitchChange={handleWiseTagChange}
          />

          <SettingRow
            iconType="Feather"
            iconName="mail"
            title="Email address"
            subtitle={email ?? 'Not set'}
            switchValue={findMeByEmail ?? true}
            onSwitchChange={handleEmailChange}
          />

          <SettingRow
            iconType="Feather"
            iconName="phone"
            title="Phone number"
            subtitle={phone ?? 'Not set'}
            switchValue={findMeByPhone ?? true}
            onSwitchChange={handlePhoneChange}
          />
        </View>

        <TouchableOpacity
          style={styles.deleteSection}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.deleteTextContainer}>
            <Text style={[Typography.bodyLg, styles.deleteTitle]}>
              Delete my details everywhere
            </Text>
            <Text style={[Typography.body, styles.deleteSubtitle]}>
              Remove yourself from all existing recipient lists and become
              hidden in the future
            </Text>
          </View>
          <Feather
            name="chevron-right"
            size={20}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>
      </ScrollView>

      {/* Deletion Modal */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={isModalVisible ? "auto" : "none"}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: backdropAnim,
              zIndex: 1000,
              backgroundColor: "rgba(0,0,0,0.5)" },
          ]}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              zIndex: 1001,
              transform: [{ translateY: modalAnim }] },
          ]}
        >
          <View style={styles.modalHeader}>
            <CloseButton onPress={() => setModalVisible(false)} />
            <Text style={[Typography.h2, styles.modalTitle]}>
              Remove yourself as a recipient
            </Text>
          </View>

          <Text style={[Typography.bodyLg, styles.modalDescription]}>
            If you have already been found by people on Aza, you can remove
            yourself - and become hidden in the future.
          </Text>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.destructiveButton}
              onPress={async () => {
                try {
                  await removeSelfEverywhereApi();
                  await fetchProfile();
                  setModalVisible(false);
                  navigation.goBack();
                } catch (e) {
                  // Handle error if needed
                  setModalVisible(false);
                }
              }}
            >
              <Text style={styles.destructiveButtonText}>Remove yourself</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    height: 60,
    justifyContent: "center" },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center" },
  scrollContent: {
    paddingBottom: Spacing.xl },
  titleSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl },
  mainTitle: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: "700",
    marginBottom: Spacing.sm },
  description: {
    color: Colors.textSecondary,
    fontSize: 18,
    lineHeight: 24 },
  section: {
    paddingHorizontal: Spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md },
  textContainer: {
    flex: 1,
    justifyContent: "center" },
  rowTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2 },
  rowSubtitle: {
    color: Colors.textSecondary,
    fontSize: 15 },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
    marginHorizontal: Spacing.lg },
  deleteSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md },
  deleteTextContainer: {
    flex: 1,
    paddingRight: Spacing.md },
  deleteTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4 },
  deleteSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22 },
  modalContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: isDark ? Colors.surface : Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 16 },
  modalTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: "700" },

  closeButton: {
    backgroundColor: Colors.surface,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16 },

  modalDescription: {
    color: Colors.textSecondary,
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 32 },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 20,
    marginTop: 12 },
  destructiveButton: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 16,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center" },
  destructiveButtonText: {
    color: "#DC2626",
    fontSize: 16,
    fontWeight: "600" } });
}


