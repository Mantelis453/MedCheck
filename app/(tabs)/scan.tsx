import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Camera, X, Check, Clock, Info } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { analyzeMedicationImage, getMedicationInfo } from '@/services/gemini';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { scheduleMedicationReminder } from '@/services/notifications';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/design';
import { MedicationCategory } from '@/types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ScanScreen() {
  const params = useLocalSearchParams<{ 
    medicationData?: string;
    fromChat?: string;
  }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraActive, setCameraActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [fetchingInfo, setFetchingInfo] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [medicationInfo, setMedicationInfo] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MedicationCategory>('otc');
  const cameraRef = useRef<any>(null);
  const { user } = useAuth();
  const router = useRouter();

  // Fetch medication info from Gemini API when medication name is available
  const fetchMedicationDetails = useCallback(async (medicationName: string) => {
    if (!medicationName || medicationName.trim() === '') return;
    
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key') {
      console.warn('Gemini API key not configured. Skipping medication info fetch.');
      return;
    }

    setFetchingInfo(true);
    try {
      const details = await getMedicationInfo(medicationName.trim(), apiKey);
      
      // Merge fetched details with existing medication info, only filling empty fields
      setMedicationInfo((prev: any) => {
        const updated = { ...prev };
        
        // Only update fields that are empty or missing
        if (details.generic_name && !updated.generic_name) {
          updated.generic_name = details.generic_name;
        }
        if (details.dosage && !updated.dosage) {
          updated.dosage = details.dosage;
        }
        if (details.frequency && !updated.frequency) {
          updated.frequency = details.frequency;
        }
        if (details.description && !updated.description) {
          updated.description = details.description;
        }
        
        // Update category if not already set
        if (details.category && !updated.category && !prev.category) {
          setSelectedCategory(details.category);
        } else if (details.is_prescription !== undefined && !prev.category) {
          setSelectedCategory(details.is_prescription ? 'prescription' : 'otc');
        }
        
        return updated;
      });
    } catch (error) {
      console.error('Failed to fetch medication details:', error);
      // Don't show error to user - they can still fill manually
    } finally {
      setFetchingInfo(false);
    }
  }, []);

  // Handle medication data passed from chat (check both URL params and AsyncStorage)
  useEffect(() => {
    const loadMedicationFromChat = async () => {
      // First, try to get from AsyncStorage (more reliable)
      try {
        const stored = await AsyncStorage.getItem('@pending_medication_from_chat');
        if (stored) {
          const medication = JSON.parse(stored);
          // Only use if it's recent (within last 30 seconds)
          if (medication.timestamp && Date.now() - medication.timestamp < 30000) {
            console.log('Loaded medication from AsyncStorage:', medication);
            
            // Remove the stored data
            await AsyncStorage.removeItem('@pending_medication_from_chat');
            
            // Ensure we have at least a name
            if (!medication.name) {
              console.error('Medication data missing name:', medication);
              return;
            }
            
            // Remove internal fields
            const { fromChat, timestamp, ...medicationData } = medication;
            setMedicationInfo(medicationData);
            
            // Set category
            if (medicationData.category) {
              setSelectedCategory(medicationData.category);
            } else if (medicationData.is_prescription) {
              setSelectedCategory('prescription');
            } else {
              setSelectedCategory('otc');
            }
            
            // Fetch additional details from Gemini if we have a medication name
            if (medicationData.name) {
              fetchMedicationDetails(medicationData.name);
            }
            return;
          }
        }
      } catch (error) {
        console.error('Failed to load from AsyncStorage:', error);
      }
      
      // Fallback: Try URL params
      console.log('Scan screen params:', params);
      const medicationDataParam = Array.isArray(params.medicationData) 
        ? params.medicationData[0] 
        : params.medicationData;
      const fromChatParam = Array.isArray(params.fromChat) 
        ? params.fromChat[0] 
        : params.fromChat;
      
      if (medicationDataParam && fromChatParam === 'true') {
        try {
          const decodedData = decodeURIComponent(medicationDataParam);
          const medication = JSON.parse(decodedData);
          
          console.log('Parsed medication from URL params:', medication);
          
          if (!medication.name) {
            console.error('Medication data missing name:', medication);
            return;
          }
          
          setMedicationInfo(medication);
          
          if (medication.category) {
            setSelectedCategory(medication.category);
          } else if (medication.is_prescription) {
            setSelectedCategory('prescription');
          } else {
            setSelectedCategory('otc');
          }
          
          if (medication.name) {
            fetchMedicationDetails(medication.name);
          }
        } catch (error) {
          console.error('Failed to parse medication data from URL:', error);
        }
      }
    };
    
    loadMedicationFromChat();
  }, [params.medicationData, params.fromChat, fetchMedicationDetails]);

  // Fetch medication details when medication info is set from scan (not from chat, as chat already triggers fetch)
  useEffect(() => {
    if (medicationInfo?.name && !params.fromChat && !fetchingInfo) {
      // Only fetch if we don't already have complete info
      const needsInfo = !medicationInfo.generic_name || 
                       !medicationInfo.dosage || 
                       !medicationInfo.frequency || 
                       !medicationInfo.description;
      
      if (needsInfo) {
        fetchMedicationDetails(medicationInfo.name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicationInfo?.name, params.fromChat]);

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to scan medications');
        return;
      }
    }
    setCameraActive(true);
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });
      setCapturedImage(photo.uri);
      setCameraActive(false);

      if (photo.base64) {
        await analyzeMedication(photo.base64);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture image');
    }
  };

  const analyzeMedication = async (base64Image: string) => {
    setAnalyzing(true);
    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey || apiKey === 'your-gemini-api-key') {
        throw new Error('Gemini API key not configured. Please add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.');
      }

      // Use direct Gemini API call
      const info = await analyzeMedicationImage(base64Image, apiKey);
      
      console.log('Analyzed medication info:', info);
      setMedicationInfo(info);
      
      // Auto-set category if AI classified it
      if (info.category) {
        setSelectedCategory(info.category);
      } else if (info.is_prescription) {
        setSelectedCategory('prescription');
      } else {
        setSelectedCategory('otc');
      }
      
      // Fetch additional details if name is available but other fields are missing
      // This will be handled by the useEffect hook below
    } catch (error: any) {
      console.error('Analyze medication error:', error);
      Alert.alert('Error', error.message || 'Failed to analyze medication');
      setCapturedImage(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const saveMedication = async () => {
    if (!user || !medicationInfo) {
      console.log('Missing user or medication info:', { user: !!user, medicationInfo: !!medicationInfo });
      return;
    }

    if (!medicationInfo.name || medicationInfo.name.trim() === '') {
      Alert.alert('Error', 'Medication name is required');
      return;
    }

    setSaving(true);
    try {
      const medicationData: any = {
        user_id: user.id,
        name: medicationInfo.name.trim(),
        generic_name: medicationInfo.generic_name?.trim() || null,
        dosage: medicationInfo.dosage?.trim() || null,
        frequency: medicationInfo.frequency?.trim() || null,
        description: medicationInfo.description?.trim() || null,
        reminder_time: reminderTime ? reminderTime.toTimeString().slice(0, 5) : null,
        category: selectedCategory,
        active: true,
        is_prescription: selectedCategory === 'prescription',
      };

      // Only include optional fields if they exist
      if (medicationInfo.recommended_dosage) {
        medicationData.recommended_dosage = medicationInfo.recommended_dosage;
      }
      if (medicationInfo.recommended_frequency) {
        medicationData.recommended_frequency = medicationInfo.recommended_frequency;
      }
      if (medicationInfo.dosage_notes) {
        medicationData.dosage_notes = medicationInfo.dosage_notes;
      }

      const { data, error } = await supabase
        .from('medications')
        .insert(medicationData)
        .select();

      if (error) {
        console.error('Supabase insert error:', JSON.stringify(error, null, 2));
        
        // Provide specific error messages
        if (error.code === '23505') {
          throw new Error('This medication already exists in your list.');
        } else if (error.code === '23503') {
          throw new Error('Invalid user reference. Please try logging out and back in.');
        } else if (error.code === '42501') {
          throw new Error('Permission denied. Please check your account permissions.');
        } else if (error.message) {
          throw new Error(error.message);
        } else {
          throw error;
        }
      }

      if (!data || data.length === 0) {
        throw new Error('Failed to save medication - no data returned');
      }

      console.log('Medication saved successfully:', data);

      // Schedule reminder if time is set
      if (reminderTime && data[0]) {
        try {
          const timeString = reminderTime.toTimeString().slice(0, 5);
          await scheduleMedicationReminder(
            medicationInfo.name || 'Medication',
            timeString,
            data[0].id
          );
        } catch (reminderError) {
          console.warn('Failed to schedule reminder:', reminderError);
          // Don't fail the whole operation if reminder fails
        }
      }

      // Clear AsyncStorage if medication was from chat
      try {
        await AsyncStorage.removeItem('@pending_medication_from_chat');
      } catch (error) {
        console.warn('Failed to clear AsyncStorage:', error);
      }
      
      // Reset state and close modal first
      setCapturedImage(null);
      setMedicationInfo(null);
      setReminderTime(null);
      setSelectedCategory('otc');
      
      // Navigate immediately after resetting (modal will close)
      // Use a small delay to ensure state updates complete
      setTimeout(() => {
        router.replace('/(tabs)/index' as any);
      }, 50);
      
      // Show success alert
      Alert.alert('Success', 'Medication added successfully');
    } catch (error: any) {
      console.error('Save medication error:', error);
      const errorMessage = error?.message || 'Failed to save medication. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setCapturedImage(null);
    setMedicationInfo(null);
    setReminderTime(null);
    setSelectedCategory('otc');
    // Clear URL params if coming from chat
    if (params.fromChat) {
      router.replace('/(tabs)/scan');
    }
  };

  if (cameraActive && Platform.OS !== 'web') {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
        />
        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setCameraActive(false)}>
            <X size={32} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (analyzing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Analyzing medication...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!cameraActive && !analyzing && (
        <>
          <Text style={styles.title}>Scan Medication</Text>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Camera size={80} color={Colors.primary} strokeWidth={2} />
            </View>
            <Text style={styles.description}>
              Take a photo of your medication label to automatically extract information
            </Text>
            <TouchableOpacity style={styles.scanButton} onPress={openCamera}>
              <Camera size={24} color={Colors.card} strokeWidth={2.5} />
              <Text style={styles.scanButtonText}>Open Camera</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Medication Review Modal */}
      <Modal
        visible={!!medicationInfo}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={reset}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Review Medication</Text>
            <TouchableOpacity onPress={reset}>
              <X size={28} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.scanBanner}>
            <Text style={styles.scanBannerText}>
              📷 Medication scanned - Please review and confirm details
            </Text>
          </View>

          {capturedImage && (
            <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          )}

          {fetchingInfo && (
            <View style={styles.infoBanner}>
              <Info size={20} color={Colors.primary} />
              <Text style={styles.infoBannerText}>Fetching medication information...</Text>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          )}

          {medicationInfo && (
            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={[styles.input, !medicationInfo.name?.trim() && styles.inputRequired]}
              value={medicationInfo.name || ''}
              onChangeText={(text) =>
                setMedicationInfo({ ...medicationInfo, name: text })
              }
              placeholder="Medication name"
              placeholderTextColor={Colors.text.secondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Generic Name (Optional)</Text>
            <TextInput
              style={styles.input}
              value={medicationInfo.generic_name || ''}
              onChangeText={(text) =>
                setMedicationInfo({ ...medicationInfo, generic_name: text })
              }
              placeholder="Generic drug name"
              placeholderTextColor={Colors.text.secondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Dosage (Optional)</Text>
            <TextInput
              style={styles.input}
              value={medicationInfo.dosage || ''}
              onChangeText={(text) =>
                setMedicationInfo({ ...medicationInfo, dosage: text })
              }
              placeholder="e.g., 500mg, 1 tablet"
              placeholderTextColor={Colors.text.secondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Frequency (Optional)</Text>
            <TextInput
              style={styles.input}
              value={medicationInfo.frequency || ''}
              onChangeText={(text) =>
                setMedicationInfo({ ...medicationInfo, frequency: text })
              }
              placeholder="e.g., twice daily, once a week"
              placeholderTextColor={Colors.text.secondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={medicationInfo.description || ''}
              onChangeText={(text) =>
                setMedicationInfo({ ...medicationInfo, description: text })
              }
              placeholder="What is this medication used for?"
              placeholderTextColor={Colors.text.secondary}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryButtons}>
              <TouchableOpacity
                style={[
                  styles.categoryButton,
                  selectedCategory === 'otc' && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory('otc')}>
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === 'otc' && styles.categoryButtonTextActive,
                  ]}>
                  OTC
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.categoryButton,
                  selectedCategory === 'prescription' && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory('prescription')}>
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === 'prescription' && styles.categoryButtonTextActive,
                  ]}>
                  Prescription
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.categoryButton,
                  selectedCategory === 'supplement' && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory('supplement')}>
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === 'supplement' && styles.categoryButtonTextActive,
                  ]}>
                  Supplement
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {medicationInfo.recommended_dosage && (
            <View style={styles.recommendedDosageCard}>
              <View style={styles.recommendedHeader}>
                <Text style={styles.recommendedTitle}>
                  {medicationInfo.is_prescription ? '💊 Prescription Guidance' : '💡 Recommended Dosage'}
                </Text>
              </View>

              <View style={styles.recommendedRow}>
                <Text style={styles.recommendedLabel}>Dosage:</Text>
                <Text style={styles.recommendedValue}>{medicationInfo.recommended_dosage}</Text>
              </View>

              {medicationInfo.recommended_frequency && (
                <View style={styles.recommendedRow}>
                  <Text style={styles.recommendedLabel}>Frequency:</Text>
                  <Text style={styles.recommendedValue}>{medicationInfo.recommended_frequency}</Text>
                </View>
              )}

              {medicationInfo.dosage_notes && (
                <View style={styles.recommendedNotes}>
                  <Text style={styles.recommendedNotesText}>{medicationInfo.dosage_notes}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Reminder Time (Optional)</Text>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setShowTimePicker(true)}>
              <Clock size={20} color="#666" />
              <Text style={styles.timeButtonText}>
                {reminderTime
                  ? reminderTime.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Set Reminder Time'}
              </Text>
            </TouchableOpacity>
            {reminderTime && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setReminderTime(null)}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {showTimePicker && Platform.OS !== 'web' && (
            <DateTimePicker
              value={reminderTime || new Date()}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={(event, selectedDate) => {
                setShowTimePicker(false);
                if (selectedDate) {
                  setReminderTime(selectedDate);
                }
              }}
            />
          )}

          {showTimePicker && Platform.OS === 'web' && (
            <View style={styles.webTimePicker}>
              <TextInput
                style={styles.input}
                placeholder="HH:MM (24-hour format)"
                value={reminderTime ? reminderTime.toTimeString().slice(0, 5) : ''}
                onChangeText={(text) => {
                  const [hours, minutes] = text.split(':');
                  if (hours && minutes) {
                    const date = new Date();
                    date.setHours(parseInt(hours), parseInt(minutes));
                    setReminderTime(date);
                  }
                }}
                onBlur={() => setShowTimePicker(false)}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={saveMedication}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Check size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Medication</Text>
              </>
            )}
          </TouchableOpacity>
              </View>
            </ScrollView>
          )}
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
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  modalContainer: {
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
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  modalScrollContent: {
    paddingBottom: Spacing.xxl,
  },
  scanBanner: {
    backgroundColor: `${Colors.primary}15`,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  scanBannerText: {
    ...Typography.bodySmall,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  chatBanner: {
    backgroundColor: `${Colors.primary}15`,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  chatBannerText: {
    ...Typography.bodySmall,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  infoBanner: {
    backgroundColor: `${Colors.primary}10`,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoBannerText: {
    ...Typography.bodySmall,
    color: Colors.text.primary,
    flex: 1,
  },
  title: {
    ...Typography.h1,
    color: Colors.text.primary,
    padding: Spacing.lg,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: 60,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: BorderRadius.xl,
    backgroundColor: `${Colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.soft,
  },
  description: {
    ...Typography.body,
    textAlign: 'center',
    color: Colors.text.secondary,
    marginBottom: Spacing.xl,
    lineHeight: 24,
    maxWidth: 280,
  },
  scanButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadows.md,
  },
  scanButtonText: {
    color: Colors.card,
    ...Typography.body,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 32,
  },
  cancelButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    ...Typography.body,
    color: Colors.text.secondary,
  },
  preview: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  form: {
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },
  field: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    ...Typography.body,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 48,
  },
  inputRequired: {
    borderColor: Colors.error,
    borderWidth: 1.5,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  timeButton: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeButtonText: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  clearButton: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  clearButtonText: {
    color: Colors.danger,
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  webTimePicker: {
    marginTop: Spacing.sm,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    ...Shadows.md,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: Colors.card,
    ...Typography.button,
  },
  recommendedDosageCard: {
    backgroundColor: `${Colors.primary}08`,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: `${Colors.primary}30`,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  recommendedHeader: {
    marginBottom: Spacing.sm,
  },
  recommendedTitle: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.primary,
  },
  recommendedRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  recommendedLabel: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text.secondary,
    width: 100,
  },
  recommendedValue: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
  },
  recommendedNotes: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: `${Colors.primary}20`,
  },
  recommendedNotesText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  categoryButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  categoryButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  categoryButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  categoryButtonText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryButtonTextActive: {
    color: Colors.textOnDark,
  },
});
