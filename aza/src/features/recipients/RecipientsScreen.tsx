import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Modal,
  TouchableWithoutFeedback } from "react-native";
import { Feather, MaterialCommunityIcons, AntDesign } from "@expo/vector-icons";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../theme";
import { SafeAreaView } from "react-native-safe-area-context";

// Type definitions
type Recipient = {
  id: string;
  name: string;
  username: string;
  avatar: string;
};

// Mock data
const INITIAL_RECIPIENTS: Recipient[] = [
  {
    id: "1",
    name: "Paapa Cobbold",
    username: "@pcobbold",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&fit=crop" },
  {
    id: "2",
    name: "Davies Opoku",
    username: "@dopoku",
    avatar:
      "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&fit=crop" },
  {
    id: "3",
    name: "Ibrahim Mahama",
    username: "@ibmahama",
    avatar:
      "https://i0.wp.com/ghanamedia.net/wp-content/uploads/2026/03/img_9680.jpg?fit=1200%2C812&ssl=1" },
  {
    id: "4",
    name: "Charlotte osei",
    username: "@cosei",
    avatar:
      "https://i0.wp.com/www.gbcghanaonline.com/wp-content/uploads/2024/08/FB_IMG_1723196462221-e1723205205559.jpg" },
  {
    id: "5",
    name: "Kevin Okyere",
    username: "@kokyere",
    avatar:
      "https://prod.cdn-medias.theafricareport.com/medias/2025/11/28/gvaffltwmaecdxx.jpg" },
  {
    id: "6",
    name: "Shirley Ayorkor Botchwey",
    username: "@sabotchwey",
    avatar:
      "https://www.happyghana.com/wp-content/uploads/2024/10/Ayorko-Botchwey-2048x1365.jpg" },
  {
    id: "7",
    name: "Rita Akosua Dickson",
    username: "@radickson",
    avatar:
      "https://focusfmknust.com/wp-content/uploads/2024/07/GDbhQpdXAAA7sUf-1600x1066.jpg" },
];

export default function RecipientsScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);

  // Simple filter logic
  const filteredRecipients = INITIAL_RECIPIENTS.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.username.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const openSheet = (recipient: Recipient) => {
    setSelectedRecipient(recipient);
  };

  const closeSheet = () => {
    setSelectedRecipient(null);
  };

  const renderItem = ({ item }: { item: Recipient }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => openSheet(item)}
    >
      <Image source={{ uri: item.avatar }} style={styles.avatar} />
      <View style={styles.rowInfo}>
        <Text style={[Typography.bodyLg, styles.rowName]}>{item.name}</Text>
        <Text style={[Typography.body, styles.rowUsername]}>
          {item.username}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={[Typography.h1, styles.title]}>Recipients</Text>
          <TouchableOpacity style={styles.inviteButton} activeOpacity={0.8}>
            <MaterialCommunityIcons name="party-popper" size={20} color={Colors.secondary} />
            <Text style={styles.inviteButtonText}>Invite</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar Row */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Feather
              name="search"
              size={20}
              color={Colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Name, tag, email, phone number"
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <TouchableOpacity style={styles.addButton} activeOpacity={0.8}>
            <Feather name="plus" size={24} color={Colors.secondary} />
          </TouchableOpacity>
        </View>

        {/* List */}
        <FlatList
          data={filteredRecipients}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>

      {/* Detail Bottom Sheet Modal manually managed via native Modal component */}
      <Modal
        visible={!!selectedRecipient}
        animationType="slide"
        transparent={true}
        onRequestClose={closeSheet}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={closeSheet}>
            <View style={styles.bottomSheetBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheetHeader}>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={closeSheet}
              >
                <AntDesign name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedRecipient && (
              <View style={styles.sheetContent}>
                <Image source={{ uri: selectedRecipient.avatar }} style={styles.sheetAvatar} />
                <Text style={[Typography.h3, styles.sheetName]}>{selectedRecipient.name}</Text>
                <Text style={[Typography.body, styles.sheetUsername]}>{selectedRecipient.username}</Text>

                <View style={styles.bottomSheetDivider} />

                <View style={styles.sheetActions}>
                  <View style={styles.actionItem}>
                    <TouchableOpacity style={styles.actionCircleButton} activeOpacity={0.8}>
                      <Feather name="arrow-up" size={24} color={Colors.secondary} />
                    </TouchableOpacity>
                    <Text style={styles.actionLabel}>Send</Text>
                  </View>

                  <View style={styles.actionItem}>
                    <TouchableOpacity style={styles.actionCircleButton} activeOpacity={0.8}>
                      <Feather name="arrow-down" size={24} color={Colors.secondary} />
                    </TouchableOpacity>
                    <Text style={styles.actionLabel}>Receive</Text>
                  </View>

                  <View style={styles.actionItem}>
                    <TouchableOpacity style={styles.actionCircleButton} activeOpacity={0.8}>
                      <Feather name="user" size={24} color={Colors.secondary} />
                    </TouchableOpacity>
                    <Text style={styles.actionLabel}>View</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.background === '#121212';
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    marginBottom: Spacing.md },
  title: {
    color: Colors.textPrimary,
    fontWeight: "700",
    fontSize: 28 },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary, 
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full },
  inviteButtonText: {
    ...Typography.button,
    color: Colors.secondary,
    marginLeft: 6,
    fontSize: 15 },
  searchRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: "center" },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: isDark ? Colors.surface : "#EBEBEB",
    borderRadius: Radius.full, // Precise pill shape matching design
    paddingHorizontal: Spacing.md,
    height: 48 },
  searchIcon: {
    marginRight: Spacing.xs },
  searchInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 15,
    color: Colors.textPrimary,
    height: "100%" },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl * 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: Radius.full },
  rowInfo: {
    flex: 1,
    marginLeft: Spacing.md },
  rowName: {
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 2,
    fontSize: 16 },
  rowUsername: {
    color: Colors.primary,
    fontWeight: "500" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end" },
  bottomSheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.black70 },
  bottomSheetContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl * 2 },
  bottomSheetHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 10 },
  closeButton: {
    backgroundColor: isDark ? Colors.surface : "#F3F4F6",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center" },
  sheetContent: {
    alignItems: "center",
    marginTop: 0 },
  sheetAvatar: {
    width: 90,
    height: 90,
    borderRadius: Radius.full,
    marginBottom: Spacing.md },
  sheetName: {
    color: Colors.textPrimary,
    fontWeight: "700",
    marginBottom: 2,
    fontSize: 18 },
  sheetUsername: {
    color: Colors.primary,
    fontWeight: "600" },
  bottomSheetDivider: {
    height: 1,
    width: "100%",
    backgroundColor: Colors.border,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 40,
    width: "100%" },
  actionItem: {
    alignItems: "center",
    width: 80 },
  actionCircleButton: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm },
  actionLabel: {
    ...Typography.body,
    fontWeight: "700",
    color: Colors.primary } });
}
