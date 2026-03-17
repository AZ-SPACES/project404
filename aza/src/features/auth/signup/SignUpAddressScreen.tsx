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
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors, Typography, Spacing, Radius } from '../../../theme';
import Button from '../../../components/Button';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SignUpAddressScreen() {
    const navigation = useNavigation<NavigationProp>();
    const [homeAddress, setHomeAddress] = useState('');
    const [city, setCity] = useState('');

    const handleNext = () => {
        // Navigate to the next screen in the signup flow
        navigation.navigate('SignUpPronouns');
    };

    const isFormValid = homeAddress.trim().length > 0 && city.trim().length > 0;

    return (
        <SafeAreaView style={styles.safeArea}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <KeyboardAvoidingView
                    style={styles.container}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                            <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <ScrollView 
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContentContainer}
                    >
                        <Text style={styles.title}>Enter your address</Text>
                        <Text style={styles.subtitle}>
                            Enter the address you live in most of the time. We may need to ask for proof of this address.
                        </Text>
                        
                        <Text style={styles.label}>Home address</Text>
                        <View style={styles.inputContainer}>
                            <MaterialIcons name="search" size={24} color={Colors.primary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="603 Newtown Rd,Accra,Ghana"
                                placeholderTextColor={Colors.textSecondary}
                                value={homeAddress}
                                onChangeText={setHomeAddress}
                                autoCapitalize="words"
                                autoFocus
                            />
                        </View>

                        <Text style={styles.label}>City</Text>
                        <View style={styles.inputContainer}>
                            <MaterialIcons name="search" size={24} color={Colors.primary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Accra"
                                placeholderTextColor={Colors.textSecondary}
                                value={city}
                                onChangeText={setCity}
                                autoCapitalize="words"
                            />
                        </View>
                        
                        <Text style={styles.disclaimerText}>
                            By continuing, you confirm this address is correct.
                        </Text>
                    </ScrollView>

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
                            disabled={!isFormValid}
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
    },
    scrollContentContainer: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.xl,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    label: {
        fontSize: Typography.body.fontSize,
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
    disclaimerText: {
        fontSize: 13,
        color: Colors.textPrimary,
        textAlign: 'center',
        marginTop: Spacing.lg,
        fontWeight: '400',
    },
    buttonContainer: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
});