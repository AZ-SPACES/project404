import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../../../navigation/types';
import { Spacing } from '../../../../../theme';
import { NavProps } from '../types';

export default function IntroPage({ Colors, styles }: NavProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <ScrollView contentContainerStyle={[styles.pageContent, { alignItems: 'center' }]}>
      <View style={[styles.bigIcon, { backgroundColor: Colors.primary + '18' }]}>
        <Text style={{ fontSize: 56 }}>🏪</Text>
      </View>
      <Text style={[styles.introTitle, { color: Colors.textPrimary }]}>Business on Aza</Text>
      <Text style={[styles.introSubtitle, { color: Colors.textSecondary }]}>
        Accept payments from millions of Aza users. Create payment links, manage payouts, and build with our API.
      </Text>

      <View style={[styles.featureList, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        {[
          ['💳', 'Accept Payments', 'Instant GHS payments from Aza users'],
          ['🔗', 'Payment Links', 'Share links that open a hosted checkout'],
          ['🔑', 'Developer API', 'Build integrations with your own API keys'],
          ['💸', 'Instant Payouts', 'Withdraw your balance to your Aza wallet'],
        ].map(([icon, title, desc]) => (
          <View key={title as string} style={styles.featureRow}>
            <Text style={{ fontSize: 22, width: 32 }}>{icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.featureTitle, { color: Colors.textPrimary }]}>{title}</Text>
              <Text style={[styles.featureDesc, { color: Colors.textSecondary }]}>{desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, { marginTop: Spacing.xl, width: '100%' }]}
        onPress={() => navigation.navigate('MerchantBusinessName')}
        accessibilityRole="button"
      >
        <Text style={[styles.primaryBtnText, { color: Colors.secondary }]}>Open Business Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
