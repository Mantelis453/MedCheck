import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Pill, Trash2, Clock } from 'lucide-react-native';
import { Medication } from '@/types/database';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/design';
import { formatMedicationName, formatGenericName, formatDosage, formatFrequency } from '@/utils/formatting';

interface MedicationCardProps {
  medication: Medication;
  onDelete: (id: string) => void;
  onPress: (medication: Medication) => void;
}

const MedicationCard = React.memo(({
  medication,
  onDelete,
  onPress,
}: MedicationCardProps) => {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(medication)}
      activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        <Pill size={28} color={Colors.primary} strokeWidth={2.5} />
      </View>

      <View style={styles.content}>
        <Text style={styles.name}>{formatMedicationName(medication.name)}</Text>
        {medication.generic_name && (
          <Text style={styles.generic}>{formatGenericName(medication.generic_name)}</Text>
        )}
        <View style={styles.details}>
          {medication.dosage && (
            <Text style={styles.detailText}>{formatDosage(medication.dosage)}</Text>
          )}
          {medication.frequency && (
            <Text style={styles.detailText}> • {formatFrequency(medication.frequency)}</Text>
          )}
        </View>
        {medication.reminder_time && (
          <View style={styles.reminder}>
            <Clock size={12} color={Colors.success} strokeWidth={2.5} />
            <Text style={styles.reminderText}>{medication.reminder_time}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={(e) => {
          e.stopPropagation();
          onDelete(medication.id);
        }}>
        <Trash2 size={20} color={Colors.danger} strokeWidth={2} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

MedicationCard.displayName = 'MedicationCard';

export default MedicationCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
    ...Shadows.soft,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
  },
  name: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  generic: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    backgroundColor: `${Colors.success}10`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  reminderText: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '600',
  },
  deleteButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
});
