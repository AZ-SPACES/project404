import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { MiniAppProps } from './types';

interface Event {
  id: string;
  name: string;
  venue: string;
  date: string;
  time: string;
  price: number;
  emoji: string;
  color: string;
}

const EVENTS: Event[] = [
  { id: '1', name: 'Afrofusion Night', venue: 'Accra Int. Conference Centre', date: 'Sat, 12 Jul 2025', time: '8:00 PM', price: 150, emoji: '🎵', color: '#6C3483' },
  { id: '2', name: 'Detty December Carnival', venue: 'Labadi Beach Hotel', date: 'Fri, 26 Dec 2025', time: '9:00 PM', price: 250, emoji: '🎉', color: '#E74C3C' },
  { id: '3', name: 'Ghana Comedy Nite', venue: 'National Theatre, Accra', date: 'Sun, 20 Jul 2025', time: '7:00 PM', price: 80, emoji: '😂', color: '#F39C12' },
  { id: '4', name: 'Jazz Under the Stars', venue: 'Kempinski Hotel', date: 'Sat, 2 Aug 2025', time: '7:30 PM', price: 200, emoji: '🎷', color: '#1A5276' },
];

export default function BuyTicketsApp({ onClose }: MiniAppProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const selectedEvent = EVENTS.find((e) => e.id === selectedId) ?? null;
  const total = selectedEvent ? selectedEvent.price * quantity : 0;

  const handleSelect = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setQuantity(1);
    } else {
      setSelectedId(id);
      setQuantity(1);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>Upcoming Events</Text>

        {EVENTS.map((event) => {
          const active = selectedId === event.id;
          return (
            <TouchableOpacity
              key={event.id}
              style={[styles.card, active && styles.cardActive]}
              activeOpacity={0.85}
              onPress={() => handleSelect(event.id)}
              accessibilityRole="button"
              accessibilityLabel={`${event.name} on ${event.date}`}
              accessibilityState={{ selected: active }}
            >
              {/* Left color strip */}
              <View style={[styles.strip, { backgroundColor: event.color }]}>
                <Text style={styles.stripEmoji}>{event.emoji}</Text>
              </View>

              {/* Content */}
              <View style={styles.cardBody}>
                <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
                <View style={styles.metaRow}>
                  <Feather name="map-pin" size={12} color={Colors.textSecondary} />
                  <Text style={styles.metaText} numberOfLines={1}>{event.venue}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Feather name="calendar" size={12} color={Colors.textSecondary} />
                  <Text style={styles.metaText}>{event.date} · {event.time}</Text>
                </View>
                <Text style={styles.price}>GH₵{event.price} per ticket</Text>

                {/* Quantity stepper (only when selected) */}
                {active && (
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                      accessibilityLabel="Decrease quantity"
                      accessibilityRole="button"
                    >
                      <Feather name="minus" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.stepCount}>{quantity}</Text>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setQuantity((q) => Math.min(10, q + 1))}
                      accessibilityLabel="Increase quantity"
                      accessibilityRole="button"
                    >
                      <Feather name="plus" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bottom bar */}
      {selectedEvent && (
        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.totalLabel}>{quantity} ticket{quantity > 1 ? 's' : ''}</Text>
            <Text style={styles.totalAmount}>GH₵{total.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={styles.buyBtn}
            accessibilityRole="button"
            accessibilityLabel={`Buy ${quantity} ticket${quantity > 1 ? 's' : ''} for GH₵${total.toFixed(2)}`}
          >
            <Text style={styles.buyBtnText}>Buy Tickets</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    content: { padding: Spacing.lg, paddingBottom: Spacing.xl * 3 },
    subtitle: {
      ...Typography.body,
      color: Colors.textSecondary,
      marginBottom: Spacing.md,
    },
    card: {
      flexDirection: 'row',
      backgroundColor: Colors.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      marginBottom: Spacing.md,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    cardActive: {
      borderColor: Colors.primary,
      borderWidth: 2,
    },
    strip: {
      width: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stripEmoji: { fontSize: 24 },
    cardBody: { flex: 1, padding: Spacing.md },
    eventName: {
      ...Typography.body,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 2,
    },
    metaText: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
    price: {
      ...Typography.caption,
      color: Colors.primary,
      fontWeight: '600',
      marginTop: 4,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.sm,
      gap: Spacing.md,
    },
    stepBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepCount: {
      ...Typography.bodyLg,
      fontWeight: '700',
      color: Colors.textPrimary,
      minWidth: 24,
      textAlign: 'center',
    },
    bottomBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    totalLabel: { ...Typography.caption, color: Colors.textSecondary },
    totalAmount: { ...Typography.h3, color: Colors.textPrimary, fontWeight: '700' },
    buyBtn: {
      backgroundColor: Colors.primary,
      paddingHorizontal: Spacing.xl,
      paddingVertical: 12,
      borderRadius: Radius.full,
    },
    buyBtnText: { ...Typography.button, color: Colors.secondary, fontWeight: '700' },
  });
}
