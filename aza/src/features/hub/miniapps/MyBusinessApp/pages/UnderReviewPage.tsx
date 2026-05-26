import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { Typography } from '../../../../../theme';
import { NavProps } from '../types';
import StatusBadge from '../components/StatusBadge';

export default function UnderReviewPage({ merchant, Colors, styles }: NavProps) {
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
    </ScrollView>
  );
}
