import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, X, Clock, Edit2, Plus, Trash2 } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/design';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import MedicationCalendar from '@/components/MedicationCalendar';
import ReminderFrequencyPicker from '@/components/ReminderFrequencyPicker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { scheduleMedicationReminder, cancelMedicationReminder } from '@/services/notifications';

interface MedicationLog {
  id: string;
  scheduled_time: string;
  taken_at: string | null;
  status: 'taken' | 'skipped' | 'missed';
  confirmed_via: string | null;
  notes: string | null;
}

interface Medication {
  id: string;
  name: string;
  generic_name: string | null;
  dosage: string | null;
  frequency: string | null;
  description: string | null;
  reminder_time: string | null;
  reminder_times: string[] | null;
  reminder_frequency: 'daily' | 'weekly' | 'monthly' | null;
  reminder_days: number[];
}

export default function MedicationDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [medication, setMedication] = useState<Medication | null>(null);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [todayLog, setTodayLog] = useState<MedicationLog | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [reminderTimes, setReminderTimes] = useState<string[]>([]); // Multiple reminder times
  const [reminderFrequency, setReminderFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [reminderDays, setReminderDays] = useState<number[]>([]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingDosage, setEditingDosage] = useState(false);
  const [editingFrequency, setEditingFrequency] = useState(false);
  const [tempDosage, setTempDosage] = useState('');
  const [tempFrequency, setTempFrequency] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id && user) {
      loadMedicationData();
    }
  }, [id, user]);

  const loadMedicationData = async () => {
    try {
      setLoading(true);

      const { data: medData, error: medError } = await supabase
        .from('medications')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (medError) throw medError;
      setMedication(medData);
      
      // Initialize reminder times from reminder_times or fallback to reminder_time
      if (medData) {
        if (medData.reminder_times && Array.isArray(medData.reminder_times) && medData.reminder_times.length > 0) {
          setReminderTimes(medData.reminder_times);
        } else if (medData.reminder_time) {
          setReminderTimes([medData.reminder_time]);
        } else {
          setReminderTimes([]);
        }
      }

      const { data: logsData, error: logsError } = await supabase
        .from('medication_logs')
        .select('*')
        .eq('medication_id', id)
        .order('scheduled_time', { ascending: false });

      if (logsError) {
        // Handle table not found error gracefully
        if (logsError.code === 'PGRST205') {
          console.warn('medication_logs table not found. Medication tracking features will be limited.');
          setLogs([]);
        } else {
          throw logsError;
        }
      } else {
        setLogs(logsData || []);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayLog = logsData?.find((log) => {
        const logDate = new Date(log.scheduled_time);
        logDate.setHours(0, 0, 0, 0);
        return logDate.getTime() === today.getTime();
      });
      setTodayLog(todayLog || null);
    } catch (error) {
      console.error('Error loading medication data:', error);
      Alert.alert('Error', 'Failed to load medication details');
    } finally {
      setLoading(false);
    }
  };

  const confirmMedication = async () => {
    if (!medication || !user) return;

    try {
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (medication.reminder_time) {
        const [hours, minutes] = medication.reminder_time.split(':');
        today.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }

      if (todayLog) {
        const { error } = await supabase
          .from('medication_logs')
          .update({
            status: 'taken',
            taken_at: now.toISOString(),
            confirmed_via: 'manual',
          })
          .eq('id', todayLog.id);

        if (error) {
          if (error.code === 'PGRST205') {
            Alert.alert(
              'Database Setup Required',
              'The medication_logs table is not available. Please run the migration:\n\nsupabase/migrations/20251126085019_create_medication_tracking_system.sql'
            );
            return;
          }
          throw error;
        }
      } else {
        const { error } = await supabase.from('medication_logs').insert({
          user_id: user.id,
          medication_id: medication.id,
          scheduled_time: today.toISOString(),
          taken_at: now.toISOString(),
          status: 'taken',
          confirmed_via: 'manual',
        });

        if (error) {
          if (error.code === 'PGRST205') {
            Alert.alert(
              'Database Setup Required',
              'The medication_logs table is not available. Please run the migration:\n\nsupabase/migrations/20251126085019_create_medication_tracking_system.sql'
            );
            return;
          }
          throw error;
        }
      }

      Alert.alert('Success', 'Medication intake confirmed!');
      loadMedicationData();
    } catch (error) {
      console.error('Error confirming medication:', error);
      Alert.alert('Error', 'Failed to confirm medication intake');
    }
  };

  const skipMedication = async () => {
    if (!medication || !user) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (medication.reminder_time) {
        const [hours, minutes] = medication.reminder_time.split(':');
        today.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }

      if (todayLog) {
        const { error } = await supabase
          .from('medication_logs')
          .update({
            status: 'skipped',
            confirmed_via: 'manual',
          })
          .eq('id', todayLog.id);

        if (error) {
          if (error.code === 'PGRST205') {
            Alert.alert(
              'Database Setup Required',
              'The medication_logs table is not available. Please run the migration:\n\nsupabase/migrations/20251126085019_create_medication_tracking_system.sql'
            );
            return;
          }
          throw error;
        }
      } else {
        const { error } = await supabase.from('medication_logs').insert({
          user_id: user.id,
          medication_id: medication.id,
          scheduled_time: today.toISOString(),
          status: 'skipped',
          confirmed_via: 'manual',
        });

        if (error) {
          if (error.code === 'PGRST205') {
            Alert.alert(
              'Database Setup Required',
              'The medication_logs table is not available. Please run the migration:\n\nsupabase/migrations/20251126085019_create_medication_tracking_system.sql'
            );
            return;
          }
          throw error;
        }
      }

      Alert.alert('Noted', 'Medication marked as skipped');
      loadMedicationData();
    } catch (error) {
      console.error('Error skipping medication:', error);
      Alert.alert('Error', 'Failed to skip medication');
    }
  };

  const saveDosage = async () => {
    if (!medication || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('medications')
        .update({ dosage: tempDosage.trim() || null })
        .eq('id', medication.id);

      if (error) throw error;

      setMedication({ ...medication, dosage: tempDosage.trim() || null });
      setEditingDosage(false);
      Alert.alert('Success', 'Dosage updated successfully');
    } catch (error) {
      console.error('Error saving dosage:', error);
      Alert.alert('Error', 'Failed to save dosage');
    } finally {
      setSaving(false);
    }
  };

  const saveFrequency = async () => {
    if (!medication || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('medications')
        .update({ frequency: tempFrequency.trim() || null })
        .eq('id', medication.id);

      if (error) throw error;

      setMedication({ ...medication, frequency: tempFrequency.trim() || null });
      setEditingFrequency(false);
      Alert.alert('Success', 'Frequency updated successfully');
    } catch (error) {
      console.error('Error saving frequency:', error);
      Alert.alert('Error', 'Failed to save frequency');
    } finally {
      setSaving(false);
    }
  };

  const addReminderTime = () => {
    if (reminderTime) {
      const timeString = reminderTime.toTimeString().slice(0, 5);
      if (!reminderTimes.includes(timeString)) {
        setReminderTimes([...reminderTimes, timeString].sort());
      }
      setReminderTime(null);
    }
  };

  const removeReminderTime = (timeToRemove: string) => {
    setReminderTimes(reminderTimes.filter(t => t !== timeToRemove));
  };

  const saveReminder = async () => {
    if (!medication || !user) return;

    try {
      if (reminderTimes.length === 0) {
        await supabase
          .from('medications')
          .update({
            reminder_time: null,
            reminder_times: [],
            reminder_frequency: null,
            reminder_days: [],
          })
          .eq('id', medication.id);

        await cancelMedicationReminder(medication.id);
        Alert.alert('Success', 'Reminder removed');
        setShowReminderModal(false);
        loadMedicationData();
        return;
      }

      if (reminderFrequency !== 'daily' && reminderDays.length === 0) {
        Alert.alert('Error', 'Please select at least one day');
        return;
      }

      const daysToSave = reminderFrequency === 'daily' ? [] : reminderDays;
      const primaryTime = reminderTimes[0]; // Keep first time for backward compatibility

      const { error } = await supabase
        .from('medications')
        .update({
          reminder_time: primaryTime,
          reminder_times: reminderTimes,
          reminder_frequency: reminderFrequency,
          reminder_days: daysToSave,
        })
        .eq('id', medication.id);

      if (error) throw error;

      // Cancel existing reminders
      await cancelMedicationReminder(medication.id);

      // Schedule reminders for each time
      for (const timeString of reminderTimes) {
        await scheduleMedicationReminder(
          medication.name,
          timeString,
          medication.id,
          reminderFrequency,
          daysToSave
        );
      }

      Alert.alert('Success', `Reminder${reminderTimes.length > 1 ? 's' : ''} updated successfully`);
      setShowReminderModal(false);
      loadMedicationData();
    } catch (error) {
      console.error('Error saving reminder:', error);
      Alert.alert('Error', 'Failed to save reminder');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!medication) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Medication not found</Text>
      </View>
    );
  }

  const isTakenToday = todayLog?.status === 'taken';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medication Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.medicationCard}>
          <Text style={styles.medicationName}>{medication.name}</Text>
          {medication.generic_name && (
            <Text style={styles.genericName}>{medication.generic_name}</Text>
          )}

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailLabel}>Dosage</Text>
                <TouchableOpacity
                  onPress={() => {
                    setTempDosage(medication.dosage || '');
                    setEditingDosage(true);
                  }}
                  style={styles.editIconButton}>
                  <Edit2 size={14} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              {editingDosage ? (
                <View style={styles.editContainer}>
                  <TextInput
                    style={styles.editInput}
                    value={tempDosage}
                    onChangeText={setTempDosage}
                    placeholder="e.g., 500mg, 1 tablet"
                    placeholderTextColor={Colors.textSecondary}
                    autoFocus
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={styles.cancelEditButton}
                      onPress={() => {
                        setEditingDosage(false);
                        setTempDosage('');
                      }}>
                      <Text style={styles.cancelEditText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveEditButton, saving && styles.saveEditButtonDisabled]}
                      onPress={saveDosage}
                      disabled={saving}>
                      {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.saveEditText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.detailValue}>{medication.dosage || 'Not set'}</Text>
              )}
            </View>
            <View style={styles.detailItem}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailLabel}>Frequency</Text>
                <TouchableOpacity
                  onPress={() => {
                    setTempFrequency(medication.frequency || '');
                    setEditingFrequency(true);
                  }}
                  style={styles.editIconButton}>
                  <Edit2 size={14} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              {editingFrequency ? (
                <View style={styles.editContainer}>
                  <TextInput
                    style={styles.editInput}
                    value={tempFrequency}
                    onChangeText={setTempFrequency}
                    placeholder="e.g., twice daily, once a week"
                    placeholderTextColor={Colors.textSecondary}
                    autoFocus
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={styles.cancelEditButton}
                      onPress={() => {
                        setEditingFrequency(false);
                        setTempFrequency('');
                      }}>
                      <Text style={styles.cancelEditText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveEditButton, saving && styles.saveEditButtonDisabled]}
                      onPress={saveFrequency}
                      disabled={saving}>
                      {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.saveEditText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.detailValue}>{medication.frequency || 'Not set'}</Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.reminderRow}
            onPress={() => {
              // Initialize reminder times
              if (medication.reminder_times && Array.isArray(medication.reminder_times) && medication.reminder_times.length > 0) {
                setReminderTimes(medication.reminder_times);
              } else if (medication.reminder_time) {
                setReminderTimes([medication.reminder_time]);
              } else {
                setReminderTimes([]);
              }
              setReminderFrequency(medication.reminder_frequency || 'daily');
              setReminderDays(medication.reminder_days || []);
              setShowReminderModal(true);
            }}>
            <Clock size={16} color={Colors.textSecondary} />
            <View style={styles.reminderTextContainer}>
              <Text style={styles.reminderText}>
                Reminder{medication.reminder_times && medication.reminder_times.length > 1 ? 's' : ''}: {
                  medication.reminder_times && medication.reminder_times.length > 0
                    ? medication.reminder_times.join(', ')
                    : medication.reminder_time || 'Not set'
                }
              </Text>
              {medication.reminder_frequency && medication.reminder_frequency !== 'daily' && (
                <Text style={styles.reminderFrequencyText}> ({medication.reminder_frequency})</Text>
              )}
            </View>
            <Edit2 size={14} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.todaySection}>
          <Text style={styles.sectionTitle}>Today's Dose</Text>
          {isTakenToday ? (
            <View style={styles.takenBadge}>
              <Check size={20} color={Colors.success} />
              <Text style={styles.takenText}>Taken Today</Text>
            </View>
          ) : (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={confirmMedication}
                activeOpacity={0.8}
              >
                <Check size={20} color={Colors.textOnDark} />
                <Text style={styles.confirmButtonText}>I Took It</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={skipMedication}
                activeOpacity={0.8}
              >
                <X size={20} color={Colors.error} />
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.calendarSection}>
          <Text style={styles.sectionTitle}>History</Text>
          <MedicationCalendar logs={logs} onDateSelect={setSelectedDate} />
        </View>

        {selectedDate && (
          <View style={styles.dateDetailsSection}>
            <Text style={styles.sectionTitle}>
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
            {logs
              .filter((log) => {
                const logDate = new Date(log.scheduled_time);
                return (
                  logDate.getDate() === selectedDate.getDate() &&
                  logDate.getMonth() === selectedDate.getMonth() &&
                  logDate.getFullYear() === selectedDate.getFullYear()
                );
              })
              .map((log) => (
                <View key={log.id} style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <View
                      style={[
                        styles.logStatusBadge,
                        log.status === 'taken' && styles.logStatusTaken,
                        log.status === 'skipped' && styles.logStatusSkipped,
                        log.status === 'missed' && styles.logStatusMissed,
                      ]}
                    >
                      <Text style={styles.logStatusText}>
                        {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </Text>
                    </View>
                    {log.taken_at && (
                      <Text style={styles.logTime}>
                        {new Date(log.taken_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    )}
                  </View>
                  {log.notes && <Text style={styles.logNotes}>{log.notes}</Text>}
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showReminderModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReminderModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Reminder</Text>
            <TouchableOpacity onPress={() => setShowReminderModal(false)}>
              <X size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.reminderConfig}>
              <Text style={styles.configLabel}>Reminder Times</Text>
              <Text style={styles.configSubtext}>Add multiple reminders per day</Text>
              
              {/* Display existing reminder times */}
              {reminderTimes.length > 0 && (
                <View style={styles.reminderTimesList}>
                  {reminderTimes.map((time, index) => (
                    <View key={index} style={styles.reminderTimeItem}>
                      <Clock size={16} color={Colors.primary} />
                      <Text style={styles.reminderTimeText}>{time}</Text>
                      <TouchableOpacity
                        style={styles.removeTimeButton}
                        onPress={() => removeReminderTime(time)}>
                        <Trash2 size={16} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Add new reminder time */}
              <View style={styles.addTimeContainer}>
                <TouchableOpacity
                  style={styles.timeSelector}
                  onPress={() => setShowTimePicker(true)}>
                  <Clock size={20} color={Colors.primary} />
                  <Text style={styles.timeText}>
                    {reminderTime
                      ? reminderTime.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Select time'}
                  </Text>
                </TouchableOpacity>

                {reminderTime && (
                  <TouchableOpacity
                    style={styles.addTimeButton}
                    onPress={addReminderTime}>
                    <Plus size={20} color={Colors.textOnDark} />
                    <Text style={styles.addTimeButtonText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>

              {showTimePicker && (
                <DateTimePicker
                  value={reminderTime || new Date()}
                  mode="time"
                  is24Hour={false}
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowTimePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      setReminderTime(selectedDate);
                    }
                  }}
                />
              )}

              {reminderTimes.length > 0 && (
                <ReminderFrequencyPicker
                  frequency={reminderFrequency}
                  selectedDays={reminderDays}
                  onFrequencyChange={setReminderFrequency}
                  onDaysChange={setReminderDays}
                />
              )}
            </View>

            <View style={styles.modalActions}>
              {reminderTime && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => {
                    setReminderTime(null);
                    setReminderDays([]);
                  }}>
                  <Text style={styles.removeButtonText}>Remove Reminder</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!reminderTime || (reminderFrequency !== 'daily' && reminderDays.length === 0)) &&
                    styles.saveButtonDisabled,
                ]}
                onPress={saveReminder}
                disabled={
                  !reminderTime || (reminderFrequency !== 'daily' && reminderDays.length === 0)
                }>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },
  medicationCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  medicationName: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  genericName: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.base,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginBottom: Spacing.base,
  },
  detailItem: {
    flex: 1,
    backgroundColor: Colors.badgeBackground,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
  },
  detailLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  detailValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.base,
  },
  reminderTextContainer: {
    flex: 1,
  },
  reminderText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  editIconButton: {
    padding: Spacing.xs,
  },
  editContainer: {
    marginTop: Spacing.sm,
  },
  editInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    ...Typography.body,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  editActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cancelEditButton: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelEditText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  saveEditButton: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveEditButtonDisabled: {
    opacity: 0.5,
  },
  saveEditText: {
    ...Typography.body,
    color: Colors.textOnDark,
    fontWeight: '600',
  },
  todaySection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.base,
    ...Shadows.sm,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.base,
  },
  takenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Colors.success}15`,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  takenText: {
    ...Typography.body,
    color: Colors.success,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: Spacing.base + 4,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    ...Shadows.soft,
  },
  confirmButtonText: {
    ...Typography.button,
    color: Colors.textOnDark,
    fontWeight: '700',
  },
  skipButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.base + 4,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  skipButtonText: {
    ...Typography.button,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  calendarSection: {
    marginBottom: Spacing.base,
  },
  dateDetailsSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.base,
    ...Shadows.sm,
  },
  logCard: {
    backgroundColor: Colors.badgeBackground,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.base,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logStatusBadge: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  logStatusTaken: {
    backgroundColor: `${Colors.success}20`,
  },
  logStatusSkipped: {
    backgroundColor: `${Colors.warning}20`,
  },
  logStatusMissed: {
    backgroundColor: `${Colors.error}20`,
  },
  logStatusText: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  logTime: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  logNotes: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  reminderFrequencyText: {
    fontStyle: 'italic',
    color: Colors.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.base,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  reminderConfig: {
    gap: Spacing.lg,
  },
  configLabel: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  timeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    backgroundColor: Colors.surface,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  timeText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  modalActions: {
    marginTop: Spacing.xl,
    gap: Spacing.base,
  },
  removeButton: {
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.error,
    alignItems: 'center',
  },
  removeButtonText: {
    ...Typography.button,
    color: Colors.error,
  },
  saveButton: {
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.success,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    ...Typography.button,
    color: Colors.textOnDark,
  },
  configSubtext: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.base,
  },
  reminderTimesList: {
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  reminderTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reminderTimeText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  removeTimeButton: {
    padding: Spacing.xs,
  },
  addTimeContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  addTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
  },
  addTimeButtonText: {
    ...Typography.body,
    color: Colors.textOnDark,
    fontWeight: '600',
  },
});
