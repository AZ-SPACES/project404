import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors, Typography, Spacing, Radius } from '../../../theme';
import Button from '../../../components/Button';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SignUpEmailScreen() {
    const navigation = useNavigation<NavigationProp>();
    const [email, setEmail] = useState('');

    const handleNext = () => {
        // Navigate to the next screen in the signup flow
        navigation.navigate('SignUpPassword');
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <KeyboardAvoidingView
                    style={styles.container}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                            <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        <Text style={styles.title}>What's your email?</Text>
                        <Text style={styles.subtitle}>
                            We'll send you a code to verify this email when you sign in.
                        </Text>
                        <Text style={styles.label}>Your Email</Text>
                        <View style={styles.inputContainer}>
                            <MaterialIcons name="mail-outline" size={24} color={Colors.primary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor={Colors.textSecondary}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoFocus
                            />
                        </View>
                    </View>

                    {/* Footer */}
                    <View style={styles.buttonContainer}>
                        <Button
                            title="Continue"
                            onPress={handleNext}
                            backgroundColor={Colors.primary}
                            textColor={Colors.secondary}
                            borderRadius={30}
                            paddingVertical={16}
                            fontSize={Number(Typography.button.fontSize)}
                            fontWeight={Typography.button.fontWeight as any}
                            disabled={email.trim().length === 0}
                        />
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    container: {
        flex: 1,
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
        backgroundColor: 'rgba(22,51,0,0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
    },
    title: {
        fontSize: 34,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    label: {
        fontSize: Typography.bodyLg.fontSize,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
        marginTop: Spacing.xl,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.md,
        height: 48,
        backgroundColor: 'white',
    },
    inputIcon: {
        marginRight: Spacing.sm,
    },
    input: {
        flex: 1,
        fontSize: Typography.bodyLg.fontSize,
        color: Colors.textPrimary,
        height: '100%',
    },
    buttonContainer: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
});