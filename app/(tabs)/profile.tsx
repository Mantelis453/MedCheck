import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { LogOut, Plus, ChevronRight } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/design';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import { COMMON_ALLERGIES, COMMON_CONDITIONS } from '@/constants/medical';
import DateTimePicker from '@react-native-community/datetimepicker';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  weight: number | null;
  height: number | null;
  allergies: string[];
  medical_conditions: string[];
  onboarding_completed: boolean;
}

const calculateAge = (dateOfBirth: string): string => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return `${age} years old`;
};

interface ValidationErrors {
  full_name?: string;
  date_of_birth?: string;
  gender?: string;
  weight?: string;
  height?: string;
}

const DEBOUNCE_DELAY = 300;

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Partial<UserProfile> | null>(null);
  const [weightText, setWeightText] = useState('');
  const [heightText, setHeightText] = useState('');
  const [showAllergiesModal, setShowAllergiesModal] = useState(false);
  const [showConditionsModal, setShowConditionsModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [editingName, setEditingName] = useState(false);
  const [editingGender, setEditingGender] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!user) {
      console.log('No user found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Loading profile for user:', user.id);

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('Profile data:', data);
      console.log('Profile error:', error);

      if (error) {
        console.error('Error loading profile:', error);
      }

      if (data) {
        setProfile(data);
        setWeightText(data.weight?.toString() || '');
        setHeightText(data.height?.toString() || '');
        if (data.date_of_birth) {
          setTempDate(new Date(data.date_of_birth));
        }
      } else {
        // No profile found, set empty profile
        console.log('No profile found, creating empty profile state');
        setProfile({
          user_id: user.id,
          full_name: '',
          date_of_birth: null,
          gender: null,
          weight: null,
          height: null,
          allergies: [],
          medical_conditions: [],
          onboarding_completed: false,
        });
        setWeightText('');
        setHeightText('');
      }
    } catch (error) {
      console.error('Exception loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Validation function similar to onboarding
  const validateField = useCallback((field: string, value: any): string | undefined => {
    switch (field) {
      case 'full_name':
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

      case 'date_of_birth':
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

      case 'weight':
        if (value !== null && value !== undefined && value !== '') {
          const num = typeof value === 'string' ? parseFloat(value) : value;
          if (isNaN(num)) {
            return 'Please enter a valid weight';
          }
          if (num < 2 || num > 200) {
            return 'Weight must be between 2-200 kg';
          }
        }
        return undefined;

      case 'height':
        if (value !== null && value !== undefined && value !== '') {
          const num = typeof value === 'string' ? parseFloat(value) : value;
          if (isNaN(num)) {
            return 'Please enter a valid height';
          }
          if (num < 30 || num > 260) {
            return 'Height must be between 30-260 cm';
          }
        }
        return undefined;

      default:
        return undefined;
    }
  }, []);

  const handleFieldChange = (field: string, value: any) => {
    if (!profile) return;

    setProfile({ ...profile, [field]: value });
    
    // Clear validation errors for updated field
    setValidationErrors((prev) => {
      const cleared = { ...prev };
      delete cleared[field as keyof ValidationErrors];
      return cleared;
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

  const handleDateSelect = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setTempDate(selectedDate);
      if (Platform.OS === 'android') {
        const dateStr = selectedDate.toISOString().split('T')[0];
        handleFieldChange('date_of_birth', dateStr);
      }
    }
  };

  const confirmDateSelection = () => {
    setShowDatePicker(false);
    const selectedDate = tempDate.toISOString().split('T')[0];
    handleFieldChange('date_of_birth', selectedDate);
  };

  const cancelDateSelection = () => {
    setShowDatePicker(false);
    if (profile?.date_of_birth) {
      setTempDate(new Date(profile.date_of_birth));
    }
  };

  const saveProfile = async () => {
    if (!user || !profile) return;

    // Validate all fields before saving
    const errors: ValidationErrors = {};
    
    if (!profile.full_name || !profile.full_name.trim()) {
      errors.full_name = 'Name is required';
    } else {
      const nameError = validateField('full_name', profile.full_name);
      if (nameError) errors.full_name = nameError;
    }

    if (profile.date_of_birth) {
      const dobError = validateField('date_of_birth', profile.date_of_birth);
      if (dobError) errors.date_of_birth = dobError;
    }

    if (weightText.trim()) {
      const weightValue = parseFloat(weightText);
      const weightError = validateField('weight', weightValue);
      if (weightError) errors.weight = weightError;
    }

    if (heightText.trim()) {
      const heightValue = parseFloat(heightText);
      const heightError = validateField('height', heightValue);
      if (heightError) errors.height = heightError;
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      const firstError = Object.values(errors)[0];
      Alert.alert('Validation Error', firstError);
      return;
    }

    setSaving(true);
    const weightValue = weightText.trim() ? parseFloat(weightText.trim()) : null;
    const heightValue = heightText.trim() ? parseFloat(heightText.trim()) : null;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: profile.full_name,
          date_of_birth: profile.date_of_birth,
          gender: profile.gender,
          weight: weightValue,
          height: heightValue,
          allergies: profile.allergies || [],
          medical_conditions: profile.medical_conditions || [],
        })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      Alert.alert('Success', 'Profile saved successfully');
      setValidationErrors({});
    } catch (error: any) {
      console.error('Error saving profile:', error);
      let errorMessage = 'Failed to save profile. Please try again.';
      if (error?.message) {
        errorMessage = error.message;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleAllergiesChange = (allergies: string[]) => {
    if (profile) {
      setProfile({ ...profile, allergies });
    }
  };

  const handleConditionsChange = (conditions: string[]) => {
    if (profile) {
      setProfile({ ...profile, medical_conditions: conditions });
    }
  };

  // Sync weightText and heightText when profile changes
  useEffect(() => {
    if (profile?.weight !== null && profile?.weight !== undefined) {
      setWeightText(profile.weight.toString());
    } else {
      setWeightText('');
    }
    if (profile?.height !== null && profile?.height !== undefined) {
      setHeightText(profile.height.toString());
    } else {
      setHeightText('');
    }
  }, [profile?.weight, profile?.height]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity
            onPress={async () => {
              await signOut();
              router.replace('/landing');
            }}
            style={styles.signOutButton}>
            <LogOut size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Name *</Text>
            {editingName ? (
              <>
                <TextInput
                  style={[styles.input, validationErrors.full_name && styles.inputError]}
                  placeholder="Enter your full name"
                  placeholderTextColor={Colors.textSecondary}
                  value={profile?.full_name || ''}
                  onChangeText={(text) => handleFieldChange('full_name', text)}
                  autoCapitalize="words"
                  maxLength={100}
                />
                {validationErrors.full_name && (
                  <Text style={styles.errorText}>{validationErrors.full_name}</Text>
                )}
                <TouchableOpacity
                  style={styles.saveFieldButton}
                  onPress={() => setEditingName(false)}>
                  <Text style={styles.saveFieldButtonText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.editableField}
                onPress={() => setEditingName(true)}>
                <Text style={styles.infoText}>{profile?.full_name || 'Not set'}</Text>
                <ChevronRight size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.infoText}>{user?.email}</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Date of Birth *</Text>
            <TouchableOpacity
              style={[styles.dateInput, profile?.date_of_birth && styles.dateInputFilled]}
              onPress={() => {
                if (profile?.date_of_birth) {
                  setTempDate(new Date(profile.date_of_birth));
                }
                setShowDatePicker(true);
              }}>
              <View style={styles.dateInputContent}>
                <Text style={[styles.dateInputText, !profile?.date_of_birth && styles.placeholder]}>
                  {profile?.date_of_birth
                    ? new Date(profile.date_of_birth).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Select date of birth'}
                </Text>
                {profile?.date_of_birth && (
                  <Text style={styles.dateInputAge}>
                    ({calculateAge(profile.date_of_birth)})
                  </Text>
                )}
              </View>
              <ChevronRight size={20} color={profile?.date_of_birth ? Colors.primary : Colors.textSecondary} />
            </TouchableOpacity>
            {validationErrors.date_of_birth && (
              <Text style={styles.errorText}>{validationErrors.date_of_birth}</Text>
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

          <View style={styles.formGroup}>
            <Text style={styles.label}>Gender *</Text>
            {editingGender ? (
              <View style={styles.optionsRow}>
                {(['male', 'female', 'other'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionChip,
                      profile?.gender === option && styles.optionChipActive,
                    ]}
                    onPress={() => {
                      handleFieldChange('gender', option);
                      setEditingGender(false);
                    }}>
                    <Text
                      style={[
                        styles.optionChipText,
                        profile?.gender === option && styles.optionChipTextActive,
                      ]}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.editableField}
                onPress={() => setEditingGender(true)}>
                <Text style={styles.infoText}>
                  {profile?.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : 'Not set'}
                </Text>
                <ChevronRight size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Height (cm)</Text>
            <TextInput
              style={[styles.input, styles.numericInput, validationErrors.height && styles.inputError]}
              placeholder="Enter your height"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numeric"
              value={heightText}
              onChangeText={(text) => {
                // Filter to only allow numbers and decimal point
                const numericText = text.replace(/[^0-9.]/g, '');
                
                // Prevent multiple decimal points
                const parts = numericText.split('.');
                const filteredText = parts.length > 2 
                  ? parts[0] + '.' + parts.slice(1).join('')
                  : numericText;
                
                setHeightText(filteredText);
                
                if (filteredText === '' || filteredText === '.') {
                  handleFieldChange('height', null);
                } else {
                  const num = parseFloat(filteredText);
                  if (!isNaN(num)) {
                    handleFieldChange('height', num);
                  }
                }
              }}
            />
            {validationErrors.height && (
              <Text style={styles.errorText}>{validationErrors.height}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={[styles.input, styles.numericInput, validationErrors.weight && styles.inputError]}
              placeholder="Enter your weight"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numeric"
              value={weightText}
              onChangeText={(text) => {
                // Filter to only allow numbers and decimal point
                const numericText = text.replace(/[^0-9.]/g, '');
                
                // Prevent multiple decimal points
                const parts = numericText.split('.');
                const filteredText = parts.length > 2 
                  ? parts[0] + '.' + parts.slice(1).join('')
                  : numericText;
                
                setWeightText(filteredText);
                
                if (filteredText === '' || filteredText === '.') {
                  handleFieldChange('weight', null);
                } else {
                  const num = parseFloat(filteredText);
                  if (!isNaN(num)) {
                    handleFieldChange('weight', num);
                  }
                }
              }}
            />
            {validationErrors.weight && (
              <Text style={styles.errorText}>{validationErrors.weight}</Text>
            )}
          </View>
        </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Allergies</Text>
          <TouchableOpacity
            style={styles.addIconButton}
            onPress={() => setShowAllergiesModal(true)}>
            <Plus size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        {profile?.allergies && profile.allergies.length > 0 ? (
          <View style={styles.tagsContainer}>
            {profile.allergies.map((allergy, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{allergy}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No allergies added</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Medical Conditions</Text>
          <TouchableOpacity
            style={styles.addIconButton}
            onPress={() => setShowConditionsModal(true)}>
            <Plus size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        {profile?.medical_conditions && profile.medical_conditions.length > 0 ? (
          <View style={styles.tagsContainer}>
            {profile.medical_conditions.map((condition, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{condition}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No medical conditions added</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={saveProfile}
        disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Profile</Text>
        )}
      </TouchableOpacity>

      <View style={styles.bottomSpacing} />

        <SearchableMultiSelect
        options={COMMON_ALLERGIES}
        selectedItems={profile?.allergies || []}
        onSelectionChange={handleAllergiesChange}
        placeholder="Search allergies..."
        title="Select Allergies"
        visible={showAllergiesModal}
        onClose={() => setShowAllergiesModal(false)}
        hideTrigger={true}
      />

      <SearchableMultiSelect
        options={COMMON_CONDITIONS}
        selectedItems={profile?.medical_conditions || []}
        onSelectionChange={handleConditionsChange}
        placeholder="Search medical conditions..."
        title="Select Medical Conditions"
        visible={showConditionsModal}
        onClose={() => setShowConditionsModal(false)}
        hideTrigger={true}
      />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  formGroup: {
    marginBottom: Spacing.md,
  },
  editableField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  dateInputFilled: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  dateInputContent: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  dateInputText: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs / 2,
  },
  dateInputAge: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  placeholder: {
    color: Colors.textSecondary,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  optionChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionChipText: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  optionChipTextActive: {
    color: '#fff',
    fontWeight: '600',
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
  errorText: {
    ...Typography.bodySmall,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  saveFieldButton: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  saveFieldButtonText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  pickerContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    ...Shadows.card,
  },
  pickerHeader: {
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  pickerTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  pickerSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  datePicker: {
    height: 200,
    marginVertical: Spacing.md,
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
    borderColor: Colors.inputBorder,
  },
  cancelButtonText: {
    ...Typography.body,
    color: Colors.textPrimary,
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
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 64,
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  signOutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  section: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadows.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  addIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.base,
  },
  infoText: {
    ...Typography.body,
    color: Colors.textPrimary,
    paddingVertical: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  tagText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    alignItems: 'center',
    ...Shadows.soft,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: Colors.textOnDark,
    ...Typography.button,
    fontWeight: '700',
  },
  bottomSpacing: {
    height: Platform.OS === 'ios' ? 120 : 100,
  },
});
