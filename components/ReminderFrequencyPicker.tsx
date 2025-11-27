import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/design';
import { Check } from 'lucide-react-native';

interface ReminderFrequencyPickerProps {
  frequency: 'daily' | 'weekly' | 'monthly';
  selectedDays: number[];
  onFrequencyChange: (frequency: 'daily' | 'weekly' | 'monthly') => void;
  onDaysChange: (days: number[]) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function ReminderFrequencyPicker({
  frequency,
  selectedDays,
  onFrequencyChange,
  onDaysChange,
}: ReminderFrequencyPickerProps) {
  const toggleWeekday = (day: number) => {
    if (selectedDays.includes(day)) {
      onDaysChange(selectedDays.filter((d) => d !== day));
    } else {
      onDaysChange([...selectedDays, day].sort());
    }
  };

  const toggleMonthDay = (day: number) => {
    if (selectedDays.includes(day)) {
      onDaysChange(selectedDays.filter((d) => d !== day));
    } else {
      onDaysChange([...selectedDays, day].sort((a, b) => a - b));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Reminder Frequency</Text>

      <View style={styles.frequencyButtons}>
        <TouchableOpacity
          style={[
            styles.frequencyButton,
            frequency === 'daily' && styles.frequencyButtonActive,
          ]}
          onPress={() => onFrequencyChange('daily')}>
          <Text
            style={[
              styles.frequencyButtonText,
              frequency === 'daily' && styles.frequencyButtonTextActive,
            ]}>
            Daily
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.frequencyButton,
            frequency === 'weekly' && styles.frequencyButtonActive,
          ]}
          onPress={() => onFrequencyChange('weekly')}>
          <Text
            style={[
              styles.frequencyButtonText,
              frequency === 'weekly' && styles.frequencyButtonTextActive,
            ]}>
            Weekly
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.frequencyButton,
            frequency === 'monthly' && styles.frequencyButtonActive,
          ]}
          onPress={() => onFrequencyChange('monthly')}>
          <Text
            style={[
              styles.frequencyButtonText,
              frequency === 'monthly' && styles.frequencyButtonTextActive,
            ]}>
            Monthly
          </Text>
        </TouchableOpacity>
      </View>

      {frequency === 'weekly' && (
        <View style={styles.daysContainer}>
          <Text style={styles.daysLabel}>Select Days</Text>
          <View style={styles.weekdaysGrid}>
            {WEEKDAYS.map((day, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayButton,
                  selectedDays.includes(index) && styles.dayButtonActive,
                ]}
                onPress={() => toggleWeekday(index)}>
                {selectedDays.includes(index) && (
                  <View style={styles.checkIcon}>
                    <Check size={12} color={Colors.textOnDark} />
                  </View>
                )}
                <Text
                  style={[
                    styles.dayButtonText,
                    selectedDays.includes(index) && styles.dayButtonTextActive,
                  ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {frequency === 'monthly' && (
        <View style={styles.daysContainer}>
          <Text style={styles.daysLabel}>Select Days of Month</Text>
          <ScrollView style={styles.monthDaysScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.monthDaysGrid}>
              {MONTH_DAYS.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.monthDayButton,
                    selectedDays.includes(day) && styles.monthDayButtonActive,
                  ]}
                  onPress={() => toggleMonthDay(day)}>
                  {selectedDays.includes(day) && (
                    <View style={styles.checkIconMonth}>
                      <Check size={10} color={Colors.textOnDark} />
                    </View>
                  )}
                  <Text
                    style={[
                      styles.monthDayButtonText,
                      selectedDays.includes(day) && styles.monthDayButtonTextActive,
                    ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {frequency === 'daily' && (
        <Text style={styles.infoText}>Reminder will repeat every day at the selected time</Text>
      )}

      {frequency === 'weekly' && selectedDays.length === 0 && (
        <Text style={styles.warningText}>Please select at least one day</Text>
      )}

      {frequency === 'monthly' && selectedDays.length === 0 && (
        <Text style={styles.warningText}>Please select at least one day of the month</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.base,
  },
  label: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  frequencyButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  frequencyButton: {
    flex: 1,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  frequencyButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  frequencyButtonText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  frequencyButtonTextActive: {
    color: Colors.textOnDark,
  },
  daysContainer: {
    marginTop: Spacing.sm,
  },
  daysLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  weekdaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  dayButton: {
    width: 44,
    height: 44,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dayButtonActive: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  checkIcon: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  dayButtonTextActive: {
    color: Colors.textOnDark,
  },
  monthDaysScroll: {
    maxHeight: 200,
  },
  monthDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  monthDayButton: {
    width: 40,
    height: 40,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  monthDayButtonActive: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  checkIconMonth: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthDayButtonText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 12,
  },
  monthDayButtonTextActive: {
    color: Colors.textOnDark,
  },
  infoText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  warningText: {
    ...Typography.bodySmall,
    color: Colors.warning,
    fontStyle: 'italic',
  },
});
