import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Index() {
  const { user, loading } = useAuth();
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [hasCompletedProfile, setHasCompletedProfile] = useState(false);

  useEffect(() => {
    const checkUserProfile = async () => {
      if (!user) {
        setCheckingProfile(false);
        setHasCompletedProfile(false);
        return;
      }

      setCheckingProfile(true);

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('onboarding_completed')
          .eq('user_id', user.id)
          .maybeSingle();

        // PGRST116 is the "no rows returned" error, which is expected for new users
        // PGRST205 is the "table not found" error - table may not exist yet
        // Other errors should be logged but not block the flow
        if (error) {
          if (error.code === 'PGRST116') {
            // No profile found - user needs to complete onboarding
            setHasCompletedProfile(false);
          } else if (error.code === 'PGRST205') {
            // Table not found - treat as no profile (user needs onboarding)
            // Don't log this as an error since it's a setup issue, not a runtime error
            console.warn('User profiles table not found. Please ensure database migrations have been run.');
            setHasCompletedProfile(false);
          } else {
            // Other database errors - log but assume onboarding not completed
            console.error('Error checking profile:', error);
            setHasCompletedProfile(false);
          }
        } else {
          // Successfully retrieved profile
          setHasCompletedProfile(data?.onboarding_completed === true);
        }
      } catch (error) {
        // Network or other unexpected errors
        console.error('Exception checking profile:', error);
        setHasCompletedProfile(false);
      } finally {
        setCheckingProfile(false);
      }
    };

    checkUserProfile();
  }, [user]);

  if (loading || (user && checkingProfile)) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/landing" />;
  }

  if (!hasCompletedProfile) {
    return <Redirect href="/onboarding" />;
  }

  // Redirect to home page (tabs index) as default route
  // Using tabs root which defaults to index tab
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
