import React from "react";
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@react-native-vector-icons/feather";
import { useAuth } from "../providers/AuthProvider";
import { getMyConsents, recordConsent, LEGAL_DOC_VERSIONS } from "../services/api";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../theme";
import Button from "./ui/Button";

type DocType = keyof typeof LEGAL_DOC_VERSIONS;

/**
 * Prompts signed-in users who haven't accepted the *current* version of the
 * Terms/Privacy Policy (users who signed up before consent recording existed,
 * or after a version bump in LEGAL_DOC_VERSIONS). Fails open: if the check
 * can't run (offline, server error), the app is never blocked.
 */
export function ConsentUpdateGate() {
  const { userToken } = useAuth();
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [missing, setMissing] = React.useState<DocType[]>([]);
  const [agreed, setAgreed] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!userToken) {
      setMissing([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getMyConsents();
        const consents: { docType: string; version: string }[] = res.data?.data ?? [];
        const gaps = (Object.keys(LEGAL_DOC_VERSIONS) as DocType[]).filter(
          (doc) => !consents.some((c) => c.docType === doc && c.version === LEGAL_DOC_VERSIONS[doc]),
        );
        if (!cancelled) setMissing(gaps);
      } catch {
        // Fail open — never block the app on a failed consent check
        if (!cancelled) setMissing([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userToken]);

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      await Promise.all(missing.map((doc) => recordConsent(doc)));
      setMissing([]);
    } catch {
      // Leave the prompt up; the user can retry
    } finally {
      setSubmitting(false);
    }
  };

  if (!userToken || missing.length === 0) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Feather name="file-text" size={24} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Updated terms</Text>
          <Text style={styles.body}>
            We&apos;ve updated our Terms of Service and Privacy Policy. Please review and
            accept the current versions to continue.
          </Text>

          <View style={styles.links}>
            <TouchableOpacity onPress={() => Linking.openURL("https://aza.systems/terms-of-service")}>
              <Text style={styles.link}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.linkDot}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL("https://aza.systems/privacy-policy")}>
              <Text style={styles.link}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.agreeRow} onPress={() => setAgreed(!agreed)} activeOpacity={0.7}>
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Feather name="check" size={13} color="#0D0D0D" />}
            </View>
            <Text style={styles.agreeText}>
              I have read and agree to the updated Terms of Service and Privacy Policy
            </Text>
          </TouchableOpacity>

          <Button
            title={submitting ? "Saving…" : "Accept and continue"}
            onPress={handleAccept}
            disabled={!agreed || submitting}
            loading={submitting}
            backgroundColor={Colors.primary}
            textColor={Colors.textPrimary}
            borderRadius={Radius.full}
          />
        </View>
      </View>
    </Modal>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "center",
      alignItems: "center",
      padding: Spacing.lg,
    },
    card: {
      width: "100%",
      maxWidth: 380,
      backgroundColor: Colors.background,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      alignItems: "center",
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: "rgba(183,238,122,0.18)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.md,
    },
    title: {
      ...Typography.h2,
      color: Colors.textPrimary,
      fontWeight: "700",
      marginBottom: Spacing.sm,
    },
    body: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: "center",
      marginBottom: Spacing.md,
    },
    links: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: Spacing.lg,
    },
    link: {
      ...Typography.body,
      color: Colors.primary,
      fontWeight: "600",
    },
    linkDot: {
      color: Colors.textSecondary,
    },
    agreeRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: Spacing.lg,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    checkboxChecked: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    agreeText: {
      ...Typography.caption,
      color: Colors.textSecondary,
      flex: 1,
      lineHeight: 18,
    },
    button: {
      width: "100%",
      paddingVertical: 14,
      borderRadius: Radius.full,
      backgroundColor: Colors.primary,
      alignItems: "center",
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    buttonText: {
      ...Typography.body,
      color: Colors.textPrimary,
      fontWeight: "700",
    },
  });
}
