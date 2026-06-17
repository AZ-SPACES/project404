import React from 'react';
import { View, ImageSourcePropType } from 'react-native';
import QRCodeSvg from 'react-native-qrcode-svg';

type Props = {
  /** The string encoded into the QR code. */
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  /** Optional centre logo (e.g. require('../assets/aza-z.png')). */
  logo?: ImageSourcePropType;
  logoSize?: number;
};

/**
 * Renders a QR code locally via react-native-svg — no third-party image
 * service. Use anywhere the app shows a scannable code (pay links, withdrawal
 * codes, merchant store/checkout codes).
 */
export default function QrCode({
  value,
  size = 200,
  color = '#000000',
  backgroundColor = '#FFFFFF',
  logo,
  logoSize,
}: Props) {
  // The underlying lib throws on an empty value; render a placeholder instead.
  if (!value) {
    return <View style={{ width: size, height: size, backgroundColor }} />;
  }
  return (
    <QRCodeSvg
      value={value}
      size={size}
      color={color}
      backgroundColor={backgroundColor}
      {...(logo
        ? {
            logo,
            logoSize: logoSize ?? Math.round(size * 0.22),
            logoBackgroundColor: backgroundColor,
            logoBorderRadius: 6,
          }
        : {})}
    />
  );
}
