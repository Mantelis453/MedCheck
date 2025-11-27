import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Colors, Shadows, BorderRadius, Spacing, Typography } from '@/constants/design';

interface PremiumButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: any;
}

export default function PremiumButton({
  title,
  onPress,
  variant = 'primary',
  size = 'large',
  loading = false,
  disabled = false,
  icon,
  style,
}: PremiumButtonProps) {
  const buttonStyles = [
    styles.button,
    styles[`button_${variant}`],
    styles[`button_${size}`],
    (disabled || loading) && styles.buttonDisabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? Colors.secondary : Colors.primary}
        />
      ) : (
        <>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={textStyles}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },

  button_primary: {
    backgroundColor: Colors.primary,
    ...Shadows.md,
  },
  button_secondary: {
    backgroundColor: Colors.accent,
    ...Shadows.md,
  },
  button_outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.primary,
  },

  button_small: {
    height: 40,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  button_medium: {
    height: 48,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
  },
  button_large: {
    height: 56,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.xxl,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  text: {
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  text_primary: {
    color: Colors.textOnDark,
    fontSize: 17,
  },
  text_secondary: {
    color: Colors.textOnDark,
    fontSize: 17,
  },
  text_outline: {
    color: Colors.primary,
    fontSize: 17,
  },
  text_small: {
    fontSize: 14,
  },
  text_medium: {
    fontSize: 15,
  },
  text_large: {
    fontSize: 17,
  },

  icon: {
    marginRight: -4,
  },
});
