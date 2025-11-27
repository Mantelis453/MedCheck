interface MedicationInfo {
  name: string;
  generic_name?: string;
  dosage?: string;
  frequency?: string;
  description?: string;
  is_prescription?: boolean;
  category?: 'otc' | 'prescription' | 'supplement';
  recommended_dosage?: string;
  recommended_frequency?: string;
  dosage_notes?: string;
}

interface InteractionResult {
  interactions: Array<{
    drug1: string;
    drug2: string;
    severity: 'low' | 'moderate' | 'high' | 'critical';
    description: string;
  }>;
  warnings: string[];
  safe: boolean;
}

export async function analyzeMedicationImage(
  imageBase64: string,
  apiKey: string
): Promise<MedicationInfo> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze this medication label image and extract information. Return ONLY valid JSON with these fields:
{
  "name": "Brand name",
  "generic_name": "Generic name or null",
  "dosage": "Dosage strength (e.g., '500mg') or null",
  "frequency": "Frequency (e.g., 'twice daily') or null",
  "description": "Brief one-sentence description or null",
  "is_prescription": true/false,
  "category": "otc" or "prescription" or "supplement"
}

If information is not visible, use null. Determine category: "prescription" if Rx symbol present, "supplement" for vitamins/minerals, otherwise "otc".`,
                },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Gemini API error (${response.status})`;
      
      try {
        let errorData = JSON.parse(errorText);
        
        // Handle double-encoded JSON
        if (typeof errorData.error === 'string') {
          try {
            errorData = JSON.parse(errorData.error);
          } catch {
            // Use string as-is if parsing fails
          }
        }
        
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.error?.error?.message) {
          errorMessage = errorData.error.error.message;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
        
        // Provide helpful context for API key errors
        if (errorMessage.includes('API key not valid') || errorMessage.includes('API_KEY_INVALID')) {
          errorMessage = 'API key not valid. Please check your Gemini API key configuration.';
        }
      } catch {
        errorMessage = `Gemini API error (${response.status}): ${errorText.substring(0, 200)}`;
      }
      
      console.error('Gemini API error response:', errorText);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Gemini API response:', JSON.stringify(data, null, 2));

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response structure from Gemini API');
    }

    const content = data.candidates[0].content.parts[0].text;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', content);
      throw new Error('Failed to extract medication information');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error: any) {
    console.error('analyzeMedicationImage error:', error);
    throw new Error(error.message || 'Failed to analyze medication image');
  }
}

export async function getMedicationInfo(
  medicationName: string,
  apiKey: string
): Promise<{
  generic_name?: string;
  dosage?: string;
  frequency?: string;
  description?: string;
  category?: 'otc' | 'prescription' | 'supplement';
  is_prescription?: boolean;
}> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a medical information assistant. Provide detailed information about the medication: "${medicationName}".

Return ONLY valid JSON with these fields:
{
  "generic_name": "Generic drug name (e.g., 'Acetaminophen' for Tylenol) or null if not available",
  "dosage": "Common dosage strength (e.g., '500mg', '10mg', '1 tablet') or null",
  "frequency": "Common frequency of use (e.g., 'twice daily', 'once daily', 'as needed') or null",
  "description": "Brief 1-2 sentence description of what this medication is used for",
  "category": "otc" or "prescription" or "supplement",
  "is_prescription": true/false
}

Determine category based on medication type:
- "prescription": Requires prescription (Rx drugs)
- "supplement": Vitamins, minerals, herbal supplements
- "otc": Over-the-counter medications

If information is not available or uncertain, use null for that field.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 400,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Gemini API error (${response.status})`;
      
      try {
        let errorData = JSON.parse(errorText);
        
        if (typeof errorData.error === 'string') {
          try {
            errorData = JSON.parse(errorData.error);
          } catch {
            // Use string as-is if parsing fails
          }
        }
        
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.error?.error?.message) {
          errorMessage = errorData.error.error.message;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        errorMessage = `Gemini API error (${response.status}): ${errorText.substring(0, 200)}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response structure from Gemini API');
    }

    const content = data.candidates[0].content.parts[0]?.text;
    if (!content) {
      throw new Error('No content in Gemini API response');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract medication information');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error: any) {
    console.error('getMedicationInfo error:', error);
    // Return empty object on error so user can still fill manually
    return {};
  }
}

export async function calculateRecommendedDosage(
  medicationInfo: {
    name: string;
    generic_name?: string;
    dosage?: string;
    is_prescription?: boolean;
  },
  userProfile: {
    age?: number | null;
    weight?: number | null;
    conditions?: string[];
  },
  apiKey: string
): Promise<{
  recommended_dosage: string;
  recommended_frequency: string;
  dosage_notes: string;
}> {
  try {
    const profileInfo = `
Age: ${userProfile.age || 'adult (age not specified)'}
Weight: ${userProfile.weight ? `${userProfile.weight}kg` : 'not provided'}
Medical Conditions: ${userProfile.conditions?.join(', ') || 'none reported'}
    `.trim();

    const medicationType = medicationInfo.is_prescription ? 'prescription medication' : 'over-the-counter medication or supplement';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a medical dosage assistant. Provide personalized dosage recommendations.

Medication: ${medicationInfo.name}${medicationInfo.generic_name ? ` (${medicationInfo.generic_name})` : ''}
Label Dosage: ${medicationInfo.dosage || 'not specified'}
Type: ${medicationType}

Patient Profile:
${profileInfo}

${medicationInfo.is_prescription
  ? 'For prescription: Provide typical dosage ranges. Remind patient to follow doctor\'s prescription.'
  : 'For OTC/supplements: Provide standard recommended adult dosage based on medical guidelines, adjusted for age/weight if relevant.'}

Return ONLY valid JSON:
{
  "recommended_dosage": "e.g., '500mg' or '1-2 tablets'",
  "recommended_frequency": "e.g., 'Once daily' or 'Twice daily with meals'",
  "dosage_notes": "Important notes about timing, food interactions, max daily dose, or special considerations. For prescriptions, remind to follow doctor's orders."
}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 400,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to calculate recommended dosage');
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response structure from Gemini API');
    }

    const content = data.candidates[0].content.parts[0]?.text;
    if (!content) {
      throw new Error('No content in Gemini API response');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract dosage recommendation');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error: any) {
    console.error('calculateRecommendedDosage error:', error);
    return {
      recommended_dosage: medicationInfo.dosage || 'See product label',
      recommended_frequency: 'As directed',
      dosage_notes: 'Please consult with your healthcare provider for personalized dosage recommendations.',
    };
  }
}

export async function checkMedicationInteractions(
  medications: Array<{ name: string; dosage?: string }>,
  userProfile: {
    age?: number | null;
    weight?: number | null;
    allergies?: string[];
    conditions?: string[];
  },
  apiKey: string
): Promise<InteractionResult> {
  const medicationList = medications
    .map((med) => `${med.name}${med.dosage ? ` ${med.dosage}` : ''}`)
    .join(', ');

  const profileInfo = `
Age: ${userProfile.age || 'not provided'}
Weight: ${userProfile.weight ? `${userProfile.weight}kg` : 'not provided'}
Allergies: ${userProfile.allergies?.join(', ') || 'none reported'}
Medical Conditions: ${userProfile.conditions?.join(', ') || 'none reported'}
  `.trim();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
                {
                  text: `You are a medical safety assistant. Analyze medication interactions and provide safety information. Always err on the side of caution.

Medications: ${medicationList}

Patient Profile:
${profileInfo}

Check for: drug-drug interactions, drug-allergy concerns, age/weight warnings, condition-related concerns.

Return ONLY valid JSON:
{
  "interactions": [{"drug1": "...", "drug2": "...", "severity": "low|moderate|high|critical", "description": "..."}],
  "warnings": ["..."],
  "safe": true/false
}

If no interactions found, return empty interactions array and safe: true.`,
                },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1000,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = 'Failed to check medication interactions';
    
    try {
      let errorData = JSON.parse(errorText);
      
      // Handle double-encoded JSON
      if (typeof errorData.error === 'string') {
        try {
          errorData = JSON.parse(errorData.error);
        } catch {
          // Use string as-is if parsing fails
        }
      }
      
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      } else if (errorData.error?.error?.message) {
        errorMessage = errorData.error.error.message;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
      
      // Provide helpful context for API key errors
      if (errorMessage.includes('API key not valid') || errorMessage.includes('API_KEY_INVALID')) {
        errorMessage = 'API key not valid. Please check your Gemini API key configuration.';
      }
    } catch {
      errorMessage = `Failed to check medication interactions (${response.status}): ${errorText.substring(0, 200)}`;
    }
    
    throw new Error(errorMessage);
  }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response structure from Gemini API');
    }

    const content = data.candidates[0].content.parts[0]?.text;
    if (!content) {
      throw new Error('No content in Gemini API response');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract interaction information');
    }

    return JSON.parse(jsonMatch[0]);
}

export async function chatWithAI(
  messages: Array<{ role: 'user' | 'assistant'; content: string; imageBase64?: string }>,
  medications: Array<{ name: string; dosage?: string }>,
  userProfile: {
    full_name?: string;
    age?: number | null;
    weight?: number | null;
    height?: number | null;
    allergies?: string[];
    medical_conditions?: string[];
    gender?: string | null;
    lifestyle?: {
      smoking?: boolean;
      alcoholUse?: 'none' | 'occasional' | 'regular';
    } | null;
    biometric_data?: {
      bloodType?: string;
      rhFactor?: string;
    } | null;
    medication_history?: string[];
    family_medical_history?: string[];
  },
  apiKey: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string; created_at: string }>
): Promise<string> {
  // Check if user is asking for more details
  const lastUserMessage = messages[messages.length - 1]?.content.toLowerCase() || '';
  const isAskingForMore = /\b(yes|sure|please|tell me more|more|details|detailed|expand|elaborate|explain more|go on|continue)\b/.test(lastUserMessage);
  const previousAssistantMessage = messages.length > 1 ? messages[messages.length - 2]?.content || '' : '';
  const previousAskedForMore = /would you like more detailed information/i.test(previousAssistantMessage);
  const shouldGiveDetailedResponse = isAskingForMore && previousAskedForMore;

  // Build context efficiently
  const medicationContext = medications.length > 0
    ? `Current medications: ${medications.map((med) => `${med.name}${med.dosage ? ` ${med.dosage}` : ''}`).join(', ')}`
    : 'No medications currently listed';

  const name = userProfile.full_name || 'there';
  
  // Build comprehensive profile context
  let profileContext = `Patient Profile:
- Name: ${name}
- Age: ${userProfile.age || 'unknown'}${userProfile.age ? ' years old' : ''}
- Gender: ${userProfile.gender || 'not specified'}`;

  // Physical metrics
  if (userProfile.height || userProfile.weight) {
    profileContext += `\n- Physical:`;
    if (userProfile.height) profileContext += ` Height: ${userProfile.height}cm`;
    if (userProfile.weight) profileContext += `${userProfile.height ? ',' : ''} Weight: ${userProfile.weight}kg`;
    if (userProfile.height && userProfile.weight) {
      const bmi = userProfile.weight / Math.pow(userProfile.height / 100, 2);
      profileContext += ` (BMI: ${bmi.toFixed(1)})`;
    }
  }

  // Allergies and conditions
  profileContext += `\n- Allergies: ${userProfile.allergies?.length ? userProfile.allergies.join(', ') : 'none'}`;
  profileContext += `\n- Medical Conditions: ${userProfile.medical_conditions?.length ? userProfile.medical_conditions.join(', ') : 'none'}`;

  // Lifestyle factors
  if (userProfile.lifestyle) {
    profileContext += `\n- Lifestyle:`;
    if (userProfile.lifestyle.smoking !== undefined) {
      profileContext += ` Smoking: ${userProfile.lifestyle.smoking ? 'Yes' : 'No'}`;
    }
    if (userProfile.lifestyle.alcoholUse) {
      profileContext += `${userProfile.lifestyle.smoking !== undefined ? ',' : ''} Alcohol: ${userProfile.lifestyle.alcoholUse}`;
    }
  }

  // Biometric data
  if (userProfile.biometric_data) {
    const bio = userProfile.biometric_data;
    if (bio.bloodType || bio.rhFactor) {
      profileContext += `\n- Biometric:`;
      if (bio.bloodType) profileContext += ` Blood Type: ${bio.bloodType}`;
      if (bio.rhFactor) profileContext += `${bio.bloodType ? ',' : ''} RH Factor: ${bio.rhFactor}`;
    }
  }

  // Medication history
  if (userProfile.medication_history && userProfile.medication_history.length > 0) {
    // Join with newlines for better readability in AI context, but also support comma-separated
    const medicationList = userProfile.medication_history
      .map(med => med.trim())
      .filter(med => med.length > 0)
      .join(', ');
    profileContext += `\n- Past Medications: ${medicationList}`;
  }

  // Family medical history
  if (userProfile.family_medical_history && userProfile.family_medical_history.length > 0) {
    // Join with newlines for better readability in AI context, but also support comma-separated
    const familyHistoryList = userProfile.family_medical_history
      .map(condition => condition.trim())
      .filter(condition => condition.length > 0)
      .join(', ');
    profileContext += `\n- Family Medical History: ${familyHistoryList}`;
  }

  const historyContext = conversationHistory && conversationHistory.length > 0
    ? `\n\nRecent Conversation:\n${conversationHistory.slice(-5).map((msg) => `${msg.role === 'user' ? 'User' : 'You'}: ${msg.content}`).join('\n')}`
    : '';

  const systemPrompt = shouldGiveDetailedResponse
    ? `You are ${name}'s personal AI health assistant. Provide detailed information about the previous topic.

${profileContext}
${medicationContext}${historyContext}

IMPORTANT: Use the patient's complete profile information to provide personalized, context-aware advice. Consider their age, weight, height, BMI, allergies, medical conditions, lifestyle factors (smoking, alcohol), biometric data, medication history, and family history when making recommendations.

Provide a comprehensive answer with context, examples, warnings, tips, and when to consult healthcare professionals.`
    : `You are ${name}'s personal AI health assistant. Answer questions about medications, side effects, interactions, and health advice tailored to their specific profile.

${profileContext}
${medicationContext}${historyContext}

PERSONALIZATION REQUIREMENTS:
- ALWAYS consider the patient's complete profile when providing advice
- Take into account their age, weight, height, BMI, allergies, medical conditions, lifestyle (smoking, alcohol), biometric data, medication history, and family history
- Warn about potential interactions with their allergies and existing medical conditions
- Consider age-appropriate dosing and contraindications
- Factor in lifestyle choices (smoking, alcohol) when discussing medication effects
- Reference family medical history when relevant to medication recommendations
- Use their name naturally in responses for a personalized experience
- Calculate and consider BMI when relevant to medication dosing or recommendations

CAPABILITIES:
- Answer medication and health questions with full context of their profile
- Detect when user wants to ADD a medication to their list
- Provide personalized dosage recommendations based on age, weight, height, and medical conditions
- Warn about drug-allergy interactions based on their allergy list
- Consider drug-disease interactions based on their medical conditions
- Factor in lifestyle factors when discussing medication safety and effectiveness

ADDING MEDICATIONS:
When the user wants to add a medication (e.g., "add ibuprofen", "I want to add aspirin", "add medication X"), you MUST:
1. Respond with a friendly message like: "I'll help you add [medication name] to your list. Let me prepare the details for you to review."
2. Include a JSON action at the end of your response: {"action": "add_medication", "medication": {"name": "Medication Name", "dosage": "...", "frequency": "...", "description": "...", "category": "otc|prescription|supplement"}}
3. Extract the medication name from the user's message
4. If dosage/frequency/description are mentioned, include them; otherwise use null
5. Determine category: "prescription" for Rx drugs, "supplement" for vitamins/herbs, "otc" for over-the-counter
6. Consider their profile when suggesting dosage (e.g., adjust for age, weight, kidney function if relevant)

RESPONSE FORMAT:
- Keep initial responses SHORT (2-3 sentences)
- End with: "Would you like more detailed information about this?" (unless adding medication)
- Only include medication JSON when user wants to add a medication
- Never show JSON or technical details to the user - keep responses conversational
- Always personalize advice based on their complete profile

Be warm, personalized, and use their name naturally. Always remind users to consult healthcare professionals for serious concerns.`;

  const contents = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const contentText = i === 0 ? `${systemPrompt}\n\n${msg.content}` : msg.content;

    const parts: any[] = [{ text: contentText }];

    if (msg.imageBase64) {
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: msg.imageBase64,
        },
      });
    }

    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts,
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: shouldGiveDetailedResponse ? 800 : 200,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = 'Failed to get AI response';
    
    try {
      // Try parsing the error - it might be double-encoded JSON
      let errorData = JSON.parse(errorText);
      
      // Handle double-encoded JSON (error text contains JSON string)
      if (typeof errorData.error === 'string') {
        try {
          errorData = JSON.parse(errorData.error);
        } catch {
          // If parsing fails, use the string as-is
        }
      }
      
      // Extract the actual error message
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      } else if (errorData.error?.error?.message) {
        errorMessage = errorData.error.error.message;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = typeof errorData.error === 'string' 
          ? errorData.error 
          : JSON.stringify(errorData.error);
      }
      
      // Provide helpful context for common errors
      if (errorMessage.includes('API key not valid') || errorMessage.includes('API_KEY_INVALID')) {
        errorMessage = 'API key not valid. Please check your EXPO_PUBLIC_GEMINI_API_KEY in the .env file and ensure it\'s a valid Gemini API key.';
      } else if (errorMessage.includes('API key') && (response.status === 400 || response.status === 401 || response.status === 403)) {
        errorMessage = 'Invalid or missing API key. Please verify your Gemini API key configuration.';
      }
    } catch (parseError) {
      // If JSON parsing fails, use the raw text
      errorMessage = `API Error (${response.status}): ${errorText.substring(0, 200)}`;
    }
    
    console.error('Gemini API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      parsedMessage: errorMessage,
    });
    
    throw new Error(errorMessage);
  }

  const data = await response.json();

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    console.error('Invalid Gemini API response structure:', JSON.stringify(data, null, 2));
    throw new Error('Invalid response structure from Gemini API');
  }

  const text = data.candidates[0].content.parts[0]?.text;
  if (!text) {
    console.error('No text content in Gemini API response:', JSON.stringify(data, null, 2));
    throw new Error('No content in Gemini API response');
  }

  return text;
}
