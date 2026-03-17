import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, DimensionValue } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: number;
  paddingVertical?: number;
  paddingHorizontal?: number;
  fontSize?: number;
  fontWeight?: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
  width?: DimensionValue;
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  title, 
  onPress, 
  style, 
  textStyle, 
  backgroundColor = '#1E5128',
  textColor = '#ffffff',
  borderRadius = 8, 
  paddingVertical = 16,
  paddingHorizontal = 24,
  fontSize = 16,
  fontWeight = '600',
  width = '100%',
  disabled = false,
  ...props 
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: disabled ? 'transparent' : backgroundColor,
          borderColor: backgroundColor,
          borderWidth: disabled ? 1 : 0,
          borderRadius,
          paddingVertical,
          paddingHorizontal,
          width,
        } as ViewStyle,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      {...props}
    >
      <Text
        style={[
          styles.buttonText,
          {
            color: disabled ? backgroundColor : textColor,
            fontSize,
            fontWeight,
          },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    // Using system fonts as per Uncodixify
  },
});

export default Button;