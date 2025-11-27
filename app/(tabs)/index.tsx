import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Medication } from '@/types/database';
import MedicationCard from '@/components/MedicationCard';
import PremiumMedicationCard from '@/components/PremiumMedicationCard';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/design';
import { AlertCircle, CheckCircle, X, Clock, Edit2, Trash2 } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { checkMedicationInteractions } from '@/services/gemini';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  scheduleMedicationReminder,
  cancelMedicationReminder,
} from '@/services/notifications';

export default function MedicationsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [previousMedicationIds, setPreviousMedicationIds] = useState<string>('');
  const [checkingInteractions, setCheckingInteractions] = useState(false);
  const [interactionResult, setInteractionResult] = useState<{
    safe: boolean;
    interactions: Array<{
      drug1: string;
      drug2: string;
      severity: 'low' | 'moderate' | 'high' | 'critical';
      description: string;
    }>;
    warnings: string[];
  } | null>(null);
  const [showInteractions, setShowInteractions] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [editingReminder, setEditingReminder] = useState(false);
  const [newReminderTime, setNewReminderTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name?: string } | null>(null);
  const [takenMedsCount, setTakenMedsCount] = useState<{ taken: number; total: number }>({ taken: 0, total: 0 });
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadMedications();
    }, [user])
  );

  useEffect(() => {
    loadMedications();
    loadUserProfile();

    const subscription = supabase
      .channel('medications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medications',
          filter: `user_id=eq.${user?.id}`,
        },
        async () => {
          // When medications change, reload and check interactions
          if (!user) return;
          
          const { data } = await supabase
            .from('medications')
            .select('id, name, generic_name, dosage, frequency, reminder_time, reminder_times, category, created_at')
            .eq('user_id', user.id)
            .eq('active', true)
            .order('created_at', { ascending: false });
          
          if (data) {
            setMedications(data);
            // Check interactions when medications change (added/removed)
            if (data.length > 1) {
              checkInteractions(data, true).catch((err) => {
                console.error('Interaction check failed:', err);
              });
            } else {
              setInteractionResult({ safe: true, interactions: [], warnings: [] });
            }
            // Update taken meds count
            await loadTakenMedsCount(data);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const firstName = useMemo((): string => {
    if (!userProfile?.full_name) return '';
    const nameParts = userProfile.full_name.trim().split(/\s+/);
    return nameParts[0] || '';
  }, [userProfile?.full_name]);

  const loadMedications = async () => {
    if (!user) return;

    setLoading(true);
    // Optimize: Only select fields needed for display
    const { data, error } = await supabase
      .from('medications')
      .select('id, name, generic_name, dosage, frequency, reminder_time, reminder_times, category, created_at')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (data) {
      // Check if medications changed by comparing IDs
      const currentIds = data.map(m => m.id).sort().join(',');
      const medicationsChanged = previousMedicationIds !== '' && currentIds !== previousMedicationIds;
      
      setMedications(data);
      setLoading(false); // Show medications immediately
      
      // Load saved interaction results first
      const hasSavedResult = await loadSavedInteractionResult(data);
      
      // Check interactions ONLY if:
      // 1. Initial load (no previous IDs) and no saved result exists - check on first load only
      // 2. Medications changed (added/removed) - check when medications actually change
      // Do NOT check on tab switches if medications haven't changed
      if (data.length > 1) {
        const isInitialLoad = previousMedicationIds === '';
        
        // Only check on initial load if no saved result, OR if medications changed
        if (isInitialLoad && !hasSavedResult) {
          // Initial load with no saved result - check interactions
          checkInteractions(data, true).catch((err) => {
            console.error('Interaction check failed:', err);
          });
        } else if (medicationsChanged) {
          // Medications changed - re-check interactions
          checkInteractions(data, true).catch((err) => {
            console.error('Interaction check failed:', err);
          });
        }
        // If hasSavedResult and medications haven't changed, use saved result (already set in loadSavedInteractionResult)
        // If no saved result but not initial load and medications haven't changed, don't check (use existing result or null)
      } else if (data.length <= 1) {
        setInteractionResult({ safe: true, interactions: [], warnings: [] });
      }
      
      // Update previous IDs for next comparison (after all checks)
      setPreviousMedicationIds(currentIds);
      
      // Load taken meds count for today
      await loadTakenMedsCount(data);
    } else {
      setLoading(false);
    }
  };

  const loadTakenMedsCount = async (meds: Medication[]) => {
    if (!user || meds.length === 0) {
      setTakenMedsCount({ taken: 0, total: meds.length });
      return;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: logs } = await supabase
        .from('medication_logs')
        .select('medication_id, status')
        .eq('user_id', user.id)
        .gte('scheduled_time', today.toISOString())
        .lt('scheduled_time', tomorrow.toISOString())
        .eq('status', 'taken');

      const takenIds = new Set(logs?.map(log => log.medication_id) || []);
      const takenCount = takenIds.size;
      
      setTakenMedsCount({ taken: takenCount, total: meds.length });
    } catch (error) {
      console.error('Error loading taken meds count:', error);
      setTakenMedsCount({ taken: 0, total: meds.length });
    }
  };

  const loadSavedInteractionResult = async (meds: Medication[]): Promise<boolean> => {
    if (!user || meds.length < 2) {
      setInteractionResult({ safe: true, interactions: [], warnings: [] });
      return true; // Return true to indicate we have a result (safe state)
    }

    try {
      // Get the most recent interaction check for these medications
      const medicationIds = meds.map(m => m.id).sort();
      
      const { data: savedInteractions } = await supabase
        .from('interactions')
        .select('analysis, checked_at, medication_ids')
        .eq('user_id', user.id)
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Check if saved interaction matches current medication set
      if (savedInteractions?.analysis && savedInteractions.medication_ids) {
        const savedIds = Array.isArray(savedInteractions.medication_ids) 
          ? (savedInteractions.medication_ids as string[]).sort()
          : [];
        const currentIdsSorted = [...medicationIds].sort();
        
        // Compare arrays by length and content
        if (savedIds.length === currentIdsSorted.length && 
            savedIds.every((id, idx) => id === currentIdsSorted[idx])) {
          // Use saved result
          setInteractionResult(savedInteractions.analysis as any);
          return true; // Found saved result
        }
      }

      // No saved result found
      return false;
    } catch (error) {
      console.error('Error loading saved interactions:', error);
      return false;
    }
  };

  const checkInteractions = async (meds: Medication[], shouldSave: boolean = true) => {
    if (meds.length < 2) {
      setInteractionResult({ safe: true, interactions: [], warnings: [] });
      return;
    }

    setCheckingInteractions(true);
    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey || apiKey === 'your-gemini-api-key' || apiKey.trim() === '') {
        console.warn('Gemini API key not configured or using placeholder. Skipping interaction check.');
        setInteractionResult({ safe: true, interactions: [], warnings: [] });
        setCheckingInteractions(false);
        return;
      }

      // Optimize: Reuse cached userProfile or fetch only needed fields
      let profileData = userProfile;
      if (!profileData) {
        const { data } = await supabase
          .from('user_profiles')
          .select('date_of_birth, weight, allergies, medical_conditions')
          .eq('user_id', user!.id)
          .maybeSingle();
        profileData = data;
      }

      const result = await checkMedicationInteractions(
        meds.map((m) => ({ name: m.name, dosage: m.dosage || undefined })),
        {
          age: profileData?.date_of_birth
            ? new Date().getFullYear() - new Date(profileData.date_of_birth).getFullYear()
            : null,
          weight: profileData?.weight || null,
          allergies: profileData?.allergies || [],
          conditions: profileData?.medical_conditions || [],
        },
        apiKey
      );

      setInteractionResult(result);

      // Save interaction result to database
      if (shouldSave) {
        await supabase.from('interactions').insert({
          user_id: user!.id,
          medication_ids: meds.map((m) => m.id),
          analysis: result,
          severity: result.safe ? 'safe' : result.interactions.some((i) => i.severity === 'critical') ? 'critical' : 'warning',
          has_warnings: !result.safe,
        });
      }
    } catch (error: any) {
      console.error('Failed to check interactions:', error);
    } finally {
      setCheckingInteractions(false);
    }
  };

  const handleMedicationPress = useCallback((medication: Medication) => {
    router.push(`/(tabs)/medication-detail?id=${medication.id}`);
  }, [router]);

  const deleteMedication = async (medicationId: string) => {
    const medication = medications.find((m) => m.id === medicationId);
    if (!medication) return;

    Alert.alert(
      'Delete Medication',
      `Are you sure you want to delete ${medication.name}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (medication.reminder_time) {
                await cancelMedicationReminder(medication.id);
              }

              const { error } = await supabase
                .from('medications')
                .delete()
                .eq('id', medication.id);

              if (error) throw error;

              const updatedMeds = medications.filter((m) => m.id !== medication.id);
              setMedications(updatedMeds);
              setSelectedMedication(null);
              
              // Check interactions after deletion (medications changed)
              if (updatedMeds.length > 1) {
                checkInteractions(updatedMeds, true).catch((err) => {
                  console.error('Interaction check failed:', err);
                });
              } else {
                setInteractionResult({ safe: true, interactions: [], warnings: [] });
              }
              
              // Update taken meds count
              await loadTakenMedsCount(updatedMeds);
              
              Alert.alert('Success', 'Medication deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete medication');
            }
          },
        },
      ]
    );
  };

  const updateReminder = async () => {
    if (!selectedMedication) return;

    const timeString = newReminderTime
      ? newReminderTime.toTimeString().slice(0, 5)
      : null;

    const { error } = await supabase
      .from('medications')
      .update({
        reminder_time: timeString,
      })
      .eq('id', selectedMedication.id);

    if (error) {
      Alert.alert('Error', 'Failed to update reminder');
    } else {
      if (timeString) {
        await scheduleMedicationReminder(
          selectedMedication.name,
          timeString,
          selectedMedication.id
        );
      } else {
        await cancelMedicationReminder(selectedMedication.id);
      }

      Alert.alert('Success', 'Reminder updated');
      setEditingReminder(false);
      setSelectedMedication(null);
      loadMedications();
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Hello{firstName ? `, ${firstName}` : ''}
        </Text>
        <Text style={styles.title}>Your Medications</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {checkingInteractions && (
          <View style={styles.checkingBanner}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={styles.checkingText}>Checking interactions...</Text>
          </View>
        )}

        {!checkingInteractions && interactionResult !== null && medications.length > 1 && (
          <TouchableOpacity
            style={[
              styles.interactionBanner,
              interactionResult.safe ? styles.safeBanner : styles.warningBanner,
            ]}
            onPress={() => setShowInteractions(true)}>
            {interactionResult.safe ? (
              <CheckCircle size={20} color={Colors.success} />
            ) : (
              <AlertCircle size={20} color={Colors.warning} />
            )}
            <Text style={styles.interactionText}>
              {interactionResult.safe
                ? 'No interactions detected'
                : `${interactionResult.interactions.length} interaction${interactionResult.interactions.length > 1 ? 's' : ''} found`}
            </Text>
          </TouchableOpacity>
        )}

        {medications.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No medications added yet</Text>
            <Text style={styles.emptySubtext}>
              Use the scan tab to add your first medication
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>Your Medications</Text>
              {takenMedsCount.total > 0 && (
                <View style={[
                  styles.takenMedsBadge,
                  takenMedsCount.taken === takenMedsCount.total && styles.takenMedsBadgeGreen,
                  takenMedsCount.taken > 0 && takenMedsCount.taken < takenMedsCount.total && styles.takenMedsBadgeYellow,
                  takenMedsCount.taken === 0 && styles.takenMedsBadgeRed,
                ]}>
                  <Text style={[
                    styles.takenMedsText,
                    takenMedsCount.taken === takenMedsCount.total && styles.takenMedsTextGreen,
                    takenMedsCount.taken > 0 && takenMedsCount.taken < takenMedsCount.total && styles.takenMedsTextYellow,
                    takenMedsCount.taken === 0 && styles.takenMedsTextRed,
                  ]}>
                    {takenMedsCount.taken}/{takenMedsCount.total}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.gridContainer}>
              {medications.map((item) => (
                <PremiumMedicationCard
                  key={item.id}
                  medication={item}
                  onPress={handleMedicationPress}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={showInteractions}
        animationType="slide"
        presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Interaction Check</Text>
            <TouchableOpacity onPress={() => setShowInteractions(false)}>
              <X size={28} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {interactionResult?.safe ? (
              <View style={styles.safeContainer}>
                <CheckCircle size={48} color="#34C759" />
                <Text style={styles.safeTitle}>All Clear</Text>
                <Text style={styles.safeText}>
                  No significant interactions detected between your medications.
                </Text>
              </View>
            ) : (
              <>
                {interactionResult?.interactions.map((interaction, index) => (
                  <View key={index} style={styles.interactionCard}>
                    <View style={[
                      styles.severityBadge,
                      styles[`severity_${interaction.severity}`],
                    ]}>
                      <Text style={styles.severityText}>
                        {interaction.severity.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.interactionDrugs}>
                      {interaction.drug1} + {interaction.drug2}
                    </Text>
                    <Text style={styles.interactionDesc}>
                      {interaction.description}
                    </Text>
                  </View>
                ))}

                {interactionResult?.warnings.map((warning: string, index: number) => (
                  <View key={index} style={styles.warningCard}>
                    <AlertCircle size={20} color="#FF9500" />
                    <Text style={styles.warningText}>{warning}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={!!selectedMedication}
        animationType="slide"
        presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Medication Details</Text>
            <TouchableOpacity onPress={() => setSelectedMedication(null)}>
              <X size={28} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedMedication && (
              <View>
                <Text style={styles.detailName}>{selectedMedication.name}</Text>
                {selectedMedication.generic_name && (
                  <Text style={styles.detailGeneric}>
                    {selectedMedication.generic_name}
                  </Text>
                )}

                {selectedMedication.dosage && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Dosage</Text>
                    <Text style={styles.detailValue}>{selectedMedication.dosage}</Text>
                  </View>
                )}

                {selectedMedication.frequency && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Frequency</Text>
                    <Text style={styles.detailValue}>{selectedMedication.frequency}</Text>
                  </View>
                )}

                {selectedMedication.description && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailValue}>
                      {selectedMedication.description}
                    </Text>
                  </View>
                )}

                {selectedMedication.recommended_dosage && (
                  <View style={[styles.detailSection, styles.recommendedDosageSection]}>
                    <Text style={styles.recommendedDosageTitle}>
                      {selectedMedication.is_prescription ? '💊 Prescription Guidance' : '💡 Recommended Dosage'}
                    </Text>

                    <View style={styles.recommendedDosageRow}>
                      <Text style={styles.recommendedDosageLabel}>Dosage:</Text>
                      <Text style={styles.recommendedDosageValue}>{selectedMedication.recommended_dosage}</Text>
                    </View>

                    {selectedMedication.recommended_frequency && (
                      <View style={styles.recommendedDosageRow}>
                        <Text style={styles.recommendedDosageLabel}>Frequency:</Text>
                        <Text style={styles.recommendedDosageValue}>{selectedMedication.recommended_frequency}</Text>
                      </View>
                    )}

                    {selectedMedication.dosage_notes && (
                      <View style={styles.recommendedDosageNotes}>
                        <Text style={styles.recommendedDosageNotesText}>{selectedMedication.dosage_notes}</Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.detailSection}>
                  <View style={styles.reminderHeader}>
                    <Text style={styles.detailLabel}>Reminder</Text>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => setEditingReminder(!editingReminder)}>
                      <Edit2 size={16} color="#007AFF" />
                      <Text style={styles.editButtonText}>
                        {editingReminder ? 'Cancel' : 'Edit'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {!editingReminder ? (
                    <Text style={styles.detailValue}>
                      {selectedMedication.reminder_time || 'No reminder set'}
                    </Text>
                  ) : (
                    <View>
                      <TouchableOpacity
                        style={styles.timeButton}
                        onPress={() => setShowTimePicker(true)}>
                        <Clock size={20} color="#666" />
                        <Text style={styles.timeButtonText}>
                          {newReminderTime
                            ? newReminderTime.toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Set Time'}
                        </Text>
                      </TouchableOpacity>

                      {/* Time Picker Modal */}
                      <Modal
                        visible={showTimePicker}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={() => setShowTimePicker(false)}>
                        <TouchableOpacity
                          style={styles.timePickerModalOverlay}
                          activeOpacity={1}
                          onPress={() => setShowTimePicker(false)}>
                          <View style={styles.timePickerModalContent}>
                            <View style={styles.timePickerHeader}>
                              <Text style={styles.timePickerTitle}>Select Time</Text>
                              <TouchableOpacity
                                onPress={() => setShowTimePicker(false)}
                                style={styles.timePickerCloseButton}>
                                <X size={20} color={Colors.text.primary} />
                              </TouchableOpacity>
                            </View>
                            <DateTimePicker
                              value={newReminderTime || new Date()}
                              mode="time"
                              is24Hour={false}
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={(event, selectedDate) => {
                                if (selectedDate) {
                                  if (Platform.OS === 'android') {
                                    setNewReminderTime(selectedDate);
                                    setShowTimePicker(false);
                                  } else {
                                    setNewReminderTime(selectedDate);
                                  }
                                }
                              }}
                            />
                            {Platform.OS === 'ios' && (
                              <View style={styles.timePickerActions}>
                                <TouchableOpacity
                                  style={styles.timePickerCancelButton}
                                  onPress={() => {
                                    setShowTimePicker(false);
                                    setNewReminderTime(null);
                                  }}>
                                  <Text style={styles.timePickerCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.timePickerConfirmButton}
                                  onPress={() => setShowTimePicker(false)}>
                                  <Text style={styles.timePickerConfirmText}>Done</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      </Modal>

                      <View style={styles.reminderActions}>
                        {newReminderTime && (
                          <TouchableOpacity
                            style={styles.clearReminderButton}
                            onPress={() => setNewReminderTime(null)}>
                            <Text style={styles.clearReminderText}>Clear Reminder</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.saveReminderButton}
                          onPress={updateReminder}>
                          <Text style={styles.saveReminderText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.deleteSection}>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => selectedMedication && deleteMedication(selectedMedication.id)}>
                    <Trash2 size={20} color={Colors.danger} />
                    <Text style={styles.deleteButtonText}>Delete Medication</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 64,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.background,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '400',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -1,
    lineHeight: 48,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
    paddingTop: Spacing.sm,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.base,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  takenMedsBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  takenMedsBadgeGreen: {
    backgroundColor: `${Colors.success}20`,
  },
  takenMedsBadgeYellow: {
    backgroundColor: `${Colors.warning}20`,
  },
  takenMedsBadgeRed: {
    backgroundColor: `${Colors.error}20`,
  },
  takenMedsText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  takenMedsTextGreen: {
    color: Colors.success,
  },
  takenMedsTextYellow: {
    color: Colors.warning,
  },
  takenMedsTextRed: {
    color: Colors.error,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.base,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  checkingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.badgeBackground,
    padding: Spacing.base,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
    marginBottom: Spacing.base,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  checkingText: {
    ...Typography.labelMedium,
    color: Colors.accent,
  },
  interactionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.base,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  safeBanner: {
    backgroundColor: `${Colors.success}15`,
  },
  warningBanner: {
    backgroundColor: `${Colors.warning}15`,
  },
  interactionText: {
    ...Typography.caption,
    fontWeight: '600',
    flex: 1,
    color: Colors.text.primary,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyText: {
    ...Typography.subheading,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptySubtext: {
    ...Typography.caption,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  list: {
    paddingBottom: Spacing.lg,
  },
  modal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: 60,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadows.soft,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.md,
  },
  safeContainer: {
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  safeTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  safeText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  interactionCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.soft,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  severity_low: {
    backgroundColor: `${Colors.success}20`,
  },
  severity_moderate: {
    backgroundColor: `${Colors.warning}20`,
  },
  severity_high: {
    backgroundColor: `${Colors.danger}30`,
  },
  severity_critical: {
    backgroundColor: `${Colors.danger}40`,
  },
  severityText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.text.primary,
    textTransform: 'uppercase' as const,
  },
  interactionDrugs: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  interactionDesc: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
    ...Shadows.soft,
  },
  warningText: {
    flex: 1,
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  detailName: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  detailGeneric: {
    ...Typography.bodyLarge,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  detailSection: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.soft,
  },
  detailLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  detailValue: {
    ...Typography.body,
    color: Colors.text.primary,
    lineHeight: 24,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  editButtonText: {
    color: Colors.primary,
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  timeButton: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeButtonText: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  reminderActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  clearReminderButton: {
    padding: Spacing.md,
  },
  clearReminderText: {
    color: Colors.danger,
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  saveReminderButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Shadows.soft,
  },
  saveReminderText: {
    color: Colors.card,
    ...Typography.button,
  },
  timePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerModalContent: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '90%',
    maxWidth: 400,
    ...Shadows.lg,
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
    paddingBottom: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  timePickerTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  timePickerCloseButton: {
    padding: Spacing.xs,
  },
  timePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.base,
    marginTop: Spacing.base,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  timePickerCancelButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  timePickerCancelText: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  timePickerConfirmButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  timePickerConfirmText: {
    ...Typography.body,
    color: Colors.textOnDark,
    fontWeight: '600',
  },
  recommendedDosageSection: {
    backgroundColor: `${Colors.primary}08`,
    borderWidth: 1,
    borderColor: `${Colors.primary}30`,
  },
  recommendedDosageTitle: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: Spacing.md,
  },
  recommendedDosageRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  recommendedDosageLabel: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text.secondary,
    width: 100,
  },
  recommendedDosageValue: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
  },
  recommendedDosageNotes: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: `${Colors.primary}20`,
  },
  recommendedDosageNotesText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  deleteSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.danger,
    backgroundColor: `${Colors.danger}08`,
  },
  deleteButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.danger,
  },
});
