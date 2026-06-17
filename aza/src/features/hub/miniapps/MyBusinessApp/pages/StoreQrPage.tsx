import React, { useState } from 'react';
import { ScrollView, View, Text, Alert, Clipboard, Modal, Image, Share, Linking } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import InternalHeader from '../components/InternalHeader';
import Button from '../../../../../components/ui/Button';
import QrCode from '../../../../../components/ui/QrCode';

export default function StoreQrPage({ goBack, Colors, styles, merchant }: NavProps) {
  const [copied, setCopied] = useState(false);
  const [posMode, setPosMode] = useState(false);

  if (!merchant) {
    return (
      <View style={styles.center}>
        <Text style={{ color: Colors.textSecondary }}>No merchant account found.</Text>
      </View>
    );
  }

  const staticLink = `https://aza.systems/m/${merchant.businessHandle}`;

  const handleCopy = () => {
    Clipboard.setString(staticLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Pay ${merchant.businessName} on Aza Pay: ${staticLink}`,
        url: staticLink,
      });
    } catch (e) {
      // Ignore
    }
  };

  const handlePrint = () => {
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(staticLink)}`;
    Linking.openURL(qrImageUrl).catch(() => {
      Alert.alert('Error', 'Unable to open printable QR code.');
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.pageContent, { alignItems: 'center' }]}>
        <InternalHeader title="Store QR Code" onBack={goBack} Colors={Colors} styles={styles} />

        <View style={[styles.bigIcon, { backgroundColor: Colors.primary + '18', marginBottom: Spacing.md }]}>
          <Feather name="grid" size={48} color={Colors.primary} />
        </View>

        <Text style={[styles.introTitle, { color: Colors.textPrimary, marginBottom: 4 }]}>Your Store Poster</Text>
        <Text style={[styles.introSubtitle, { color: Colors.textSecondary, marginBottom: Spacing.md }]}>
          Customers can scan this code to pay you any amount in person.
        </Text>

        {/* Store Poster Card */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: Colors.border,
          borderRadius: 12,
          padding: 24,
          width: '100%',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
          marginBottom: Spacing.md
        }}>
          {/* Top Branding & Logo */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            {merchant.logoUrl ? (
              <Image source={{ uri: merchant.logoUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} />
            ) : (
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="briefcase" size={16} color="#4B5563" />
              </View>
            )}
            <View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>
                {merchant.businessName}
              </Text>
              <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>
                @{merchant.businessHandle}
              </Text>
            </View>
          </View>

          {/* QR Code */}
          <View style={{
            position: 'relative',
            padding: 8,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 8,
            marginBottom: 16
          }}>
            <QrCode value={staticLink} size={200} logo={require('../../../../../assets/aza-z.png')} logoSize={40} />
          </View>

          <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 }}>
            Scan to Pay
          </Text>
          <Text style={{ fontSize: 13, color: '#4B5563', textAlign: 'center', marginBottom: 12 }}>
            Enter amount on your phone to complete payment.
          </Text>

          <View style={{ borderTopWidth: 1, borderTopColor: '#F3F4F6', width: '100%', paddingTop: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '500' }}>
              Scan with Aza App
            </Text>
            <Text style={{ fontSize: 9, color: '#D1D5DB', marginTop: 2 }}>
              Powered by Aza Systems
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ width: '100%', gap: Spacing.xs, marginBottom: Spacing.md }}>
          <Button
            title="Show POS Mode"
            onPress={() => setPosMode(true)}
            leftIcon={<Feather name="maximize-2" size={16} color={Colors.secondary} />}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={8}
            paddingVertical={15}
          />

          <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
            <Button
              title={copied ? 'Copied!' : 'Copy Link'}
              onPress={handleCopy}
              leftIcon={<Feather name={copied ? "check" : "copy"} size={16} color={Colors.textPrimary} />}
              backgroundColor="transparent"
              textColor={Colors.textPrimary}
              borderRadius={8}
              paddingVertical={15}
              fontWeight="600"
              width="auto"
              style={{ flex: 1, borderWidth: 1, borderColor: Colors.border }}
            />
            <Button
              title="Share"
              onPress={handleShare}
              leftIcon={<Feather name="share-2" size={16} color={Colors.textPrimary} />}
              backgroundColor="transparent"
              textColor={Colors.textPrimary}
              borderRadius={8}
              paddingVertical={15}
              fontWeight="600"
              width="auto"
              style={{ flex: 1, borderWidth: 1, borderColor: Colors.border }}
            />
          </View>

          <Button
            title="Save / Print Poster"
            onPress={handlePrint}
            leftIcon={<Feather name="printer" size={16} color={Colors.textPrimary} />}
            backgroundColor="transparent"
            textColor={Colors.textPrimary}
            borderRadius={8}
            paddingVertical={15}
            fontWeight="600"
            style={{ borderWidth: 1, borderColor: Colors.border }}
          />
        </View>
      </ScrollView>

      {/* POS Mode Fullscreen Modal */}
      <Modal visible={posMode} animationType="slide" onRequestClose={() => setPosMode(false)}>
        <View style={{ flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }}>
          <Text style={{ fontSize: 13, color: '#9CA3AF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            Store QR Code
          </Text>
          <Text style={{ fontSize: 20, color: '#FFFFFF', fontWeight: '800', marginBottom: 24, textAlign: 'center' }}>
            {merchant.businessName}
          </Text>

          {/* Fullscreen Card */}
          <View style={{
            backgroundColor: '#FFFFFF',
            padding: 24,
            borderRadius: 16,
            alignItems: 'center',
            width: '100%',
            maxWidth: 320,
            marginBottom: Spacing.xl,
          }}>
            <QrCode value={staticLink} size={220} />
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 16 }}>
              Scan to Pay
            </Text>
            <Text style={{ fontSize: 12, color: '#4B5563', marginTop: 4, textAlign: 'center' }}>
              @{merchant.businessHandle}
            </Text>
          </View>

          <Button
            title="Close POS"
            onPress={() => setPosMode(false)}
            backgroundColor="#FFFFFF"
            textColor="#000000"
            borderRadius={8}
            paddingVertical={14}
            paddingHorizontal={36}
            fontSize={15}
            width="auto"
          />
        </View>
      </Modal>
    </View>
  );
}
