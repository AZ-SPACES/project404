import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, DimensionValue, ActivityIndicator } from 'react-native';

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
  loading?: boolean;
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
  loading = false,
  ...props
}) => {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: isDisabled ? 'transparent' : backgroundColor,
          borderColor: backgroundColor,
          borderWidth: isDisabled ? 1 : 0,
          borderRadius,
          paddingVertical,
          paddingHorizontal,
          width,
        } as ViewStyle,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={backgroundColor} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            {
              color: isDisabled ? backgroundColor : textColor,
              fontSize,
              fontWeight,
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
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