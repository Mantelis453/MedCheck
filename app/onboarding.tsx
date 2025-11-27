import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  AccessibilityInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/design';
import { ChevronRight, Check, Info } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import { COMMON_ALLERGIES } from '@/constants/medical';

interface OnboardingData {
  name: string;
  dateOfBirth: string;
  sex: 'male' | 'female' | 'other';
  heightCm: number | null;
  weightKg: number | null;
  lifestyle?: {
    smoking: boolean;
    alcoholUse: 'none' | 'occasional' | 'regular';
  };
  allergies: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
    email?: string;
  };
  biometricData?: {
    bloodType?: string;
    rhFactor?: string;
  };
  medicationHistory?: string[];
  familyMedicalHistory?: string[];
}

type FormStep = 'basic' | 'physical' | 'lifestyle' | 'allergies' | 'emergency' | 'biometric' | 'medication' | 'family' | 'review';

interface ValidationErrors {
  name?: string;
  dateOfBirth?: string;
  sex?: string;
  heightCm?: string;
  weightKg?: string;
  emergencyPhone?: string;
  emergencyEmail?: string;
}

const DRAFT_STORAGE_KEY = '@onboarding_draft';
const DEBOUNCE_DELAY = 300;

export default function OnboardingScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<FormStep>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [retryCount, setRetryCount] = useState(0);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formData, setFormData] = useState<OnboardingData>({
    name: '',
    dateOfBirth: '',
    sex: 'male',
    heightCm: null,
    weightKg: null,
    allergies: [],
  });
  
  // Slider values - initialize with default values
  const [heightValue, setHeightValue] = useState<number>(175); // Default 175 cm
  const [weightValue, setWeightValue] = useState<number>(70); // Default 70 kg
  
  // Raw text values for medication and family history to allow free-form typing
  const [medicationHistoryText, setMedicationHistoryText] = useState<string>('');
  const [familyMedicalHistoryText, setFamilyMedicalHistoryText] = useState<string>('');

  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [showAllergiesSelect, setShowAllergiesSelect] = useState(false);

  // Load draft on mount
  useEffect(() => {
    loadDraft();
  }, []);

  // Note: We don't sync heightText/weightText from formData via useEffect
  // because that would overwrite user input. We only set them when loading drafts.

  // Save draft when form data changes
  useEffect(() => {
    if (hasUnsavedChanges) {
      saveDraft();
    }
  }, [formData, currentStep]);

  // Announce step changes for accessibility
  useEffect(() => {
    const stepNames: Record<FormStep, string> = {
      basic: 'Basic Information',
      physical: 'Physical Information',
      lifestyle: 'Lifestyle Factors',
      allergies: 'Allergies',
      emergency: 'Emergency Contact',
      biometric: 'Biometric Data',
      medication: 'Medication History',
      family: 'Family Medical History',
      review: 'Review',
    };
    AccessibilityInfo.announceForAccessibility(`Step ${getCurrentStepIndex() + 1}: ${stepNames[currentStep]}`);
  }, [currentStep]);

  const loadDraft = async () => {
    try {
      const draft = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        setFormData(parsed.data);
        // Sync slider values when loading draft
        if (parsed.data.heightCm !== null && parsed.data.heightCm !== undefined) {
          setHeightValue(parsed.data.heightCm);
          setFormData((prev) => ({ ...prev, heightCm: parsed.data.heightCm }));
        }
        if (parsed.data.weightKg !== null && parsed.data.weightKg !== undefined) {
          setWeightValue(parsed.data.weightKg);
          setFormData((prev) => ({ ...prev, weightKg: parsed.data.weightKg }));
        }
        // Sync text values for medication and family history
        if (parsed.data.medicationHistory && parsed.data.medicationHistory.length > 0) {
          setMedicationHistoryText(parsed.data.medicationHistory.join('\n'));
          setFormData((prev) => ({ ...prev, medicationHistory: parsed.data.medicationHistory }));
        }
        if (parsed.data.familyMedicalHistory && parsed.data.familyMedicalHistory.length > 0) {
          setFamilyMedicalHistoryText(parsed.data.familyMedicalHistory.join('\n'));
          setFormData((prev) => ({ ...prev, familyMedicalHistory: parsed.data.familyMedicalHistory }));
        }
        if (parsed.step) {
          setCurrentStep(parsed.step);
        }
        setHasUnsavedChanges(true);
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  };

  const saveDraft = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(async () => {
      try {
        setIsDraftSaving(true);
        await AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          data: formData,
          step: currentStep,
          timestamp: new Date().toISOString(),
        }));
        setIsDraftSaving(false);
      } catch (error) {
        console.error('Error saving draft:', error);
        setIsDraftSaving(false);
      }
    }, DEBOUNCE_DELAY);
  }, [formData, currentStep]);

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  };

  const getCurrentStepIndex = (): number => {
    const steps: FormStep[] = ['basic', 'physical', 'lifestyle', 'allergies', 'emergency', 'biometric', 'medication', 'family', 'review'];
    return steps.indexOf(currentStep);
  };

  const getProgressPercentage = (): number => {
    const totalSteps = 9;
    return Math.round(((getCurrentStepIndex() + 1) / totalSteps) * 100);
  };

  const updateFormData = (updates: Partial<OnboardingData>) => {
    setFormData((prev) => {
      const newData = { ...prev, ...updates };
      setHasUnsavedChanges(true);
      // Clear validation errors for updated fields
      const clearedErrors = { ...validationErrors };
      Object.keys(updates).forEach((key) => {
        delete clearedErrors[key as keyof ValidationErrors];
      });
      setValidationErrors(clearedErrors);
      return newData;
    });
  };

  // Real-time validation
  const validateField = useCallback((field: string, value: any): string | undefined => {
    switch (field) {
      case 'name':
        if (!value || !value.trim()) {
          return 'Name is required';
        }
        if (value.trim().length < 2) {
          return 'Name must be at least 2 characters';
        }
        if (value.trim().length > 100) {
          return 'Name must be less than 100 characters';
        }
        return undefined;

      case 'dateOfBirth':
        if (!value) {
          return 'Date of birth is required';
        }
        const birthDate = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        if (birthDate > today) {
          return 'Date of birth cannot be in the future';
        }
        if (age > 150) {
          return 'Please enter a valid date of birth';
        }
        if (age < 0) {
          return 'Date of birth cannot be in the future';
        }
        return undefined;
      
      case 'heightCm':
        if (value !== null && value !== undefined) {
          if (value < 30 || value > 260) {
            return 'Height must be between 30-260 cm';
          }
        }
        return undefined;
      
      case 'weightKg':
        if (value !== null && value !== undefined) {
          if (value < 2 || value > 200) {
            return 'Weight must be between 2-200 kg';
          }
        }
        return undefined;
      
      case 'emergencyPhone':
        if (value && value.trim()) {
          const phoneRegex = /^[\d\s\-\+\(\)]+$/;
          if (!phoneRegex.test(value)) {
            return 'Please enter a valid phone number';
          }
          if (value.replace(/\D/g, '').length < 10) {
            return 'Phone number must be at least 10 digits';
          }
        }
        return undefined;
      
      case 'emergencyEmail':
        if (value && value.trim()) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return 'Please enter a valid email address';
          }
        }
        return undefined;
      
      default:
        return undefined;
    }
  }, []);

  const handleFieldChange = (field: string, value: any) => {
    // Update form data
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      setHasUnsavedChanges(true);
      // Clear validation errors for updated field
      setValidationErrors((prevErrors) => {
        const clearedErrors = { ...prevErrors };
        delete clearedErrors[field as keyof ValidationErrors];
        return clearedErrors;
      });
      return newData;
    });
    
    // Real-time validation with debouncing
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      const error = validateField(field, value);
      setValidationErrors((prev) => ({
        ...prev,
        [field]: error,
      }));
    }, DEBOUNCE_DELAY);
  };

  const validateStep = (step: FormStep): boolean => {
    const errors: ValidationErrors = {};
    
    switch (step) {
      case 'basic':
        const nameError = validateField('name', formData.name);
        const dobError = validateField('dateOfBirth', formData.dateOfBirth);
        if (nameError) errors.name = nameError;
        if (dobError) errors.dateOfBirth = dobError;
        if (!formData.sex) {
          errors.sex = 'Please select your sex.';
        }
        break;
      case 'physical':
        // Height is required
        if (formData.heightCm === null || formData.heightCm === undefined) {
          errors.heightCm = 'Height is required';
        } else {
          const heightError = validateField('heightCm', formData.heightCm);
          if (heightError) errors.heightCm = heightError;
        }
        // Weight is required
        if (formData.weightKg === null || formData.weightKg === undefined) {
          errors.weightKg = 'Weight is required';
        } else {
          const weightError = validateField('weightKg', formData.weightKg);
          if (weightError) errors.weightKg = weightError;
        }
        break;
      case 'emergency':
        if (formData.emergencyContact?.phone) {
          const phoneError = validateField('emergencyPhone', formData.emergencyContact.phone);
          if (phoneError) errors.emergencyPhone = phoneError;
        }
        if (formData.emergencyContact?.email) {
          const emailError = validateField('emergencyEmail', formData.emergencyContact.email);
          if (emailError) errors.emergencyEmail = emailError;
        }
        break;
      case 'lifestyle':
      case 'allergies':
      case 'biometric':
      case 'medication':
      case 'family':
        return true; // All optional
      default:
        return true;
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      const firstError = Object.values(errors)[0];
      Alert.alert('Validation Error', firstError);
      return false;
    }
    
    setValidationErrors({});
    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;

    const stepOrder: FormStep[] = ['basic', 'physical', 'lifestyle', 'allergies', 'emergency', 'biometric', 'medication', 'family', 'review'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const stepOrder: FormStep[] = ['basic', 'physical', 'lifestyle', 'allergies', 'emergency', 'biometric', 'medication', 'family', 'review'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };


  const handleDateSelect = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setTempDate(selectedDate);
      if (Platform.OS === 'android') {
        updateFormData({ dateOfBirth: selectedDate.toISOString().split('T')[0] });
      }
    }
  };

  const confirmDateSelection = () => {
    setShowDatePicker(false);
    const selectedDate = tempDate.toISOString().split('T')[0];
    updateFormData({ dateOfBirth: selectedDate });
    
    // Show confirmation feedback
    const age = new Date().getFullYear() - tempDate.getFullYear();
    Alert.alert(
      'Date Confirmed',
      `Selected: ${tempDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}\n\nAge: ${age} years`,
      [{ text: 'OK' }]
    );
  };

  const cancelDateSelection = () => {
    setShowDatePicker(false);
    // Reset to previous date if available, otherwise keep current
    if (formData.dateOfBirth) {
      setTempDate(new Date(formData.dateOfBirth));
    }
  };

  const handleSave = async (retryAttempt = 0): Promise<void> => {
    if (!user) return;

    setIsSaving(true);
    setRetryCount(retryAttempt);

    try {
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const profileData: any = {
        full_name: formData.name,
        date_of_birth: formData.dateOfBirth,
        gender: formData.sex,
        allergies: formData.allergies || [],
        medical_conditions: [], // Keep for compatibility
        onboarding_completed: true,
      };

      // Add optional numeric fields only if they have values
      if (formData.heightCm !== null && formData.heightCm !== undefined) {
        profileData.height = formData.heightCm;
      }
      if (formData.weightKg !== null && formData.weightKg !== undefined) {
        profileData.weight = formData.weightKg;
      }

      // Add JSONB fields only if they have actual data (not empty objects)
      if (formData.lifestyle && Object.keys(formData.lifestyle).length > 0) {
        profileData.lifestyle = formData.lifestyle;
      }
      if (formData.emergencyContact && Object.keys(formData.emergencyContact).length > 0) {
        profileData.emergency_contact = formData.emergencyContact;
      }
      if (formData.biometricData && Object.keys(formData.biometricData).length > 0) {
        profileData.biometric_data = formData.biometricData;
      }

      // Add array fields only if they have values
      if (formData.medicationHistory && formData.medicationHistory.length > 0) {
        profileData.medication_history = formData.medicationHistory;
      }
      if (formData.familyMedicalHistory && formData.familyMedicalHistory.length > 0) {
        profileData.family_medical_history = formData.familyMedicalHistory;
      }

      let error;
      let result;

      if (existingProfile) {
        result = await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('user_id', user.id);
        error = result.error;
      } else {
        result = await supabase.from('user_profiles').insert({
          user_id: user.id,
          ...profileData,
        });
        error = result.error;
      }

      if (error) {
        // Check for table not found error
        if (error.code === 'PGRST205') {
          setIsSaving(false);
          Alert.alert(
            'Database Setup Required',
            'The database table is not available. Please run the migration file:\n\nsupabase/migrations/20251127000000_add_onboarding_enhancements.sql\n\nIn your Supabase dashboard:\n1. Go to SQL Editor\n2. Copy and paste the migration file contents\n3. Run the query\n\nOr use Supabase CLI: supabase db push',
            [
              {
                text: 'OK',
                onPress: () => setIsSaving(false),
              },
            ]
          );
          return;
        }

        // Retry logic for other errors
        if (retryAttempt < 2) {
          setIsSaving(false);
          Alert.alert(
            'Save Failed',
            `Failed to save: ${error.message}. Retrying...`,
            [
              {
                text: 'Retry',
                onPress: () => handleSave(retryAttempt + 1),
              },
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => setIsSaving(false),
              },
            ]
          );
          return;
        }
        throw error;
      }

      // Clear draft on successful save
      await clearDraft();
      setHasUnsavedChanges(false);
        router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Onboarding error:', error);
      
      // More specific error messages
      let errorMessage = 'Failed to save your profile. Please try again.';
      if (error?.code === 'PGRST205') {
        errorMessage = 'Database table not found. Please ensure migrations have been run. If this persists, contact support.';
      } else if (error?.code === '23505') {
        errorMessage = 'A profile already exists for this account.';
      } else if (error?.code === '23503') {
        errorMessage = 'Invalid user reference. Please try logging out and back in.';
      } else if (error?.code === '42501') {
        errorMessage = 'Permission denied. Please check your account permissions.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      setIsSaving(false);
      
      Alert.alert('Error', errorMessage, [
        {
          text: 'Retry',
          onPress: () => handleSave(retryAttempt + 1),
        },
        {
          text: 'OK',
          style: 'cancel',
        },
      ]);
    }
  };

  const renderStepIndicator = () => {
    const steps: FormStep[] = ['basic', 'physical', 'lifestyle', 'allergies', 'emergency', 'biometric', 'medication', 'family', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    const progress = getProgressPercentage();

    return (
      <View style={styles.stepIndicatorContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.progressTextContainer}>
          <Text style={styles.progressText}>{progress}% Complete</Text>
          {isDraftSaving && (
            <View style={styles.draftSavingIndicator}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.draftSavingText}>Saving draft...</Text>
            </View>
          )}
        </View>
        <View style={styles.stepIndicator}>
          {steps.map((step, index) => (
            <View key={step} style={styles.stepIndicatorItem}>
      <View
        style={[
                  styles.stepDot,
                  index <= currentIndex && styles.stepDotActive,
                ]}
              />
              {index < steps.length - 1 && (
                <View
                  style={[
                    styles.stepLine,
                    index < currentIndex && styles.stepLineActive,
                  ]}
                />
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderBasicInfo = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Basic Information</Text>
      <Text style={styles.stepDescription}>
        Let's start with some basic details about you.
      </Text>

      <View style={styles.formGroup}>
        <View style={styles.labelContainer}>
          <Text style={styles.label}>Full Name *</Text>
          <TouchableOpacity
            accessible={true}
            accessibilityLabel="Name help"
            accessibilityHint="Enter your full legal name. Must be between 2 and 100 characters."
            style={styles.infoButton}>
            <Info size={16} color={Colors.text.secondary} />
          </TouchableOpacity>
          </View>
        <TextInput
          style={[styles.input, validationErrors.name && styles.inputError]}
          placeholder="Enter your full name"
          placeholderTextColor={Colors.text.secondary}
          value={formData.name}
          onChangeText={(text) => handleFieldChange('name', text)}
          autoCapitalize="words"
          maxLength={100}
          accessible={true}
          accessibilityLabel="Full name input"
          accessibilityHint="Enter your full legal name"
        />
        <View style={styles.inputFooter}>
          {validationErrors.name ? (
            <Text style={styles.errorText} accessible={true} accessibilityRole="alert">
              {validationErrors.name}
            </Text>
          ) : (
            <Text style={styles.hint}>
              {formData.name.length}/100 characters
            </Text>
          )}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Date of Birth *</Text>
        <TouchableOpacity
          style={[styles.dateInput, formData.dateOfBirth && styles.dateInputFilled]}
          onPress={() => {
            if (formData.dateOfBirth) {
              setTempDate(new Date(formData.dateOfBirth));
            }
            setShowDatePicker(true);
          }}
          accessible={true}
          accessibilityLabel="Date of birth selector"
          accessibilityHint="Tap to select your date of birth">
          <View style={styles.dateInputContent}>
            {formData.dateOfBirth ? (
              <View style={styles.dateDisplayContainer}>
                <Text style={styles.dateInputText}>
                  {new Date(formData.dateOfBirth).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={styles.dateInputAge}>
                  Age: {new Date().getFullYear() - new Date(formData.dateOfBirth).getFullYear()} years
                </Text>
              </View>
            ) : (
              <Text style={styles.dateInputPlaceholder}>Tap to select your date of birth</Text>
            )}
          </View>
          <ChevronRight size={24} color={formData.dateOfBirth ? Colors.primary : Colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Sex *</Text>
        <View style={styles.optionsRow}>
          {(['male', 'female', 'other'] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionChip,
                formData.sex === option && styles.optionChipActive,
              ]}
              onPress={() => updateFormData({ sex: option })}>
              <Text
                style={[
                  styles.optionChipText,
                  formData.sex === option && styles.optionChipTextActive,
                ]}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {showDatePicker && Platform.OS === 'web' && (
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Date of Birth</Text>
          </View>
          <TextInput
            style={styles.webDateInput}
            type="date"
            value={formData.dateOfBirth || ''}
            onChange={(e: any) => {
              const value = e.target?.value || e.nativeEvent?.text;
              if (value) {
                updateFormData({ dateOfBirth: value });
              }
            }}
            max={new Date().toISOString().split('T')[0]}
          />
          <View style={styles.pickerActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.confirmButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showDatePicker && Platform.OS === 'ios' && (
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Date of Birth</Text>
            <Text style={styles.pickerSubtitle}>
              {tempDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </View>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            onChange={handleDateSelect}
            style={styles.datePicker}
          />
          <View style={styles.pickerActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelDateSelection}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={confirmDateSelection}>
              <Text style={styles.confirmButtonText}>Confirm</Text>
          </TouchableOpacity>
          </View>
        </View>
      )}

      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handleDateSelect}
        />
      )}
        </View>
  );

  const renderPhysicalInfo = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Physical Information</Text>
      <Text style={styles.stepDescription}>
        Help us provide accurate medication recommendations.
      </Text>

      <View style={styles.formGroup}>
        <View style={styles.sliderLabelContainer}>
          <Text style={styles.label}>Height (cm) *</Text>
          <Text style={styles.sliderValue}>{Math.round(heightValue)} cm</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={30}
          maximumValue={260}
          step={1}
          value={heightValue}
          onValueChange={(value) => {
            const roundedValue = Math.round(value);
            setHeightValue(roundedValue);
            setFormData((prev) => ({ ...prev, heightCm: roundedValue }));
            setHasUnsavedChanges(true);
            // Clear error when user adjusts slider
            setValidationErrors((prev) => {
              const cleared = { ...prev };
              delete cleared.heightCm;
              return cleared;
            });
            // Validate after debounce
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
              const error = validateField('heightCm', roundedValue);
              if (error) {
                setValidationErrors((prev) => ({
                  ...prev,
                  heightCm: error,
                }));
              }
            }, DEBOUNCE_DELAY);
          }}
          minimumTrackTintColor={Colors.primary}
          maximumTrackTintColor={Colors.border}
          thumbTintColor={Colors.primary}
          accessible={true}
          accessibilityLabel="Height in centimeters"
        />
        <View style={styles.sliderRange}>
          <Text style={styles.sliderRangeText}>30 cm</Text>
          <Text style={styles.sliderRangeText}>260 cm</Text>
        </View>
        <View style={styles.inputFooter}>
          {validationErrors.heightCm ? (
            <Text style={styles.errorText} accessible={true} accessibilityRole="alert">
              {validationErrors.heightCm}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.formGroup}>
        <View style={styles.sliderLabelContainer}>
          <Text style={styles.label}>Weight (kg) *</Text>
          <Text style={styles.sliderValue}>{Math.round(weightValue)} kg</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={2}
          maximumValue={200}
          step={1}
          value={weightValue}
          onValueChange={(value) => {
            const roundedValue = Math.round(value);
            setWeightValue(roundedValue);
            setFormData((prev) => ({ ...prev, weightKg: roundedValue }));
            setHasUnsavedChanges(true);
            // Clear error when user adjusts slider
            setValidationErrors((prev) => {
              const cleared = { ...prev };
              delete cleared.weightKg;
              return cleared;
            });
            // Validate after debounce
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
              const error = validateField('weightKg', roundedValue);
              if (error) {
                setValidationErrors((prev) => ({
                  ...prev,
                  weightKg: error,
                }));
              }
            }, DEBOUNCE_DELAY);
          }}
          minimumTrackTintColor={Colors.primary}
          maximumTrackTintColor={Colors.border}
          thumbTintColor={Colors.primary}
          accessible={true}
          accessibilityLabel="Weight in kilograms"
        />
        <View style={styles.sliderRange}>
          <Text style={styles.sliderRangeText}>2 kg</Text>
          <Text style={styles.sliderRangeText}>200 kg</Text>
        </View>
        <View style={styles.inputFooter}>
          {validationErrors.weightKg ? (
            <Text style={styles.errorText} accessible={true} accessibilityRole="alert">
              {validationErrors.weightKg}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );

  const renderLifestyle = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Lifestyle Factors (Optional)</Text>
      <Text style={styles.stepDescription}>
        This information helps us provide better medication recommendations.
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Smoking</Text>
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[
              styles.optionChip,
              formData.lifestyle?.smoking === true && styles.optionChipActive,
            ]}
            onPress={() =>
              updateFormData({
                lifestyle: { ...formData.lifestyle, smoking: true, alcoholUse: formData.lifestyle?.alcoholUse || 'none' },
              })
            }>
            <Text
              style={[
                styles.optionChipText,
                formData.lifestyle?.smoking === true && styles.optionChipTextActive,
              ]}>
              Yes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.optionChip,
              formData.lifestyle?.smoking === false && styles.optionChipActive,
            ]}
            onPress={() =>
              updateFormData({
                lifestyle: { ...formData.lifestyle, smoking: false, alcoholUse: formData.lifestyle?.alcoholUse || 'none' },
              })
            }>
            <Text
              style={[
                styles.optionChipText,
                formData.lifestyle?.smoking === false && styles.optionChipTextActive,
              ]}>
              No
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Alcohol Use</Text>
        <View style={styles.optionsRow}>
          {(['none', 'occasional', 'regular'] as const).map((option) => (
          <TouchableOpacity
              key={option}
              style={[
                styles.optionChip,
                formData.lifestyle?.alcoholUse === option && styles.optionChipActive,
              ]}
              onPress={() =>
                updateFormData({
                  lifestyle: {
                    smoking: formData.lifestyle?.smoking ?? false,
                    alcoholUse: option,
                  },
                })
              }>
              <Text
                style={[
                  styles.optionChipText,
                  formData.lifestyle?.alcoholUse === option && styles.optionChipTextActive,
                ]}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
            </Text>
          </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderAllergies = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Allergies (Optional)</Text>
      <Text style={styles.stepDescription}>
        Select any medication or substance allergies you have.
      </Text>

      <View style={styles.formGroup}>
      <SearchableMultiSelect
        options={COMMON_ALLERGIES}
          selectedItems={formData.allergies || []}
          onSelectionChange={(items) => updateFormData({ allergies: items })}
          placeholder="Select allergies..."
        title="Select Allergies"
        />
      </View>
    </View>
  );

  const renderEmergencyContact = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Emergency Contact (Optional)</Text>
      <Text style={styles.stepDescription}>
        Add an emergency contact for your medical records.
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Contact Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter contact name"
          placeholderTextColor={Colors.text.secondary}
          value={formData.emergencyContact?.name || ''}
          onChangeText={(text) =>
            updateFormData({
              emergencyContact: {
                ...formData.emergencyContact,
                name: text,
                phone: formData.emergencyContact?.phone || '',
                relationship: formData.emergencyContact?.relationship || '',
              },
            })
          }
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={[styles.input, validationErrors.emergencyPhone && styles.inputError]}
          placeholder="Enter phone number"
          placeholderTextColor={Colors.text.secondary}
          value={formData.emergencyContact?.phone || ''}
          onChangeText={(text) => {
            handleFieldChange('emergencyPhone', text);
            updateFormData({
              emergencyContact: {
                ...formData.emergencyContact,
                phone: text,
                name: formData.emergencyContact?.name || '',
                relationship: formData.emergencyContact?.relationship || '',
                email: formData.emergencyContact?.email || '',
              },
            });
          }}
          keyboardType="phone-pad"
          accessible={true}
          accessibilityLabel="Emergency contact phone number"
        />
        {validationErrors.emergencyPhone && (
          <Text style={styles.errorText} accessible={true} accessibilityRole="alert">
            {validationErrors.emergencyPhone}
          </Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Email (Optional)</Text>
        <TextInput
          style={[styles.input, validationErrors.emergencyEmail && styles.inputError]}
          placeholder="Enter email address"
          placeholderTextColor={Colors.text.secondary}
          value={formData.emergencyContact?.email || ''}
          onChangeText={(text) => {
            handleFieldChange('emergencyEmail', text);
            updateFormData({
              emergencyContact: {
                ...formData.emergencyContact,
                email: text,
                name: formData.emergencyContact?.name || '',
                phone: formData.emergencyContact?.phone || '',
                relationship: formData.emergencyContact?.relationship || '',
              },
            });
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          accessible={true}
          accessibilityLabel="Emergency contact email"
        />
        {validationErrors.emergencyEmail && (
          <Text style={styles.errorText} accessible={true} accessibilityRole="alert">
            {validationErrors.emergencyEmail}
          </Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Relationship</Text>
            <TextInput
              style={styles.input}
          placeholder="e.g., Spouse, Parent, Friend"
              placeholderTextColor={Colors.text.secondary}
          value={formData.emergencyContact?.relationship || ''}
          onChangeText={(text) =>
            updateFormData({
              emergencyContact: {
                ...formData.emergencyContact,
                relationship: text,
                name: formData.emergencyContact?.name || '',
                phone: formData.emergencyContact?.phone || '',
              },
            })
          }
        />
      </View>
    </View>
  );

  const renderBiometricData = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Biometric Data (Optional)</Text>
      <Text style={styles.stepDescription}>
        Add your biometric information for better medication recommendations.
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Blood Type</Text>
        <View style={styles.optionsRow}>
          {(['A', 'B', 'AB', 'O'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.optionChip,
                formData.biometricData?.bloodType === type && styles.optionChipActive,
              ]}
              onPress={() =>
                updateFormData({
                  biometricData: {
                    ...formData.biometricData,
                    bloodType: type,
                  },
                })
              }>
              <Text
                style={[
                  styles.optionChipText,
                  formData.biometricData?.bloodType === type && styles.optionChipTextActive,
                ]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
          </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>RH Factor</Text>
        <View style={styles.optionsRow}>
          {(['Positive', 'Negative', 'Unknown'] as const).map((factor) => (
            <TouchableOpacity
              key={factor}
              style={[
                styles.optionChip,
                formData.biometricData?.rhFactor === factor && styles.optionChipActive,
              ]}
              onPress={() =>
                updateFormData({
                  biometricData: {
                    ...formData.biometricData,
                    rhFactor: factor,
                  },
                })
              }>
              <Text
                style={[
                  styles.optionChipText,
                  formData.biometricData?.rhFactor === factor && styles.optionChipTextActive,
                ]}>
                {factor}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderMedicationHistory = () => {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Medication History (Optional)</Text>
        <Text style={styles.stepDescription}>
          List any medications you've taken in the past that might be relevant. You can enter multiple medications, one per line.
        </Text>

        <View style={styles.formGroup}>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter medication names, one per line (e.g., Aspirin 100mg daily, Ibuprofen 200mg as needed)"
            placeholderTextColor={Colors.text.secondary}
            value={medicationHistoryText}
            onChangeText={(text) => {
              // Update raw text immediately for smooth typing
              setMedicationHistoryText(text);
              
              // Process into array for form data (only non-empty lines)
              const medications = text
                .split('\n')
                .map((m) => m.trim())
                .filter((m) => m.length > 0);
              
              // Update form data with processed array
              updateFormData({ medicationHistory: medications });
            }}
            multiline
            numberOfLines={6}
            maxLength={1000}
            textAlignVertical="top"
            accessible={true}
            accessibilityLabel="Medication history input"
          />
          <Text style={styles.hint}>
            {medicationHistoryText.length}/1000 characters • {(formData.medicationHistory || []).length} medication(s) entered
          </Text>
        </View>
      </View>
    );
  };

  const renderFamilyMedicalHistory = () => {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Family Medical History (Optional)</Text>
        <Text style={styles.stepDescription}>
          Share any relevant family medical history that might affect your medication needs. You can enter multiple conditions, one per line.
        </Text>

        <View style={styles.formGroup}>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter family medical conditions, one per line (e.g., Heart disease, Diabetes, High blood pressure)"
            placeholderTextColor={Colors.text.secondary}
            value={familyMedicalHistoryText}
            onChangeText={(text) => {
              // Update raw text immediately for smooth typing
              setFamilyMedicalHistoryText(text);
              
              // Process into array for form data (only non-empty lines)
              const conditions = text
                .split('\n')
                .map((c) => c.trim())
                .filter((c) => c.length > 0);
              
              // Update form data with processed array
              updateFormData({ familyMedicalHistory: conditions });
            }}
            multiline
            numberOfLines={6}
            maxLength={1000}
            textAlignVertical="top"
            accessible={true}
            accessibilityLabel="Family medical history input"
          />
          <Text style={styles.hint}>
            {familyMedicalHistoryText.length}/1000 characters • {(formData.familyMedicalHistory || []).length} condition(s) entered
          </Text>
        </View>
      </View>
    );
  };

  const renderReview = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review Your Information</Text>
      <Text style={styles.stepDescription}>
        Please review your information before submitting.
      </Text>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Name</Text>
        <Text style={styles.reviewValue}>{formData.name}</Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Date of Birth</Text>
        <Text style={styles.reviewValue}>
          {formData.dateOfBirth
            ? new Date(formData.dateOfBirth).toLocaleDateString()
            : 'Not provided'}
        </Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Sex</Text>
        <Text style={styles.reviewValue}>
          {formData.sex.charAt(0).toUpperCase() + formData.sex.slice(1)}
        </Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Height</Text>
        <Text style={styles.reviewValue}>
          {formData.heightCm ? `${formData.heightCm} cm` : 'Not provided'}
        </Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Weight</Text>
        <Text style={styles.reviewValue}>
          {formData.weightKg ? `${formData.weightKg} kg` : 'Not provided'}
        </Text>
      </View>

      {formData.lifestyle && (
        <>
          <View style={styles.reviewSection}>
            <Text style={styles.reviewLabel}>Smoking</Text>
            <Text style={styles.reviewValue}>
              {formData.lifestyle.smoking ? 'Yes' : 'No'}
            </Text>
          </View>

          <View style={styles.reviewSection}>
            <Text style={styles.reviewLabel}>Alcohol Use</Text>
            <Text style={styles.reviewValue}>
              {formData.lifestyle.alcoholUse.charAt(0).toUpperCase() + formData.lifestyle.alcoholUse.slice(1)}
            </Text>
          </View>
        </>
      )}

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Allergies</Text>
        <Text style={styles.reviewValue}>
          {formData.allergies.length > 0 ? formData.allergies.join(', ') : 'None'}
        </Text>
      </View>

      {formData.emergencyContact?.name && (
        <>
          <View style={styles.reviewSection}>
            <Text style={styles.reviewLabel}>Emergency Contact</Text>
            <Text style={styles.reviewValue}>{formData.emergencyContact.name}</Text>
          </View>
          <View style={styles.reviewSection}>
            <Text style={styles.reviewLabel}>Contact Phone</Text>
            <Text style={styles.reviewValue}>{formData.emergencyContact.phone}</Text>
          </View>
          {formData.emergencyContact.email && (
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Contact Email</Text>
              <Text style={styles.reviewValue}>{formData.emergencyContact.email}</Text>
            </View>
          )}
        </>
      )}

      {formData.biometricData && (formData.biometricData.bloodType || formData.biometricData.rhFactor) && (
        <>
          {formData.biometricData.bloodType && (
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Blood Type</Text>
              <Text style={styles.reviewValue}>{formData.biometricData.bloodType}</Text>
            </View>
          )}
          {formData.biometricData.rhFactor && (
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>RH Factor</Text>
              <Text style={styles.reviewValue}>{formData.biometricData.rhFactor}</Text>
            </View>
          )}
        </>
      )}

      {formData.medicationHistory && formData.medicationHistory.length > 0 && (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Medication History</Text>
          <Text style={styles.reviewValue}>{(formData.medicationHistory || []).join('\n')}</Text>
        </View>
      )}

      {formData.familyMedicalHistory && formData.familyMedicalHistory.length > 0 && (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Family Medical History</Text>
          <Text style={styles.reviewValue}>{(formData.familyMedicalHistory || []).join('\n')}</Text>
        </View>
      )}
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 'basic':
        return renderBasicInfo();
      case 'physical':
        return renderPhysicalInfo();
      case 'lifestyle':
        return renderLifestyle();
      case 'allergies':
        return renderAllergies();
      case 'emergency':
        return renderEmergencyContact();
      case 'biometric':
        return renderBiometricData();
      case 'medication':
        return renderMedicationHistory();
      case 'family':
        return renderFamilyMedicalHistory();
      case 'review':
        return renderReview();
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Complete Your Profile</Text>
        <Text style={styles.headerSubtitle}>
          Step {getCurrentStepIndex() + 1} of 9
        </Text>
      </View>

      {renderStepIndicator()}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderStepContent()}
      </ScrollView>

      <View style={styles.footer}>
        {currentStep !== 'basic' && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, isSaving && styles.nextButtonDisabled]}
          onPress={currentStep === 'review' ? () => handleSave(0) : handleNext}
          disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.nextButtonText}>
              {currentStep === 'review' ? 'Complete Setup' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  stepIndicatorContainer: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  progressText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  draftSavingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  draftSavingText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  },
  stepIndicator: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  stepIndicatorItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  stepLine: {
    position: 'absolute',
    top: 3,
    left: '60%',
    width: '80%',
    height: 2,
    backgroundColor: Colors.border,
    zIndex: -1,
  },
  stepLineActive: {
    backgroundColor: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
  },
  stepContent: {
    gap: Spacing.lg,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  stepTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
    flex: 1,
  },
  stepDescription: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  label: {
    ...Typography.labelMedium,
    color: Colors.text.primary,
    flex: 1,
  },
  infoButton: {
    padding: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Typography.body,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  numericInput: {
    textAlign: 'left',
    textAlignVertical: 'center',
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  inputError: {
    borderColor: Colors.error,
    borderWidth: 2,
  },
  inputFooter: {
    marginTop: Spacing.xs,
    minHeight: 20,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.error,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    minHeight: 72,
    ...Shadows.md,
  },
  dateInputFilled: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: `${Colors.primary}08`,
  },
  dateInputContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  dateDisplayContainer: {
    gap: Spacing.xs,
  },
  dateInputText: {
    fontSize: 18,
    color: Colors.text.primary,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  dateInputAge: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  dateInputPlaceholder: {
    fontSize: 16,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  placeholder: {
    color: Colors.text.secondary,
  },
  sliderLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sliderValue: {
    ...Typography.h3,
    color: Colors.primary,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
    marginVertical: Spacing.sm,
  },
  sliderRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  sliderRangeText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionChipText: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  optionChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  pickerContainer: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    opacity: 1,
    ...Shadows.lg,
  },
  pickerHeader: {
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  pickerTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  pickerSubtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  webDateInput: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 17,
    color: Colors.text.primary,
    borderWidth: 2,
    borderColor: Colors.primary,
    minHeight: 48,
    marginVertical: Spacing.md,
  },
  datePickerWrapper: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    marginVertical: Spacing.md,
    overflow: 'hidden',
    opacity: 1,
  },
  datePicker: {
    height: 200,
    width: '100%',
    backgroundColor: Colors.card,
    opacity: 1,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  confirmButtonText: {
    ...Typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  reviewSection: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  reviewLabel: {
    ...Typography.labelMedium,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  reviewValue: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  footer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  backButton: {
    flex: 1,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backButtonText: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    ...Shadows.md,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    ...Typography.body,
    color: '#fff',
    fontWeight: '600',
  },
});
