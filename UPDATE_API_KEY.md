# How to Update Your Gemini API Key

## Quick Steps

1. **Get your API key** from: https://aistudio.google.com/app/apikey

2. **Open your `.env` file** in the project root:
   ```
   /Users/juozas/Downloads/MedAI-main/.env
   ```

3. **Find this line:**
   ```
   EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-api-key
   ```

4. **Replace it with your actual API key:**
   ```
   EXPO_PUBLIC_GEMINI_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   (Replace with your actual key - it should start with `AIza`)

5. **Save the file**

6. **Restart Expo with cache clear:**
   ```bash
   npx expo start --clear
   ```

## Verify It's Working

After restarting, test the chat feature:
1. Open the Chat tab
2. Send a test message
3. You should get an AI response

If you see an error, check:
- The API key is correct (no extra spaces, quotes, etc.)
- Expo was restarted after updating `.env`
- The key starts with `AIza` and is about 39 characters long

## Test Your API Key First

Before updating `.env`, you can test your key:
```bash
node test-gemini-simple.js YOUR_API_KEY
```

This will tell you if the key is valid before you add it to the app.

