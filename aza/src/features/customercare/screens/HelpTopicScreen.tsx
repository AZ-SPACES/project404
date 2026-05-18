import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, Spacing, Radius, ThemeColors } from "../../../theme";
import Button from "../../../components/ui/Button";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "HelpTopic">;
type RoutePropType = RouteProp<RootStackParamList, "HelpTopic">;

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_DATA: Record<string, FAQItem[]> = {
  sending: [
    {
      question: "How do I send money?",
      answer:
        "Tap the Send button on your home screen, search for a contact or enter their AZA handle, enter the amount and a note, then confirm with your PIN.",
    },
    {
      question: "What are the transfer limits?",
      answer:
        "Standard accounts have a daily limit of GHS 5,000. Fully verified accounts have higher limits. Check your limit in Profile > Account Details.",
    },
    {
      question: "How long does a transfer take?",
      answer:
        "Transfers between AZA users are instant. Bank transfers may take 1–2 business days depending on your bank.",
    },
    {
      question: "Can I cancel a transfer?",
      answer:
        "Transfers to AZA users are instant and cannot be reversed. If you suspect fraud or made an error, contact our support team immediately.",
    },
    {
      question: "What fees apply to transfers?",
      answer:
        "AZA-to-AZA transfers are completely free. Bank transfers may attract a small processing fee shown before you confirm.",
    },
    {
      question: "Why did my transfer fail?",
      answer:
        "Transfers can fail due to insufficient funds, incorrect recipient details, or a temporary network issue. Check your balance and try again, or contact support.",
    },
  ],
  account: [
    {
      question: "How do I verify my account?",
      answer:
        "Navigate to Profile > Verify Identity and follow the steps to upload a valid government ID and take a selfie. Verification usually takes a few minutes.",
    },
    {
      question: "How do I change my phone number?",
      answer:
        "Go to Profile > Personal Details > Change Phone. You'll need to verify the new number with a one-time code sent via SMS.",
    },
    {
      question: "Can I have multiple AZA accounts?",
      answer:
        "No. Each phone number and email address can only be linked to one AZA account at a time.",
    },
    {
      question: "What do I do if my account is locked?",
      answer:
        "Account locks are usually triggered by too many failed PIN attempts. Contact our support team immediately via chat or call for assistance.",
    },
    {
      question: "How do I update my personal details?",
      answer:
        "Go to Profile > Personal Information to update your name, date of birth, and address. Some changes may require identity re-verification.",
    },
    {
      question: "How do I close my account?",
      answer:
        "Account closure requests can be submitted through our support team. Please note this action is permanent and will remove all your transaction history.",
    },
  ],
  holding: [
    {
      question: "What is the AZA wallet?",
      answer:
        "Your AZA wallet securely holds your balance in Ghanaian Cedis (GHS). You can use it to send money, receive payments, and make purchases.",
    },
    {
      question: "Is my money safe?",
      answer:
        "Yes. AZA is regulated and your funds are held in segregated accounts at licensed financial institutions, fully protected from AZA's operational funds.",
    },
    {
      question: "How do I top up my wallet?",
      answer:
        "Tap Receive on your home screen to get your account details, then transfer from your bank, mobile money, or ask someone to send you money via AZA.",
    },
    {
      question: "Are there fees for holding money?",
      answer:
        "No. AZA does not charge any fees for simply holding a balance in your wallet. You only pay fees on certain outbound transactions.",
    },
    {
      question: "What is Direct Debit?",
      answer:
        "Direct Debit allows you to authorise recurring payments from your AZA wallet to pay bills automatically on a set schedule.",
    },
    {
      question: "What happens to my money if AZA closes?",
      answer:
        "Your funds are always protected in regulated, segregated accounts. In the unlikely event of closure, you would be entitled to a full refund of your balance.",
    },
  ],
  receiving: [
    {
      question: "How do I receive money?",
      answer:
        "Share your AZA username or account details with the sender. Transfers from other AZA users arrive instantly; bank transfers take 1–2 business days.",
    },
    {
      question: "Where do I find my account details?",
      answer:
        "Tap Receive on your home screen. Your unique AZA account number, bank code, and sort code are displayed there.",
    },
    {
      question: "Can I receive from banks?",
      answer:
        "Yes. Provide your AZA account number and sort code to anyone who wants to send you money from a bank account.",
    },
    {
      question: "Why hasn't my money arrived?",
      answer:
        "Bank transfers can take 1–2 business days. If it has been longer, contact your sender's bank with the transaction reference and reach out to our support team.",
    },
    {
      question: "Is there a limit on what I can receive?",
      answer:
        "Receiving limits depend on your account verification level. Fully verified accounts can receive larger amounts per day and month.",
    },
    {
      question: "Can I receive money from abroad?",
      answer:
        "International transfers are not currently supported for receiving. We are working on expanding this feature. Stay tuned for updates.",
    },
  ],
  business: [
    {
      question: "What is Aza Business?",
      answer:
        "Aza Business is a dedicated account for vendors, merchants, and companies.  it gives you a business wallet, team access, bulk payments, and tools to manage your company's money — all in one place.",
    },
    {
      question: "How do I open an Aza Business account?",
      answer:
        "Tap 'Get started with Aza Business' and complete the business verification flow. You'll need your business registration documents, a valid ID for the director, and your company's tax details.",
    },
    {
      question: "Can I add team members to my account?",
      answer:
        "Yes. You can invite team members and assign them roles — Owner, Admin, or Member — each with different permissions. Admins can approve payments; Members can only view and initiate them.",
    },
    {
      question: "Does Aza Business support bulk payments?",
      answer:
        "Yes. You can upload a CSV or use our API to pay multiple vendors or employees in a single batch. Bulk payments are processed simultaneously so your whole payroll goes out at once.",
    },
    {
      question: "Can I issue expense cards to employees?",
      answer:
        "Yes. Aza Business lets you issue virtual or physical cards to team members with spending limits you control. All card spend is visible in your business dashboard in real time.",
    },
    {
      question: "Does Aza Business integrate with accounting software?",
      answer:
        "Yes. Aza Business connects directly with tools like QuickBooks and Wave so your transactions sync automatically, saving you from manual reconciliation.",
    },
  ],
};

interface AccordionItemProps {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

function AccordionItem({ item, isOpen, onToggle, colors, styles }: AccordionItemProps) {
  return (
    <View style={styles.accordionItem}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.accordionQuestion}>{item.question}</Text>
        <Feather
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.accordionBody}>
          <Text style={styles.accordionAnswer}>{item.answer}</Text>
        </View>
      )}
      <View style={styles.separator} />
    </View>
  );
}

export default function HelpTopicScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { topicId, title } = route.params;

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = FAQ_DATA[topicId] ?? [];

  const handleToggle = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
      />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.largeTitle}>{title}</Text>
        <Text style={styles.subtitle}>
          Find answers to common questions about {title.toLowerCase()}.
        </Text>

        <View style={styles.faqList}>
          <View style={styles.separator} />
          {faqs.map((item, index) => (
            <AccordionItem
              key={index}
              item={item}
              isOpen={openIndex === index}
              onToggle={() => handleToggle(index)}
              colors={Colors}
              styles={styles}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Still need help?</Text>
        <Button
          title="Contact us"
          onPress={() => navigation.navigate("TalkToUs")}
          backgroundColor="#1E5128"
          textColor="#B7ED7E"
          borderRadius={24}
        />
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      height: 56,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
      justifyContent: "center",
      alignItems: "center",
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xl,
    },
    largeTitle: {
      fontSize: 32,
      fontWeight: "700",
      color: Colors.textPrimary,
      letterSpacing: -0.5,
      marginBottom: Spacing.sm,
    },
    subtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      lineHeight: 20,
      marginBottom: Spacing.lg,
    },
    faqList: {
      marginTop: Spacing.sm,
    },
    separator: {
      height: 1,
      backgroundColor: isDark ? Colors.border : "rgba(22,51,0,0.08)",
    },
    accordionItem: {},
    accordionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.md,
      gap: Spacing.md,
    },
    accordionQuestion: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textPrimary,
      lineHeight: 22,
    },
    accordionBody: {
      paddingBottom: Spacing.md,
    },
    accordionAnswer: {
      fontSize: 14,
      color: Colors.textSecondary,
      lineHeight: 22,
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
      backgroundColor: Colors.background,
      borderTopWidth: 1,
      borderTopColor: isDark ? Colors.border : "rgba(22,51,0,0.08)",
      gap: Spacing.sm,
    },
    footerText: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: "center",
    },
  });
}
