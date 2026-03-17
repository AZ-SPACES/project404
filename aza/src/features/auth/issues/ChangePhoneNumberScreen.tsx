import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { Colors, Typography, Spacing, Radius } from '../../../theme';
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Button from '../../../components/Button';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

export default function ChangePhoneNumber() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>I need to change my phone number</Text>
        <Text style={styles.subtitle}>
          If you've lost access to your old number, don't worry - here's how you can change your number:If you've lost access to your old number, don't worry - here's how you can change your number:
        </Text>

        <View style={styles.listContainer}>
                  <View style={styles.listItem}>
                    <Text style={styles.listNumber}>1.</Text>
                    <Text style={styles.listItemText}>
                     <Text style={styles.boldText}>Log-in</Text> with your email and password
                    </Text>
                  </View>
                  <View style={styles.listItem}>
                    <Text style={styles.listNumber}>2.</Text>
                    <Text style={styles.listItemText}>
                      In the 2-step verification page choose <Text style={styles.boldText}>Try another way</Text>
                    </Text>
                  </View>
                  <View style={styles.listItem}>
                    <Text style={styles.listNumber}>3.</Text>
                    <Text style={styles.listItemText}>
                     If you can't use any alternative 2-step verification methods, choose<Text style={styles.boldText}> I don't have any of these</Text>
                    </Text>
                  </View>
                  <View style={styles.listItem}>
                    <Text style={styles.listNumber}>4.</Text>
                    <Text style={styles.listItemText}>
                      Follow the flow to confirm your identity and new phone number
                    </Text>
                  </View>
                  <View style={styles.listItem}>
                    <Text style={styles.listNumber}>5.</Text>
                    <Text style={styles.listItemText}>
                      After confirming that, we'll be able to change your phone number
                    </Text>
                  </View>
                </View>

        <View style={styles.buttonContainer}>
           <Button
              title="Login"
              onPress={() => {navigation.navigate("Login")}}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
              borderRadius={30} // completely rounded
              paddingVertical={16}
              fontSize={Number(Typography.button.fontSize)}
              fontWeight={Typography.button.fontWeight as any}
            />
        </View>

        <TouchableOpacity style={styles.helpButton} onPress={() => navigation.navigate('TalkToUs')}>
            <Text style={styles.helpText}>I still need help</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 50,
    backgroundColor: "rgba(22,51,0,0.04)",
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  boldText: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  buttonContainer: {
    marginBottom: Spacing.lg,
  },
  listContainer: {
    marginBottom: Spacing.xl,
    paddingLeft: Spacing.xs,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    alignItems: 'flex-start',
  },
  listNumber: {
    fontSize: 16,
    color: Colors.textSecondary,
    width: 28,
    fontWeight: '500',
    marginTop: 2,
  },
  listItemText: {
    flex: 1,
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  helpButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  helpText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
