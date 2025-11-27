import React from 'react';
import { View, StyleSheet, ImageBackground, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing } from '@/constants/design';

interface PremiumCardProps {
  children: React.ReactNode;
  image?: string | any;
  overlay?: boolean;
  onPress?: () => void;
  style?: any;
  contentStyle?: any;
}

export default function PremiumCard({
  children,
  image,
  overlay = true,
  onPress,
  style,
  contentStyle,
}: PremiumCardProps) {
  const CardWrapper = onPress ? TouchableOpacity : View;

  return (
    <CardWrapper
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={onPress ? 0.9 : 1}
    >
      {image ? (
        <ImageBackground
          source={typeof image === 'string' ? { uri: image } : image}
          style={styles.imageBackground}
          imageStyle={styles.imageStyle}
        >
          {overlay && (
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.overlay}
            />
          )}
          <View style={[styles.content, contentStyle]}>{children}</View>
        </ImageBackground>
      ) : (
        <View style={[styles.content, contentStyle]}>{children}</View>
      )}
    </CardWrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  imageBackground: {
    width: '100%',
    height: '100%',
  },
  imageStyle: {
    borderRadius: BorderRadius.xl,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.xl,
  },
  content: {
    padding: Spacing.base,
  },
});
