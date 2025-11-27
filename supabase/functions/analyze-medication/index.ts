import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Missing imageBase64" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader! } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("age, weight, conditions")
      .eq("id", user.id)
      .maybeSingle();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze this medication label image and extract the following information in JSON format:
- name: Brand name of the medication
- generic_name: Generic drug name
- dosage: Dosage strength visible on label (e.g., "500mg")
- frequency: How often to take if shown on label (e.g., "twice daily", "every 8 hours")
- description: Brief one-sentence description of what the medication is used for
- is_prescription: true if this is a prescription medication (Rx), false for OTC/supplements
- category: Classify as one of: "otc" (over-the-counter medication), "prescription" (requires prescription), or "supplement" (vitamins, minerals, dietary supplements)

Return ONLY valid JSON with these fields. If information is not visible, use null. For category, analyze the medication type and choose the most appropriate category.`,
                },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
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
      console.error("Gemini API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to analyze medication image" }),
        {
          status: response.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      return new Response(
        JSON.stringify({ error: "Invalid response from Gemini API" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const content = data.candidates[0].content.parts[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "Failed to extract medication information" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const medicationInfo: MedicationInfo = JSON.parse(jsonMatch[0]);

    const profileInfo = `
Age: ${profile?.age || 'adult (age not specified)'}
Weight: ${profile?.weight ? `${profile.weight}kg` : 'not provided'}
Medical Conditions: ${profile?.conditions?.join(', ') || 'none reported'}
    `.trim();

    const medicationType = medicationInfo.is_prescription ? 'prescription medication' : 'over-the-counter medication or supplement';

    const dosageResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a medical dosage assistant. Provide personalized dosage recommendations based on patient profile.

Medication: ${medicationInfo.name}${medicationInfo.generic_name ? ` (${medicationInfo.generic_name})` : ''}
Label Dosage: ${medicationInfo.dosage || 'not specified'}
Type: ${medicationType}

Patient Profile:
${profileInfo}

${medicationInfo.is_prescription ?
  'For prescription medications: Provide typical prescribed dosage ranges and note that the patient should follow their doctor\'s specific prescription.' :
  'For OTC/supplements: Provide standard recommended adult dosage based on common medical guidelines and adjust for patient age/weight if relevant.'}

Return ONLY valid JSON in this format:
{
  "recommended_dosage": "specific dosage amount (e.g., '500mg', '1-2 tablets')",
  "recommended_frequency": "how often (e.g., 'Once daily', 'Twice daily with meals', '1-2 times per week')",
  "dosage_notes": "Important notes about timing, food interactions, maximum daily dose, or special considerations for this patient's profile. For prescription meds, remind to follow doctor's orders."
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

    if (dosageResponse.ok) {
      const dosageData = await dosageResponse.json();
      const dosageContent = dosageData.candidates?.[0]?.content?.parts?.[0]?.text;
      const dosageJsonMatch = dosageContent?.match(/\{[\s\S]*\}/);
      
      if (dosageJsonMatch) {
        try {
          const dosageInfo = JSON.parse(dosageJsonMatch[0]);
          medicationInfo.recommended_dosage = dosageInfo.recommended_dosage;
          medicationInfo.recommended_frequency = dosageInfo.recommended_frequency;
          medicationInfo.dosage_notes = dosageInfo.dosage_notes;
        } catch (e) {
          console.error('Failed to parse dosage info:', e);
        }
      }
    }

    return new Response(
      JSON.stringify(medicationInfo),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error in analyze-medication:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
