import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, TouchableOpacity, ActivityIndicator, Modal, Image, Share, Linking, Clipboard, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography, Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtAmount, fmtDate } from '../helpers';
import { getMerchantSessions } from '../../../../../services/api';
import InternalHeader from '../components/InternalHeader';
import StatusBadge from '../components/StatusBadge';

export default function SessionsPage({ navigate, goBack, Colors, styles }: NavProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Detailed modal states
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [posMode, setPosMode] = useState(false);

  const load = () => {
    setLoading(true);
    getMerchantSessions(0, 30)
      .then((r: any) => setSessions(extractData(r)?.content ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCopy = (session: any) => {
    const link = session.checkoutUrl || `https://pay.aza.systems/c/${session.id}`;
    Clipboard.setString(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async (session: any) => {
    const link = session.checkoutUrl || `https://pay.aza.systems/c/${session.id}`;
    const amountStr = session.amount ? `GH₵ ${Number(session.amount).toFixed(2)}` : '';
    const descStr = session.description ? ` (${session.description})` : '';
    try {
      await Share.share({
        message: `Pay ${session.merchantName || 'Merchant'} ${amountStr}${descStr} on Aza Pay: ${link}`,
        url: link,
      });
    } catch (e) {
      // Ignore
    }
  };

  const handlePrint = (session: any) => {
    const link = session.checkoutUrl || `https://pay.aza.systems/c/${session.id}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(link)}`;
    Linking.openURL(qrImageUrl).catch(() => {
      Alert.alert('Error', 'Unable to open printable QR code.');
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Transactions" onBack={goBack} Colors={Colors} styles={styles} />
      
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}>
          <Feather name="inbox" size={36} color={Colors.textSecondary} />
          <Text style={[Typography.body as any, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>No transactions yet</Text>
          <TouchableOpacity style={{ marginTop: Spacing.md }} onPress={() => navigate('create_session')}>
            <Text style={{ color: Colors.primary, fontWeight: '600' }}>Create Payment Link</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {sessions.map((s) => (
            <TouchableOpacity 
              key={s.id} 
              style={[styles.sessionRow, { borderColor: Colors.border, backgroundColor: Colors.surface }]}
              onPress={() => setSelectedSession(s)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.sessionAmount, { color: Colors.textPrimary }]}>
                  {fmtAmount(s.amount, s.currency)}
                </Text>
                <Text style={[styles.sessionDesc, { color: Colors.textSecondary }]} numberOfLines={1}>
                  {s.description ?? 'Payment'}
                </Text>
                <Text style={[styles.sessionDate, { color: Colors.textSecondary }]}>{fmtDate(s.createdAt)}</Text>
              </View>
              <StatusBadge status={s.status} Colors={Colors} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Transaction Detail Sheet Modal */}
      {selectedSession && (
        <Modal visible={true} animationType="slide" transparent={true} onRequestClose={() => setSelectedSession(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{
              backgroundColor: Colors.background,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: Spacing.md,
              maxHeight: '90%',
            }}>
              {/* Handle */}
              <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md }} />
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.textPrimary }}>Transaction Details</Text>
                <TouchableOpacity onPress={() => setSelectedSession(null)} style={{ padding: 4 }}>
                  <Feather name="x" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
                
                {/* Status & Basic Info */}
                <View style={{
                  borderWidth: 1,
                  borderColor: Colors.border,
                  backgroundColor: Colors.surface,
                  borderRadius: 8,
                  padding: Spacing.md,
                  marginBottom: Spacing.md
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs }}>
                    <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Status</Text>
                    <StatusBadge status={selectedSession.status} Colors={Colors} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs }}>
                    <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Amount</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary }}>
                      {fmtAmount(selectedSession.amount, selectedSession.currency)}
                    </Text>
                  </View>
                  {selectedSession.description ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.xs }}>
                      <Text style={{ fontSize: 13, color: Colors.textSecondary, marginRight: Spacing.md }}>Description</Text>
                      <Text style={{ fontSize: 14, color: Colors.textPrimary, flex: 1, textAlign: 'right' }}>
                        {selectedSession.description}
                      </Text>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs }}>
                    <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Date Created</Text>
                    <Text style={{ fontSize: 13, color: Colors.textPrimary }}>
                      {new Date(selectedSession.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  {selectedSession.completedAt ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs }}>
                      <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Paid At</Text>
                      <Text style={{ fontSize: 13, color: Colors.textPrimary }}>
                        {new Date(selectedSession.completedAt).toLocaleString()}
                      </Text>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Session ID</Text>
                    <Text style={{ fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: Colors.textSecondary }} numberOfLines={1}>
                      {selectedSession.id}
                    </Text>
                  </View>
                </View>

                {/* Interactive QR Code & POS Actions (especially for pending checkouts) */}
                {selectedSession.status === 'PENDING' ? (
                  <View style={{ alignItems: 'center', width: '100%' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textSecondary, alignSelf: 'flex-start', marginBottom: 8, textTransform: 'uppercase' }}>
                      In-Store Checkout Poster
                    </Text>

                    {/* QR Poster Card */}
                    <View style={{
                      backgroundColor: '#FFFFFF',
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 12,
                      padding: 16,
                      width: '100%',
                      alignItems: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 5,
                      elevation: 1,
                      marginBottom: Spacing.md
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                        Pay Merchant
                      </Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 12 }}>
                        {selectedSession.merchantName || 'Aza Merchant'}
                      </Text>

                      {/* QR image */}
                      <View style={{
                        position: 'relative',
                        padding: 6,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                        borderRadius: 6,
                        marginBottom: 12
                      }}>
                        <Image 
                          source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(selectedSession.checkoutUrl || `https://pay.aza.systems/c/${selectedSession.id}`)}` }} 
                          style={{ width: 140, height: 140 }} 
                        />
                        <View style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          marginTop: -14,
                          marginLeft: -11,
                          backgroundColor: '#FFFFFF',
                          padding: 2,
                          borderRadius: 4
                        }}>
                          <Image source={require('../../../../../assets/aza-z.png')} style={{ width: 15, height: 20 }} />
                        </View>
                      </View>

                      <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 2 }}>
                        {fmtAmount(selectedSession.amount, selectedSession.currency)}
                      </Text>
                      
                      {selectedSession.description ? (
                        <Text style={{ fontSize: 12, color: '#4B5563', textAlign: 'center', marginBottom: 8 }}>
                          {selectedSession.description}
                        </Text>
                      ) : null}

                      <View style={{ borderTopWidth: 1, borderTopColor: '#F3F4F6', width: '100%', paddingTop: 8, alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, color: '#9CA3AF', fontWeight: '500' }}>
                          Scan with Aza App to Pay
                        </Text>
                      </View>
                    </View>

                    {/* Poster Action Buttons */}
                    <View style={{ width: '100%', gap: Spacing.xs }}>
                      <TouchableOpacity
                        style={[styles.primaryBtn, { width: '100%', borderRadius: 8, paddingVertical: 12 }]}
                        onPress={() => setPosMode(true)}
                      >
                        <Feather name="maximize-2" size={16} color={Colors.secondary} />
                        <Text style={[styles.primaryBtnText, { color: Colors.secondary, marginLeft: Spacing.xs }]}>Show POS Mode</Text>
                      </TouchableOpacity>

                      <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
                        <TouchableOpacity
                          style={[styles.secondaryBtn, { flex: 1, borderColor: Colors.border, borderRadius: 8, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }]}
                          onPress={() => handleCopy(selectedSession)}
                        >
                          <Feather name={copied ? "check" : "copy"} size={16} color={Colors.textPrimary} />
                          <Text style={[styles.secondaryBtnText, { color: Colors.textPrimary }]}>{copied ? 'Copied!' : 'Copy Link'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.secondaryBtn, { flex: 1, borderColor: Colors.border, borderRadius: 8, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }]}
                          onPress={() => handleShare(selectedSession)}
                        >
                          <Feather name="share-2" size={16} color={Colors.textPrimary} />
                          <Text style={[styles.secondaryBtnText, { color: Colors.textPrimary }]}>Share</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[styles.secondaryBtn, { width: '100%', borderColor: Colors.border, borderRadius: 8, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }]}
                        onPress={() => handlePrint(selectedSession)}
                      >
                        <Feather name="printer" size={16} color={Colors.textPrimary} />
                        <Text style={[styles.secondaryBtnText, { color: Colors.textPrimary }]}>Save / Print Poster</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ marginTop: Spacing.md }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>
                      Payment Information
                    </Text>
                    <View style={{
                      borderWidth: 1,
                      borderColor: Colors.border,
                      backgroundColor: Colors.surface,
                      borderRadius: 8,
                      padding: Spacing.md
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs }}>
                        <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Platform Fee</Text>
                        <Text style={{ fontSize: 13, color: Colors.textPrimary }}>
                          {fmtAmount(selectedSession.platformFee, selectedSession.currency)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs }}>
                        <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Net Credited</Text>
                        <Text style={{ fontSize: 13, color: Colors.textPrimary, fontWeight: '700' }}>
                          {fmtAmount(selectedSession.netAmount, selectedSession.currency)}
                        </Text>
                      </View>
                      {selectedSession.customerId && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs }}>
                          <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Payer ID</Text>
                          <Text style={{ fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: Colors.textPrimary }}>
                            {selectedSession.customerId}
                          </Text>
                        </View>
                      )}
                      {selectedSession.transactionId && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Transaction ID</Text>
                          <Text style={{ fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: Colors.textPrimary }}>
                            {selectedSession.transactionId}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>

          {/* POS Mode Fullscreen Modal Inside Sheet */}
          <Modal visible={posMode} animationType="slide" onRequestClose={() => setPosMode(false)}>
            <View style={{ flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }}>
              <Text style={{ fontSize: 13, color: '#9CA3AF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                POS Scanning Mode
              </Text>
              <Text style={{ fontSize: 20, color: '#FFFFFF', fontWeight: '800', marginBottom: 24, textAlign: 'center' }}>
                {selectedSession.merchantName || 'Aza Merchant'}
              </Text>

              <View style={{
                backgroundColor: '#FFFFFF',
                padding: 24,
                borderRadius: 16,
                alignItems: 'center',
                width: '100%',
                maxWidth: 320,
                marginBottom: Spacing.xl,
              }}>
                <Image 
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(selectedSession.checkoutUrl || `https://pay.aza.systems/c/${selectedSession.id}`)}` }} 
                  style={{ width: 220, height: 220 }} 
                />
                <Text style={{ fontSize: 26, fontWeight: '800', color: '#111827', marginTop: 16 }}>
                  {fmtAmount(selectedSession.amount, selectedSession.currency)}
                </Text>
                {selectedSession.description ? (
                  <Text style={{ fontSize: 13, color: '#4B5563', marginTop: 4, textAlign: 'center' }}>
                    {selectedSession.description}
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 36,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 8,
                }}
                onPress={() => setPosMode(false)}
              >
                <Text style={{ color: '#000000', fontWeight: '700', fontSize: 15 }}>Close POS</Text>
              </TouchableOpacity>
            </View>
          </Modal>
        </Modal>
      )}
    </View>
  );
}
