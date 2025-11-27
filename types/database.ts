export interface Profile {
  id: string;
  age: number | null;
  weight: number | null;
  allergies: string[];
  conditions: string[];
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  weight: number | null;
  height: number | null;
  allergies: string[];
  medical_conditions: string[];
  lifestyle: {
    smoking?: boolean;
    alcoholUse?: 'none' | 'occasional' | 'regular';
  } | null;
  emergency_contact: {
    name?: string;
    phone?: string;
    relationship?: string;
    email?: string;
  } | null;
  biometric_data: {
    bloodType?: string;
    rhFactor?: string;
  } | null;
  medication_history: string[] | null;
  family_medical_history: string[] | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export type MedicationCategory = 'otc' | 'prescription' | 'supplement';

export interface Medication {
  id: string;
  user_id: string;
  name: string;
  generic_name: string | null;
  dosage: string | null;
  frequency: string | null;
  description: string | null;
  image_url: string | null;
  reminder_time: string | null;
  reminder_times: string[] | null; // Array of reminder times for multiple reminders per day
  reminder_frequency: 'daily' | 'weekly' | 'monthly' | null;
  reminder_days: number[];
  active: boolean;
  recommended_dosage: string | null;
  recommended_frequency: string | null;
  is_prescription: boolean;
  prescribed_by: string | null;
  dosage_notes: string | null;
  category: MedicationCategory;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  user_id: string;
  medication_ids: string[];
  analysis: {
    interactions: Array<{
      drug1: string;
      drug2: string;
      severity: 'low' | 'moderate' | 'high' | 'critical';
      description: string;
    }>;
    warnings: string[];
    safe: boolean;
  };
  severity: 'safe' | 'warning' | 'critical';
  has_warnings: boolean;
  checked_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  metadata: Record<string, any>;
  image_url?: string | null;
  image_mime_type?: string | null;
  has_image?: boolean;
}
