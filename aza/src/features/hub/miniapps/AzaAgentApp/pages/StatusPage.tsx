import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { NavProps } from '../types';

interface Props extends NavProps {
  icon: string;
  iconColor?: string;
  title: string;
  message: string;
}

/** Shared non-interactive status screen for pending/suspended/rejected states. */
export default function StatusPage({ icon, iconColor, title, message, Colors, styles }: Props) {
  return (
    <View style={styles.center}>
      <MaterialIcons name={icon as any} size={56} color={iconColor ?? Colors.primary} />
      <Text style={[styles.title, { marginTop: 16, textAlign: 'center' }]}>{title}</Text>
      <Text style={styles.subtitle}>{message}</Text>
    </View>
  );
}
