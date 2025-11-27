import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Mail } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/design';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const { signIn, signUp, signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      setLoading(false);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        router.replace('/');
      }
    } else {
      const { error, needsConfirmation } = await signUp(email, password);
      setLoading(false);

      if (error) {
        Alert.alert('Error', error.message);
      } else if (needsConfirmation) {
        router.push({
          pathname: '/verify-email',
          params: { email },
        });
      } else {
        router.replace('/');
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading('google');
    const { error } = await signInWithGoogle();
    setOauthLoading(null);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.replace('/');
    }
  };

  const handleAppleSignIn = async () => {
    setOauthLoading('apple');
    const { error } = await signInWithApple();
    setOauthLoading(null);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.replace('/');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>MedCheck AI</Text>
          <Text style={styles.subtitle}>
            Your AI-powered medication safety assistant
          </Text>
          {/* TODO: Remove this demo note before production */}
          <Text style={styles.demoNote}>
            Note: you can login via any email address and password. Auth not required for demo purposes. Example: email: test@test.com, password: test123
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#8E8E93"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#8E8E93"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isLogin ? 'Sign In' : 'Sign Up'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.oauthButtons}>
            <TouchableOpacity
              style={[styles.oauthButton, oauthLoading === 'google' && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={oauthLoading !== null}>
              {oauthLoading === 'google' ? (
                <ActivityIndicator color="#007AFF" />
              ) : (
                <>
                  <Mail size={20} color="#007AFF" />
                  <Text style={styles.oauthButtonText}>Google</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.oauthButton, oauthLoading === 'apple' && styles.buttonDisabled]}
              onPress={handleAppleSignIn}
              disabled={oauthLoading !== null}>
              {oauthLoading === 'apple' ? (
                <ActivityIndicator color="#007AFF" />
              ) : (
                <>
                  <Mail size={20} color="#007AFF" />
                  <Text style={styles.oauthButtonText}>Apple</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
            <Text style={styles.switchText}>
              {isLogin
                ? "Don't have an account? Sign Up"
                : 'Already have an account? Sign In'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.huge,
    alignItems: 'center',
  },
  title: {
    ...Typography.displayLarge,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  demoNote: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.base,
    fontStyle: 'italic',
    paddingHorizontal: Spacing.base,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    ...Typography.body,
    color: Colors.textPrimary,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 56,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xxl,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    ...Shadows.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...Typography.button,
    color: Colors.textOnDark,
  },
  switchText: {
    ...Typography.body,
    color: Colors.accent,
    textAlign: 'center',
    marginTop: Spacing.base,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginHorizontal: Spacing.base,
  },
  oauthButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  oauthButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    height: 56,
  },
  oauthButtonText: {
    ...Typography.labelLarge,
    color: Colors.accent,
  },
});
