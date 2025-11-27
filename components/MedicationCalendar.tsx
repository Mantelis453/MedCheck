import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/design';

interface MedicationLog {
  id: string;
  scheduled_time: string;
  taken_at: string | null;
  status: 'taken' | 'skipped' | 'missed';
}

interface MedicationCalendarProps {
  logs: MedicationLog[];
  onDateSelect?: (date: Date) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function MedicationCalendar({ logs, onDateSelect }: MedicationCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const logsByDate = useMemo(() => {
    const map = new Map<string, MedicationLog[]>();
    logs.forEach((log) => {
      const date = new Date(log.scheduled_time);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(log);
    });
    return map;
  }, [logs]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getDayStatus = (date: Date | null) => {
    if (!date) return null;

    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const dayLogs = logsByDate.get(key);

    if (!dayLogs || dayLogs.length === 0) {
      return null;
    }

    const hasTaken = dayLogs.some((log) => log.status === 'taken');
    const hasMissed = dayLogs.some((log) => log.status === 'missed' || log.status === 'skipped');

    if (hasTaken && !hasMissed) return 'taken';
    if (hasMissed && !hasTaken) return 'missed';
    return 'partial';
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const days = getDaysInMonth(currentDate);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.monthYear}>
          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </Text>

        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
          <ChevronRight size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.daysHeader}>
        {DAYS.map((day) => (
          <View key={day} style={styles.dayHeaderCell}>
            <Text style={styles.dayHeaderText}>{day}</Text>
          </View>
        ))}
      </View>

      <View style={styles.daysGrid}>
        {days.map((date, index) => {
          const status = getDayStatus(date);
          const today = isToday(date);

          return (
            <TouchableOpacity
              key={index}
              style={[styles.dayCell, today && styles.todayCell]}
              disabled={!date}
              onPress={() => date && onDateSelect?.(date)}
              activeOpacity={0.7}
            >
              {date && (
                <>
                  <Text style={[styles.dayText, today && styles.todayText]}>{date.getDate()}</Text>
                  {status && (
                    <View style={styles.dotsContainer}>
                      {status === 'taken' && <View style={[styles.dot, styles.takenDot]} />}
                      {status === 'missed' && <View style={[styles.dot, styles.missedDot]} />}
                      {status === 'partial' && (
                        <>
                          <View style={[styles.dot, styles.takenDot]} />
                          <View style={[styles.dot, styles.missedDot]} />
                        </>
                      )}
                    </View>
                  )}
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.takenDot]} />
          <Text style={styles.legendText}>Taken</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.missedDot]} />
          <Text style={styles.legendText}>Missed/Skipped</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
    paddingHorizontal: Spacing.sm,
  },
  navButton: {
    padding: Spacing.sm,
  },
  monthYear: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  daysHeader: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  dayHeaderText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xs,
    position: 'relative',
  },
  todayCell: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
  },
  dayText: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  todayText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 2,
    position: 'absolute',
    bottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  takenDot: {
    backgroundColor: Colors.success,
  },
  missedDot: {
    backgroundColor: Colors.error,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginTop: Spacing.base,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
});
