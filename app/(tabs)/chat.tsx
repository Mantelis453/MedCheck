import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image,
  Alert,
  Keyboard,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Conversation, ConversationMessage } from '@/types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Send, Plus, MessageSquare, Trash2, ImageIcon, X, Clock, Check, Info } from 'lucide-react-native';
import { chatWithAI } from '@/services/gemini';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/design';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getMedicationInfo } from '@/services/gemini';
import { MedicationCategory } from '@/types/database';
import { scheduleMedicationReminder } from '@/services/notifications';

export default function ChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [hasImageColumns, setHasImageColumns] = useState<boolean | null>(null);
  const flatListRef = useRef<FlatList>(null);
  
  // Medication form modal state
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [medicationInfo, setMedicationInfo] = useState<any>(null);
  const [fetchingInfo, setFetchingInfo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MedicationCategory>('otc');

  useEffect(() => {
    loadConversations();
    checkImageColumnsSupport();
  }, []);

  // Check if image columns exist in the database
  const checkImageColumnsSupport = async () => {
    try {
      // Try a test query that includes image columns
      const { error } = await supabase
        .from('conversation_messages')
        .select('id, has_image, image_url, image_mime_type')
        .limit(0); // Don't fetch any rows, just test the schema
      
      if (error && error.code === 'PGRST204' && error.message?.includes('column')) {
        setHasImageColumns(false);
        console.warn('Image columns not available in conversation_messages table');
      } else {
        setHasImageColumns(true);
      }
    } catch (error) {
      console.warn('Could not check image columns support:', error);
      setHasImageColumns(false);
    }
  };

  useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation.id);
    }
  }, [currentConversation]);

  // Dismiss keyboard when tab loses focus or component unmounts
  useFocusEffect(
    useCallback(() => {
      // Dismiss keyboard when leaving the tab
      return () => {
        Keyboard.dismiss();
      };
    }, [])
  );

  // Also dismiss keyboard when component mounts (in case it was open from another tab)
  useEffect(() => {
    const timer = setTimeout(() => {
      Keyboard.dismiss();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const loadConversations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        // Table not found - migrations not run
        console.warn('Conversations table not found. Please run migrations.');
        Alert.alert(
          'Database Setup Required',
          'The conversations table is not available. Please run the migration file:\n\nsupabase/migrations/20251125093152_create_conversations_system.sql\n\nIn your Supabase dashboard SQL Editor.',
          [{ text: 'OK' }]
        );
        return;
      }
      console.error('Error loading conversations:', error);
      return;
    }

    if (data && data.length > 0) {
      setConversations(data);
      if (!currentConversation) {
        setCurrentConversation(data[0]);
      }
    } else {
      // No conversations exist, create one automatically
      await createNewConversation();
    }
  };

  const loadMessages = async (conversationId: string) => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('Conversation messages table not found. Please run migrations.');
      } else if (error.code === 'PGRST204' && error.message?.includes('column')) {
        console.error('Missing column in conversation_messages:', error.message);
      } else {
        console.error('Error loading messages:', error);
      }
      setMessages([]);
    } else if (data) {
      setMessages(data);
    } else {
      setMessages([]);
    }
    setLoading(false);
  };

  const createNewConversation = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: 'New Conversation',
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Failed to create conversation - Full error:', JSON.stringify(error, null, 2));
      
      if (error.code === 'PGRST205') {
        Alert.alert(
          'Database Setup Required',
          'The conversations table is not available. Please run the migration file:\n\nsupabase/migrations/20251125093152_create_conversations_system.sql\n\nIn your Supabase dashboard SQL Editor.',
          [{ text: 'OK' }]
        );
      } else if (error.code === '42501') {
        Alert.alert(
          'Permission Error',
          'You do not have permission to create conversations. Please check your database RLS policies.',
          [{ text: 'OK' }]
        );
      } else {
        const errorMessage = error.message || error.details || 'Unknown error';
        Alert.alert(
          'Error',
          `Failed to create conversation: ${errorMessage}\n\nCode: ${error.code || 'N/A'}`,
          [{ text: 'OK' }]
        );
      }
      return;
    }

    if (data) {
      setConversations([data, ...conversations]);
      setCurrentConversation(data);
      setMessages([]);
      setShowConversations(false);
    } else {
      // If insert succeeded but no data returned (PGRST204), try to fetch it
      const { data: fetchedData } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (fetchedData) {
        setConversations([fetchedData, ...conversations]);
        setCurrentConversation(fetchedData);
        setMessages([]);
        setShowConversations(false);
      } else {
        console.error('Failed to create or retrieve conversation');
        Alert.alert('Error', 'Failed to create conversation. Please try again.');
      }
    }
  };

  const deleteConversation = async (conversationId: string) => {
    const { error } = await supabase
      .from('conversations')
      .update({ is_active: false })
      .eq('id', conversationId);

    if (error) {
      console.error('Failed to delete conversation:', error);
      Alert.alert('Error', 'Failed to delete conversation. Please try again.');
      return;
    }

    const updatedConversations = conversations.filter((c) => c.id !== conversationId);
    setConversations(updatedConversations);

    if (currentConversation?.id === conversationId) {
      if (updatedConversations.length > 0) {
        setCurrentConversation(updatedConversations[0]);
      } else {
        setCurrentConversation(null);
        setMessages([]);
      }
    }
  };

  const updateConversationTitle = async (conversationId: string, firstMessage: string) => {
    const title = firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');
    const { error } = await supabase
      .from('conversations')
      .update({ title })
      .eq('id', conversationId);

    if (error) {
      console.error('Failed to update conversation title:', error);
      // Don't show alert for title update failures - it's not critical
      return;
    }

    setConversations(
      conversations.map((c) => (c.id === conversationId ? { ...c, title } : c))
    );
  };

  const pickImage = async () => {
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Not Available', 'Image upload is not available on web. Please use the mobile app.');
        return;
      }

      console.log('Requesting media library permissions...');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Permission status:', status);

      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images');
        return;
      }

      console.log('Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        console.log('Selected image URI:', uri);
        setSelectedImage(uri);

        console.log('Reading image as base64...');
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
        setImageBase64(base64);
        console.log('Image loaded successfully');
      } else {
        console.log('Image selection canceled or no assets');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Camera is not available on web');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera permissions');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setSelectedImage(uri);

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      setImageBase64(base64);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImageBase64(null);
  };

  // Fetch medication details from Gemini API
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
        
        if (details.category && !updated.category && !prev.category) {
          setSelectedCategory(details.category);
        } else if (details.is_prescription !== undefined && !prev.category) {
          setSelectedCategory(details.is_prescription ? 'prescription' : 'otc');
        }
        
        return updated;
      });
    } catch (error) {
      console.error('Failed to fetch medication details:', error);
    } finally {
      setFetchingInfo(false);
    }
  }, []);

  const addMedicationFromChat = async (medicationData: {
    name: string;
    dosage?: string;
    frequency?: string;
    description?: string;
    category?: 'otc' | 'prescription' | 'supplement';
  }) => {
    console.log('Opening medication form modal with:', medicationData);
    
    // Set medication info and show modal immediately
    setMedicationInfo(medicationData);
    
    // Set category
    if (medicationData.category) {
      setSelectedCategory(medicationData.category);
    } else {
      setSelectedCategory('otc');
    }
    
    // Show modal
    setShowMedicationModal(true);
    console.log('Modal state set to true, showMedicationModal:', true);
    
    // Fetch additional details from Gemini if we have a medication name
    if (medicationData.name) {
      fetchMedicationDetails(medicationData.name);
    }
  };

  const saveMedication = async () => {
    if (!user || !medicationInfo) {
      console.error('Missing user or medication info:', { user: !!user, medicationInfo: !!medicationInfo });
      Alert.alert('Error', 'Missing user or medication information. Please try again.');
      return;
    }

    if (!user.id) {
      console.error('User ID is missing:', user);
      Alert.alert('Error', 'User authentication error. Please try logging out and back in.');
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
      
      console.log('Attempting to save medication:', {
        user_id: medicationData.user_id,
        name: medicationData.name,
        category: medicationData.category,
      });

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
        console.error('Medication data being inserted:', JSON.stringify(medicationData, null, 2));
        
        // Handle specific error codes
        if (error.code === '23505') {
          throw new Error('This medication already exists in your list.');
        } else if (error.code === '23503') {
          throw new Error('Invalid user reference. Please try logging out and back in.');
        } else if (error.code === '42501') {
          throw new Error('Permission denied. Please check your account permissions.');
        } else if (error.code === 'PGRST205') {
          throw new Error('Database table "medications" not found. Please ensure database migrations have been run.');
        } else if (error.code === 'PGRST204') {
          // This might happen if RLS prevents returning the inserted row
          // Try to fetch it separately
          console.warn('PGRST204: Insert may have succeeded but select returned 0 rows, checking...');
          const { data: checkData, error: checkError } = await supabase
            .from('medications')
            .select('*')
            .eq('user_id', user.id)
            .eq('name', medicationData.name.trim())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (checkData && !checkError) {
            // Medication was saved, just couldn't return it in the insert
            console.log('Medication saved successfully (verified via separate query)');
            // Continue with success flow using checkData
            const successData = [checkData];
            // Schedule reminder if time is set
            if (reminderTime && successData[0]) {
              try {
                const timeString = reminderTime.toTimeString().slice(0, 5);
                await scheduleMedicationReminder(
                  medicationInfo.name || 'Medication',
                  timeString,
                  successData[0].id
                );
              } catch (reminderError) {
                console.warn('Failed to schedule reminder:', reminderError);
              }
            }
            
            Alert.alert('Success', 'Medication added successfully', [
              {
                text: 'OK',
                onPress: () => {
                  setMedicationInfo(null);
                  setReminderTime(null);
                  setSelectedCategory('otc');
                  setShowMedicationModal(false);
                },
              },
            ]);
            setSaving(false);
            return;
          } else {
            throw new Error('Failed to save medication. Please try again.');
          }
        } else {
          // Provide more detailed error message
          // Handle different error object structures
          let errorMessage = 'Failed to save medication';
          if (typeof error === 'string') {
            errorMessage = error;
          } else if (error?.message) {
            errorMessage = error.message;
          } else if (error?.details) {
            errorMessage = error.details;
          } else if (error?.hint) {
            errorMessage = error.hint;
          } else if (typeof error === 'object' && error !== null) {
            // Try to extract message from nested structure
            const errorStr = JSON.stringify(error);
            if (errorStr.length < 200) {
              errorMessage = errorStr;
            }
          }
          
          const errorCode = error?.code || (typeof error === 'object' && error !== null ? (error as any).code : undefined);
          throw new Error(`${errorMessage}${errorCode ? ` (Error code: ${errorCode})` : ''}`);
        }
      }

      if (!data || data.length === 0) {
        throw new Error('Failed to save medication - no data returned');
      }

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
        }
      }

      Alert.alert('Success', 'Medication added successfully', [
        {
          text: 'OK',
          onPress: () => {
            // Reset state and close modal
            setMedicationInfo(null);
            setReminderTime(null);
            setSelectedCategory('otc');
            setShowMedicationModal(false);
          },
        },
      ]);
    } catch (error: any) {
      console.error('Save medication error:', error);
      console.error('Error type:', typeof error);
      console.error('Error structure:', JSON.stringify(error, null, 2));
      
      // Extract error message from various possible structures
      let errorMessage = 'Failed to save medication. Please try again.';
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.details) {
        errorMessage = error.details;
      } else if (error?.hint) {
        errorMessage = error.hint;
      } else if (error?.error?.message) {
        errorMessage = error.error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Try to stringify if it's a simple object
        try {
          const errorStr = JSON.stringify(error);
          if (errorStr.length < 300) {
            errorMessage = `Error: ${errorStr}`;
          }
        } catch {
          // If stringify fails, use default message
        }
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const uploadImageToStorage = async (base64: string, messageId: string): Promise<string | null> => {
    try {
      const fileName = `${user!.id}/${currentConversation!.id}/${messageId}.jpg`;
      const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(fileName, decode(base64), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Failed to upload image:', error);
      return null;
    }
  };

  const decode = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const sendMessage = async () => {
    if (!user || (!input.trim() && !selectedImage)) return;

    const userMessage = input.trim();
    const imageToSend = imageBase64;
    const imageUriToSend = selectedImage;
    setInput('');
    setSelectedImage(null);
    setImageBase64(null);
    setSending(true);

    let conversationId = currentConversation?.id;

    if (!conversationId) {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: 'New Conversation',
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Failed to create conversation - Full error:', JSON.stringify(error, null, 2));
        
        if (error.code === 'PGRST205') {
          Alert.alert(
            'Database Setup Required',
            'The conversations table is not available. Please run the migration file:\n\nsupabase/migrations/20251125093152_create_conversations_system.sql\n\nIn your Supabase dashboard SQL Editor.',
            [{ text: 'OK' }]
          );
        setSending(false);
        setInput(userMessage);
          if (imageUriToSend) {
            setSelectedImage(imageUriToSend);
            setImageBase64(imageToSend);
          }
        return;
        } else if (error.code === 'PGRST204') {
          // Insert may have succeeded but select returned 0 rows - try to fetch it
          console.warn('PGRST204: Insert succeeded but select returned 0 rows, fetching conversation...');
          // Continue to fallback logic below
        } else if (error.code === '42501') {
          // Permission denied - RLS policy issue
          Alert.alert(
            'Permission Error',
            'You do not have permission to create conversations. This may be due to Row Level Security (RLS) policies. Please check your database configuration.',
            [{ text: 'OK' }]
          );
          setSending(false);
          setInput(userMessage);
          if (imageUriToSend) {
            setSelectedImage(imageUriToSend);
            setImageBase64(imageToSend);
          }
          return;
        } else {
          // Other errors - show detailed message
          const errorMessage = error.message || error.details || 'Unknown error';
          console.error('Failed to create conversation:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          Alert.alert(
            'Error Creating Conversation',
            `Failed to create conversation.\n\nError: ${errorMessage}\n\nCode: ${error.code || 'N/A'}\n\nPlease ensure the conversations table exists and RLS policies are configured correctly.`,
            [{ text: 'OK' }]
          );
        setSending(false);
        setInput(userMessage);
          if (imageUriToSend) {
            setSelectedImage(imageUriToSend);
            setImageBase64(imageToSend);
          }
        return;
        }
      }

      // If we have data, use it; otherwise try to fetch the conversation
      if (data) {
      conversationId = data.id;
      setCurrentConversation(data);
      setConversations([data, ...conversations]);
      } else {
        // Insert succeeded but no data returned (PGRST204 or RLS issue) - fetch it
        console.warn('No data returned from insert, fetching conversation...');
        const { data: fetchedData, error: fetchError } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (fetchError) {
          console.error('Failed to fetch conversation after insert:', fetchError);
          Alert.alert('Error', 'Failed to create conversation. Please try again.');
          setSending(false);
          setInput(userMessage);
          if (imageUriToSend) {
            setSelectedImage(imageUriToSend);
            setImageBase64(imageToSend);
          }
          return;
        }
        
        if (!fetchedData) {
          console.error('Conversation not found after insert');
          Alert.alert('Error', 'Failed to create conversation. Please try again.');
          setSending(false);
          setInput(userMessage);
          if (imageUriToSend) {
            setSelectedImage(imageUriToSend);
            setImageBase64(imageToSend);
          }
          return;
        }
        
        conversationId = fetchedData.id;
        setCurrentConversation(fetchedData);
        setConversations([fetchedData, ...conversations]);
      }
    }

    try {
      let imageUrl = null;
      if (imageToSend) {
        const tempMessageId = `temp_${Date.now()}`;
        imageUrl = await uploadImageToStorage(imageToSend, tempMessageId);
      }

      // Build insert payload conditionally based on column availability
      const messagePayload: any = {
          conversation_id: conversationId!,
          role: 'user',
          content: userMessage || '(Image attached)',
      };

      // Only include image fields if columns exist and we have an image
      if (hasImageColumns !== false && imageUrl) {
        messagePayload.image_url = imageUrl;
        messagePayload.has_image = true;
        messagePayload.image_mime_type = 'image/jpeg';
      } else if (hasImageColumns === null) {
        // Try with image fields first, fallback if they don't exist
        messagePayload.image_url = imageUrl;
        messagePayload.has_image = !!imageUrl;
        messagePayload.image_mime_type = imageUrl ? 'image/jpeg' : null;
      }

      const { error: userMsgError } = await supabase
        .from('conversation_messages')
        .insert(messagePayload);

      if (userMsgError) {
        console.error('Failed to insert user message - Full error:', JSON.stringify(userMsgError, null, 2));
        
        if (userMsgError.code === 'PGRST205') {
          Alert.alert(
            'Database Setup Required',
            'The conversation_messages table is not available. Please run the migration file:\n\nsupabase/migrations/20251125093152_create_conversations_system.sql\n\nIn your Supabase dashboard SQL Editor.',
            [{ text: 'OK' }]
          );
          throw userMsgError;
        } else if (userMsgError.code === 'PGRST204' && userMsgError.message?.includes('column')) {
          // Missing column error - update state and retry without image columns
          setHasImageColumns(false);
          
          // Retry insert without image columns
          const retryPayload: any = {
            conversation_id: conversationId!,
            role: 'user',
            content: userMessage || (imageToSend ? '(Image attached - image support not available)' : ''),
          };
          
          const { error: retryError } = await supabase
            .from('conversation_messages')
            .insert(retryPayload);
          
          if (retryError) {
            Alert.alert(
              'Database Schema Error',
              `Missing column in conversation_messages table: ${userMsgError.message}\n\nPlease run the migration file:\n\nsupabase/migrations/20251126085855_add_image_support_to_messages.sql\n\nIn your Supabase dashboard SQL Editor.\n\nAfter running the migration, wait 10-30 seconds for the schema cache to refresh, then try again.`,
              [{ text: 'OK' }]
            );
            throw retryError;
          } else {
            // Successfully inserted without image columns - continue with message flow
            console.warn('Message saved without image columns. Image support requires migration.');
            // Don't throw - continue to AI response below
          }
        } else {
        console.error('Failed to insert user message:', userMsgError);
          Alert.alert('Error', `Failed to save your message: ${userMsgError.message || 'Unknown error'}`);
        throw userMsgError;
        }
      }

      if (messages.length === 0 && conversationId) {
        await updateConversationTitle(conversationId, userMessage);
      }

      const { data: medications } = await supabase
        .from('medications')
        .select('name, dosage')
        .eq('user_id', user.id)
        .eq('active', true);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, date_of_birth, gender, weight, height, allergies, medical_conditions, lifestyle, biometric_data, medication_history, family_medical_history')
        .eq('user_id', user.id)
        .maybeSingle();

      const age = profile?.date_of_birth
        ? new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()
        : null;

      const { data: conversationHistory } = await supabase
        .from('conversation_messages')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(10);

      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      
      // Debug logging (remove in production)
      console.log('API Key check:', {
        exists: !!apiKey,
        isPlaceholder: apiKey === 'your-gemini-api-key',
        length: apiKey?.length || 0,
        startsWithAIza: apiKey?.startsWith('AIza') || false,
      });
      
      if (!apiKey || apiKey === 'your-gemini-api-key' || apiKey.trim() === '') {
        Alert.alert(
          'Configuration Error',
          'Gemini API key is not configured or still using placeholder.\n\nPlease:\n1. Get your API key from: https://aistudio.google.com/app/apikey\n2. Update EXPO_PUBLIC_GEMINI_API_KEY in your .env file\n3. Restart Expo: npx expo start --clear'
        );
        throw new Error('Gemini API key not configured');
      }

      // Note: We'll let the AI handle medication addition requests through its response
      // This allows the AI to provide context and then trigger navigation via JSON action

      const conversationMessages = messages
        .slice(-10)
        .map((msg) => ({ role: msg.role, content: msg.content }));
      conversationMessages.push({
        role: 'user' as const,
        content: userMessage || 'What can you tell me about this image?',
        imageBase64: imageToSend || undefined,
      } as any);

      let aiResponse: string;
      try {
        aiResponse = await chatWithAI(
        conversationMessages,
        medications || [],
        {
          full_name: profile?.full_name || '',
          age,
          weight: profile?.weight || null,
          height: profile?.height || null,
          allergies: profile?.allergies || [],
          medical_conditions: profile?.medical_conditions || [],
          gender: profile?.gender || null,
          lifestyle: profile?.lifestyle || null,
          biometric_data: profile?.biometric_data || null,
          medication_history: profile?.medication_history || [],
          family_medical_history: profile?.family_medical_history || [],
        },
          apiKey,
          conversationHistory || []
        );
      } catch (aiError: any) {
        console.error('Gemini API error:', aiError);
        const errorMessage = aiError?.message || 'Failed to get AI response';
        Alert.alert(
          'AI Service Error',
          `${errorMessage}\n\nPlease check your Gemini API key and try again.`,
          [{ text: 'OK' }]
        );
        throw aiError;
      }

      // Initialize cleaned response
      let cleanedResponse: string = aiResponse;
      let medicationActionFound = false;
      let medicationData: any = null;
      
      // Check if AI wants to add a medication (from AI response JSON)
      // Try multiple patterns to find medication action JSON
      const patterns = [
        /\{"action":\s*"add_medication"[^}]*"medication":\s*\{[^}]*\}[^}]*\}/, // Compact format
        /\{"action":\s*"add_medication".*?"medication":\s*\{.*?\}.*?\}/s, // Multi-line format
        /\{"action"\s*:\s*"add_medication".*?"medication"\s*:\s*\{[^}]*\}[^}]*\}/s, // With spaces
      ];
      
      for (const pattern of patterns) {
        const medicationMatch = aiResponse.match(pattern);
        if (medicationMatch) {
          try {
            const actionData = JSON.parse(medicationMatch[0]);
            if (actionData.action === 'add_medication' && actionData.medication && actionData.medication.name) {
              medicationActionFound = true;
              medicationData = actionData.medication;
              console.log('Found medication action in AI response:', medicationData);
              break; // Found it, stop trying other patterns
            }
          } catch (parseError) {
            console.warn('Failed to parse medication action with pattern:', parseError);
            continue; // Try next pattern
          }
        }
      }
      
      // Clean response (remove JSON, code blocks, etc.)
      cleanedResponse = aiResponse
        // Remove markdown code blocks (json, code, etc.)
        .replace(/```json[\s\S]*?```/gi, '')
        .replace(/```[\s\S]*?```/g, '')
        // Remove JSON objects (including nested ones)
        .replace(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
        // Remove any remaining action/medication JSON patterns
        .replace(/\{"action":\s*"[^"]+"[^}]*\}/g, '')
        .replace(/\{[^}]*"medication"[^}]*\}/g, '')
        // Remove excessive whitespace and newlines
        .replace(/\n\s*\n\s*\n+/g, '\n\n')
        .replace(/^\s+|\s+$/gm, '') // Trim each line
        .trim();
      
      // If medication action was found, update response and navigate AFTER showing message
      if (medicationActionFound && medicationData) {
        const medicationName = medicationData.name || 'this medication';
        cleanedResponse = `I'll help you add ${medicationName} to your list. Opening the review form in a moment...`;
        
        // Open medication form modal AFTER a delay to let user see the response first
        setTimeout(() => {
          addMedicationFromChat(medicationData);
        }, 1500); // 1.5 second delay to ensure message is visible
      } else if (!cleanedResponse || cleanedResponse.length < 3) {
        cleanedResponse = 'Is there anything else you\'d like to know?';
      }

      const { error: assistantMsgError } = await supabase.from('conversation_messages').insert({
        conversation_id: conversationId!,
        role: 'assistant',
        content: cleanedResponse,
      });

      if (assistantMsgError) {
        console.error('Failed to insert assistant message:', assistantMsgError);
        // Don't throw - message was sent successfully, just couldn't save to DB
      }

      await loadMessages(conversationId!);
      await loadConversations();
    } catch (error: any) {
      console.error('Failed to send message - Full error:', error);
      
      // Extract error message properly
      let errorMessage = 'Failed to send message. Please try again.';
      let errorTitle = 'Error';
      
      // Handle Error objects
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Categorize errors
      if (error?.code === 'PGRST205') {
        errorTitle = 'Database Setup Required';
        errorMessage = 'Database tables not available. Please run migrations.';
      } else if (error?.code === 'PGRST204' && errorMessage?.includes('column')) {
        errorTitle = 'Database Schema Error';
        errorMessage = `Missing column: ${errorMessage}\n\nPlease run the migration:\n\nsupabase/migrations/20251126085855_add_image_support_to_messages.sql\n\nAfter running, wait 10-30 seconds for the schema cache to refresh.`;
        setHasImageColumns(false);
      } else if (errorMessage?.includes('API key not valid') || errorMessage?.includes('API key') || errorMessage?.includes('Gemini') || errorMessage?.includes('API_KEY')) {
        errorTitle = 'API Key Error';
        errorMessage = `${errorMessage}\n\nTo fix this:\n1. Get a valid API key from: https://aistudio.google.com/app/apikey\n2. Update EXPO_PUBLIC_GEMINI_API_KEY in your .env file\n3. Restart Expo: npx expo start --clear`;
      } else if (errorMessage?.includes('not configured')) {
        errorTitle = 'Configuration Error';
        errorMessage = `${errorMessage}\n\nPlease add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.`;
      }
      
      Alert.alert(errorTitle, errorMessage);
      setInput(userMessage);
      if (imageUriToSend) {
        setSelectedImage(imageUriToSend);
        setImageBase64(imageToSend);
      }
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ConversationMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}>
        {item.has_image && item.image_url && (
          <Image
            source={{ uri: item.image_url }}
            style={styles.messageImage}
            resizeMode="cover"
          />
        )}
        <Text style={[styles.messageText, isUser && styles.userMessageText]}>
          {item.content}
        </Text>
      </View>
    );
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const isActive = currentConversation?.id === item.id;
    return (
      <View style={styles.conversationItem}>
        <TouchableOpacity
          style={[
            styles.conversationButton,
            isActive && styles.conversationButtonActive,
          ]}
          onPress={() => {
            setCurrentConversation(item);
            setShowConversations(false);
          }}>
          <MessageSquare
            size={20}
            color={isActive ? Colors.primary : Colors.text.secondary}
          />
          <View style={styles.conversationTextContainer}>
            <Text
              style={[
                styles.conversationTitle,
                isActive && styles.conversationTitleActive,
              ]}
              numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.conversationDate}>
              {new Date(item.updated_at).toLocaleDateString()}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteConversation(item.id)}>
          <Trash2 size={18} color={Colors.error} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.conversationsToggle}
            onPress={() => setShowConversations(true)}>
            <MessageSquare size={24} color={Colors.primary} />
            <Text style={styles.headerTitle}>
              {currentConversation?.title || 'AI Assistant'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newChatButton} onPress={createNewConversation}>
            <Plus size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Your personal health assistant</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Start a new conversation</Text>
              <Text style={styles.emptySubtext}>
                Ask me anything about your medications and health
              </Text>
            </View>
          }
        />
      )}

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          {selectedImage && (
            <View style={styles.selectedImageContainer}>
              <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
              <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                <X size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
              <ImageIcon size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Ask about your medications..."
              placeholderTextColor={Colors.text.secondary}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              blurOnSubmit={false}
              returnKeyType="send"
              onSubmitEditing={() => {
                if (input.trim() && !sending) {
                  sendMessage();
                } else {
                  Keyboard.dismiss();
                }
              }}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                ((!input.trim() && !selectedImage) || sending) && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={(!input.trim() && !selectedImage) || sending}>
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Send size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={showConversations}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowConversations(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Conversations</Text>
              <TouchableOpacity onPress={() => setShowConversations(false)}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              renderItem={renderConversationItem}
              contentContainerStyle={styles.conversationList}
              ListEmptyComponent={
                <View style={styles.emptyConversations}>
                  <Text style={styles.emptyConversationsText}>No conversations yet</Text>
                  <Text style={styles.emptyConversationsSubtext}>
                    Start a new conversation to get started
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Medication Form Modal */}
      <Modal
        visible={showMedicationModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowMedicationModal(false);
          setMedicationInfo(null);
          setReminderTime(null);
          setSelectedCategory('otc');
        }}>
        <View style={styles.medicationModalContainer}>
          <View style={styles.medicationModalHeader}>
            <Text style={styles.medicationModalTitle}>Review Medication</Text>
            <TouchableOpacity onPress={() => {
              setShowMedicationModal(false);
              setMedicationInfo(null);
              setReminderTime(null);
              setSelectedCategory('otc');
            }}>
              <X size={28} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.chatBanner}>
            <Text style={styles.chatBannerText}>
              💬 Medication suggested by AI - Please review and confirm details
            </Text>
          </View>

          {fetchingInfo && (
            <View style={styles.infoBanner}>
              <Info size={20} color={Colors.primary} />
              <Text style={styles.infoBannerText}>Fetching medication information...</Text>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          )}

          {!medicationInfo ? (
            <View style={styles.medicationModalContent}>
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
              <Text style={[styles.emptySubtext, { marginTop: Spacing.md }]}>Loading medication details...</Text>
            </View>
          ) : (
            <ScrollView style={styles.medicationModalContent} contentContainerStyle={styles.medicationModalScrollContent}>
                <View style={styles.medicationForm}>
                  <View style={styles.medicationField}>
                    <Text style={styles.medicationLabel}>Name *</Text>
                    <TextInput
                      style={[styles.medicationInput, !medicationInfo?.name?.trim() && styles.medicationInputRequired]}
                      value={medicationInfo?.name || ''}
                      onChangeText={(text) =>
                        setMedicationInfo({ ...medicationInfo, name: text })
                      }
                      placeholder="Medication name"
                      placeholderTextColor={Colors.text.secondary}
                    />
                  </View>

                  <View style={styles.medicationField}>
                    <Text style={styles.medicationLabel}>Generic Name (Optional)</Text>
                    <TextInput
                      style={styles.medicationInput}
                      value={medicationInfo?.generic_name || ''}
                      onChangeText={(text) =>
                        setMedicationInfo({ ...medicationInfo, generic_name: text })
                      }
                      placeholder="e.g., Acetaminophen"
                      placeholderTextColor={Colors.text.secondary}
                    />
                  </View>

                  <View style={styles.medicationField}>
                    <Text style={styles.medicationLabel}>Dosage (Optional)</Text>
                    <TextInput
                      style={styles.medicationInput}
                      value={medicationInfo?.dosage || ''}
                      onChangeText={(text) =>
                        setMedicationInfo({ ...medicationInfo, dosage: text })
                      }
                      placeholder="e.g., 500mg, 1 tablet"
                      placeholderTextColor={Colors.text.secondary}
                    />
                  </View>

                  <View style={styles.medicationField}>
                    <Text style={styles.medicationLabel}>Frequency (Optional)</Text>
                    <TextInput
                      style={styles.medicationInput}
                      value={medicationInfo?.frequency || ''}
                      onChangeText={(text) =>
                        setMedicationInfo({ ...medicationInfo, frequency: text })
                      }
                      placeholder="e.g., twice daily, once a week"
                      placeholderTextColor={Colors.text.secondary}
                    />
                  </View>

                  <View style={styles.medicationField}>
                    <Text style={styles.medicationLabel}>Description (Optional)</Text>
                    <TextInput
                      style={[styles.medicationInput, styles.medicationTextArea]}
                      value={medicationInfo?.description || ''}
                      onChangeText={(text) =>
                        setMedicationInfo({ ...medicationInfo, description: text })
                      }
                      placeholder="e.g., Used for pain relief and fever reduction"
                      placeholderTextColor={Colors.text.secondary}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  <View style={styles.medicationField}>
                    <Text style={styles.medicationLabel}>Category</Text>
                    <View style={styles.medicationCategoryButtons}>
                      <TouchableOpacity
                        style={[
                          styles.medicationCategoryButton,
                          selectedCategory === 'otc' && styles.medicationCategoryButtonActive,
                        ]}
                        onPress={() => setSelectedCategory('otc')}>
                        <Text
                          style={[
                            styles.medicationCategoryButtonText,
                            selectedCategory === 'otc' && styles.medicationCategoryButtonTextActive,
                          ]}>
                          OTC
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.medicationCategoryButton,
                          selectedCategory === 'prescription' && styles.medicationCategoryButtonActive,
                        ]}
                        onPress={() => setSelectedCategory('prescription')}>
                        <Text
                          style={[
                            styles.medicationCategoryButtonText,
                            selectedCategory === 'prescription' && styles.medicationCategoryButtonTextActive,
                          ]}>
                          Prescription
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.medicationCategoryButton,
                          selectedCategory === 'supplement' && styles.medicationCategoryButtonActive,
                        ]}
                        onPress={() => setSelectedCategory('supplement')}>
                        <Text
                          style={[
                            styles.medicationCategoryButtonText,
                            selectedCategory === 'supplement' && styles.medicationCategoryButtonTextActive,
                          ]}>
                          Supplement
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.medicationField}>
                    <Text style={styles.medicationLabel}>Reminder Time (Optional)</Text>
                    <TouchableOpacity
                      style={styles.medicationTimeButton}
                      onPress={() => setShowTimePicker(true)}>
                      <Clock size={20} color={Colors.text.secondary} />
                      <Text style={styles.medicationTimeButtonText}>
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
                        style={styles.medicationClearButton}
                        onPress={() => setReminderTime(null)}>
                        <Text style={styles.medicationClearButtonText}>Clear</Text>
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

                  <TouchableOpacity
                    style={[styles.medicationSaveButton, saving && styles.medicationSaveButtonDisabled]}
                    onPress={saveMedication}
                    disabled={saving}>
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Check size={20} color="#fff" />
                        <Text style={styles.medicationSaveButtonText}>Save Medication</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
    padding: Spacing.lg,
    paddingTop: 60,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  conversationsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
    flex: 1,
  },
  newChatButton: {
    padding: Spacing.sm,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  },
  messageList: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
    ...Shadows.sm,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    ...Typography.body,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  inputContainer: {
    padding: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputWrapper: {
    gap: Spacing.sm,
  },
  selectedImageContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  imageButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    color: Colors.text.primary,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageImage: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%',
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  modalClose: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  conversationList: {
    padding: Spacing.md,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  conversationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  conversationButtonActive: {
    backgroundColor: Colors.primary + '20',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  conversationTextContainer: {
    flex: 1,
  },
  conversationTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  conversationTitleActive: {
    color: Colors.primary,
  },
  conversationDate: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  },
  deleteButton: {
    padding: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  emptyConversations: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyConversationsText: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  emptyConversationsSubtext: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  // Medication Modal Styles
  medicationModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  medicationModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: 60,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  medicationModalTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  medicationModalContent: {
    flex: 1,
  },
  medicationModalScrollContent: {
    paddingBottom: Spacing.xxl,
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
  medicationForm: {
    padding: Spacing.lg,
  },
  medicationField: {
    marginBottom: Spacing.md,
  },
  medicationLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  medicationInput: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    ...Typography.body,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  medicationInputRequired: {
    borderColor: Colors.error || '#FF3B30',
    borderWidth: 2,
  },
  medicationTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  medicationCategoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  medicationCategoryButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  medicationCategoryButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  medicationCategoryButtonText: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  medicationCategoryButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  medicationTimeButton: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  medicationTimeButtonText: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  medicationClearButton: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  medicationClearButtonText: {
    color: Colors.error || '#FF3B30',
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  medicationSaveButton: {
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
  medicationSaveButtonDisabled: {
    opacity: 0.5,
  },
  medicationSaveButtonText: {
    color: Colors.card,
    ...Typography.button,
  },
});
