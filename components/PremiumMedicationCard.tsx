import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Pill, Clock, Bell } from 'lucide-react-native';
import { Colors, Shadows, BorderRadius, Spacing, Typography } from '@/constants/design';
import { Medication } from '@/types/database';
import { formatMedicationName, formatDosage, formatFrequency } from '@/utils/formatting';

interface PremiumMedicationCardProps {
  medication: Medication;
  onPress: (medication: Medication) => void;
}

// Category-specific gradient backgrounds for medication cards
const categoryGradients: Record<string, [string, string]> = {
  prescription: ['#5D3A9B', '#7B4FC2'], // Deep Purple
  otc: ['#3AAFA9', '#2D8B85'], // Teal
  supplement: ['#A8E6A3', '#8FD687'], // Light Green
};

// Fallback gradient for medications without a category
const defaultGradient: [string, string] = ['#667EEA', '#764BA2'];

const categoryLabels: Record<string, string> = {
  otc: 'OTC',
  prescription: 'Rx',
  supplement: 'Supp',
};

const PremiumMedicationCard = React.memo(({ medication, onPress }: PremiumMedicationCardProps) => {
  // Select gradient based on medication category
  const gradient = medication.category
    ? categoryGradients[medication.category] || defaultGradient
    : defaultGradient;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(medication)}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      >
        <View style={styles.iconContainer}>
          <View style={styles.iconBadge}>
            <Pill size={24} color={Colors.textOnDark} strokeWidth={2.5} />
          </View>
          {medication.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {categoryLabels[medication.category] || medication.category}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.medicationName} numberOfLines={2}>
            {formatMedicationName(medication.name)}
          </Text>

          {medication.dosage && (
            <View style={styles.dosageBadge}>
              <Text style={styles.dosageText}>{formatDosage(medication.dosage)}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            {medication.frequency && (
              <View style={styles.infoBadge}>
                <Clock size={12} color={Colors.textOnDark} strokeWidth={2} />
                <Text style={styles.infoText}>{formatFrequency(medication.frequency)}</Text>
              </View>
            )}

            {medication.reminder_time && (
              <View style={styles.infoBadge}>
                <Bell size={12} color={Colors.textOnDark} strokeWidth={2} />
                <Text style={styles.infoText}>{medication.reminder_time}</Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

PremiumMedicationCard.displayName = 'PremiumMedicationCard';

export default PremiumMedicationCard;

const styles = StyleSheet.create({
  card: {
    width: '48%',
    aspectRatio: 0.75,
    marginBottom: Spacing.base,
  },
  gradientBackground: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...Shadows.card,
    minHeight: 180,
  },
  iconContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textOnDark,
  },
  content: {
    gap: Spacing.xs,
    flex: 1,
    justifyContent: 'flex-end',
    minHeight: 100,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textOnDark,
    marginBottom: Spacing.xs,
    lineHeight: 22,
    textAlign: 'left',
    letterSpacing: -0.2,
  },
  dosageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  dosageText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textOnDark,
  },
  infoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    gap: 4,
  },
  infoText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textOnDark,
  },
});
