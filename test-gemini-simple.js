/**
 * Simple Gemini API test (no dependencies required)
 * Usage: node test-gemini-simple.js AIzaSyDFpHTlM4dTG4JstEFoZ8cB4sLnzw7YxYs
 */

const API_KEY = process.argv[2] || process.env.EXPO_PUBLIC_GEMINI_API_KEY;

if (!API_KEY || API_KEY === 'your-gemini-api-key') {
  console.error('❌ ERROR: Please provide a valid Gemini API key');
  console.error('\nUsage: node test-gemini-simple.js YOUR_API_KEY');
  console.error('   OR: Set EXPO_PUBLIC_GEMINI_API_KEY in .env file');
  console.error('\nGet your API key from: https://aistudio.google.com/app/apikey');
  process.exit(1);
}

console.log('🔑 Testing API key:', API_KEY.substring(0, 15) + '...');
console.log('🧪 Sending test request to Gemini API...\n');

const testRequest = {
  contents: [
    {
      parts: [
        {
          text: 'Reply with just "Hello, API is working!" if you can read this message.',
        },
      ],
    },
  ],
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 10,
  },
};

fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testRequest),
  }
)
  .then(async (response) => {
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('❌ API Request Failed');
      console.error('Status:', response.status, response.statusText);
      
      try {
        const errorData = JSON.parse(responseText);
        const errorMsg = errorData.error?.message || JSON.stringify(errorData.error);
        console.error('Error:', errorMsg);
        
        if (response.status === 400 && errorMsg.includes('API key')) {
          console.error('\n💡 The API key format appears to be invalid');
        } else if (response.status === 401 || response.status === 403) {
          console.error('\n💡 The API key is invalid, expired, or restricted');
          console.error('   Get a new key from: https://aistudio.google.com/app/apikey');
        }
      } catch {
        console.error('Response:', responseText.substring(0, 200));
      }
      
      process.exit(1);
    }
    
    try {
      const data = JSON.parse(responseText);
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        console.error('❌ Invalid response structure');
        console.error('Response:', JSON.stringify(data, null, 2));
        process.exit(1);
      }
      
      const text = data.candidates[0].content.parts[0]?.text;
      if (!text) {
        console.error('❌ No text in response');
        process.exit(1);
      }
      
      console.log('✅ SUCCESS! API is working correctly');
      console.log('📝 Response:', text.trim());
      console.log('\n🎉 Your Gemini API key is valid and ready to use!');
      console.log('\n📝 Next steps:');
      console.log('   1. Update your .env file with this API key');
      console.log('   2. Restart Expo: npx expo start --clear');
    } catch (parseError) {
      console.error('❌ Failed to parse response:', parseError.message);
      console.error('Response:', responseText.substring(0, 200));
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Network error:', error.message);
    console.error('\n💡 Check your internet connection');
    process.exit(1);
  });

