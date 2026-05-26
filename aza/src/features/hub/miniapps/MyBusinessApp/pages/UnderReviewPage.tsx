import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Typography } from '../../../../../theme';
import { RootStackParamList } from '../../../../../navigation/types';
import { NavProps } from '../types';
import StatusBadge from '../components/StatusBadge';

export default function UnderReviewPage({ merchant, Colors, styles }: NavProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isMoreInfo = merchant?.status === 'MORE_INFO_REQUIRED';

  return (
    <ScrollView contentContainerStyle={[styles.pageContent, { alignItems: 'center' }]}>
      <View style={[styles.bigIcon, { backgroundColor: (isMoreInfo ? '#FF5722' : '#2196F3') + '18' }]}>
        <Text style={{ fontSize: 56 }}>{isMoreInfo ? '📋' : '⏳'}</Text>
      </View>
      <Text style={[styles.introTitle, { color: Colors.textPrimary }]}>
        {isMoreInfo ? 'More Information Needed' : 'Application Submitted'}
      </Text>
      <Text style={[styles.introSubtitle, { color: Colors.textSecondary }]}>
        {isMoreInfo
          ? 'Our team needs additional information before approving your account.'
          : 'Your application is being reviewed. We typically respond within 1–2 business days.'}
      </Text>
      {isMoreInfo && merchant?.moreInfoRequest && (
        <View style={[styles.infoBox, { backgroundColor: '#FF572218', borderColor: '#FF5722' }]}>
          <Text style={[Typography.body as any, { color: Colors.textPrimary }]}>{merchant.moreInfoRequest}</Text>
        </View>
      )}
      <StatusBadge status={merchant?.status ?? 'KYB_SUBMITTED'} Colors={Colors} />
      {isMoreInfo && merchant?.id && (
        <TouchableOpacity
          style={[styles.primaryBtn, { marginTop: 24, width: '100%' }]}
          onPress={() => navigation.navigate('MerchantKYBIntro', { merchantId: merchant.id })}
        >
          <Text style={[styles.primaryBtnText, { color: '#000' }]}>Provide Information</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
