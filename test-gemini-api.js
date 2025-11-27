/**
 * Simple test script to verify Gemini API key is working
 * Run with: node test-gemini-api.js
 */

require('dotenv').config();

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

if (!API_KEY || API_KEY === 'your-gemini-api-key') {
  console.error('❌ ERROR: Gemini API key not configured or still using placeholder');
  console.error('Please update EXPO_PUBLIC_GEMINI_API_KEY in your .env file');
  process.exit(1);
}

console.log('🔑 API Key found:', API_KEY.substring(0, 10) + '...');
console.log('🧪 Testing Gemini API connection...\n');

const testPrompt = {
  contents: [
    {
      parts: [
        {
          text: 'Say "Hello, API is working!" if you can read this.',
        },
      ],
    },
  ],
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 50,
  },
};

fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testPrompt),
  }
)
  .then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Unknown error';
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || JSON.stringify(errorData.error);
      } catch {
        errorMessage = errorText.substring(0, 200);
      }
      
      console.error('❌ API Error:', response.status, response.statusText);
      console.error('Error details:', errorMessage);
      
      if (response.status === 401 || response.status === 403) {
        console.error('\n💡 This usually means:');
        console.error('   - API key is invalid or expired');
        console.error('   - API key has been restricted');
        console.error('   - API key format is incorrect');
        console.error('\n📝 To fix:');
        console.error('   1. Go to https://aistudio.google.com/app/apikey');
        console.error('   2. Create a new API key');
        console.error('   3. Update EXPO_PUBLIC_GEMINI_API_KEY in your .env file');
        console.error('   4. Restart Expo with: npx expo start --clear');
      }
      
      process.exit(1);
    }
    
    return response.json();
  })
  .then((data) => {
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('❌ Invalid response structure from API');
      console.error('Response:', JSON.stringify(data, null, 2));
      process.exit(1);
    }
    
    const text = data.candidates[0].content.parts[0]?.text;
    if (!text) {
      console.error('❌ No text content in API response');
      process.exit(1);
    }
    
    console.log('✅ SUCCESS! API is working correctly');
    console.log('📝 Response:', text);
    console.log('\n🎉 Your Gemini API key is valid and working!');
  })
  .catch((error) => {
    console.error('❌ Network or parsing error:', error.message);
    console.error('\n💡 Check your internet connection and try again');
    process.exit(1);
  });

