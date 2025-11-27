import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Camera,
  MessageSquare,
  Shield,
  Clock,
  CheckCircle,
  AlertCircle,
  Pill,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/design';

const { width } = Dimensions.get('window');

export default function LandingPage() {
  const router = useRouter();

  const features = [
    {
      icon: Camera,
      title: 'Smart Scanning',
      description: 'Take a photo of your medication and get instant AI-powered analysis',
      color: Colors.accent,
    },
    {
      icon: Shield,
      title: 'Interaction Checker',
      description: 'Real-time detection of dangerous drug interactions',
      color: Colors.warning,
    },
    {
      icon: MessageSquare,
      title: 'AI Chat Assistant',
      description: 'Ask questions about your medications or add them manually anytime, anywhere',
      color: Colors.info,
    },
    {
      icon: Clock,
      title: 'Smart Reminders',
      description: 'Never miss a dose with intelligent medication reminders',
      color: Colors.success,
    },
  ];

  const benefits = [
    'Scan medication bottles instantly with AI',
    'Check for dangerous drug interactions',
    '24/7 AI medication assistant',
    'Personalized health recommendations',
    'Track multiple medications easily',
    'Secure & private health data',
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={[Colors.background, Colors.secondary]}
        style={styles.heroSection}
      >
        <View style={styles.heroContent}>
          <View style={styles.logoBadge}>
            <Pill size={40} color={Colors.accent} />
          </View>

          <Text style={styles.heroTitle}>MedCheck AI</Text>

          <Text style={styles.heroSubtitle}>
            Your AI-Powered{'\n'}Medication Safety Assistant
          </Text>

          <Text style={styles.heroDescription}>
            Scan, check interactions, and manage your medications with advanced AI technology
          </Text>

          <View style={styles.heroButtons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/auth')}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
              <ChevronRight size={20} color={Colors.textOnDark} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>High</Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>24/7</Text>
            <Text style={styles.statLabel}>AI Support</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>100%</Text>
            <Text style={styles.statLabel}>Secure</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Sparkles size={28} color={Colors.accent} />
          <Text style={styles.sectionTitle}>Powerful Features</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          Everything you need to manage your medications safely
        </Text>

        <View style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <View style={[styles.featureIconContainer, { backgroundColor: `${feature.color}15` }]}>
                <feature.icon size={28} color={feature.color} />
              </View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </View>
          ))}
        </View>
      </View>

      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        style={styles.howItWorksSection}
      >
        <Text style={styles.howItWorksTitle}>How It Works</Text>
        <Text style={styles.howItWorksSubtitle}>
          Get started in 3 simple steps
        </Text>

        <View style={styles.stepsContainer}>
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Scan Your Medication</Text>
              <Text style={styles.stepDescription}>
                Take a photo of your medication bottle or packaging
              </Text>
            </View>
          </View>

          <View style={styles.stepConnector} />

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>AI Analysis</Text>
              <Text style={styles.stepDescription}>
                Our AI extracts information and checks for interactions
              </Text>
            </View>
          </View>

          <View style={styles.stepConnector} />

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Stay Safe</Text>
              <Text style={styles.stepDescription}>
                Get instant alerts and personalized recommendations
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Why Choose MedCheck AI?</Text>
        <Text style={styles.sectionSubtitle}>
          The smartest way to manage your health
        </Text>

        <View style={styles.benefitsList}>
          {benefits.map((benefit, index) => (
            <View key={index} style={styles.benefitItem}>
              <View style={styles.benefitIconContainer}>
                <CheckCircle size={20} color={Colors.success} />
              </View>
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.safetySection}>
        <View style={styles.safetyCard}>
          <Shield size={48} color={Colors.accent} />
          <Text style={styles.safetyTitle}>Your Safety is Our Priority</Text>
          <Text style={styles.safetyDescription}>
            MedCheck AI uses advanced encryption and secure storage to protect your health information.
            Your data is never shared with third parties.
          </Text>
          <View style={styles.safetyBadges}>
            <View style={styles.safetyBadge}>
              <CheckCircle size={16} color={Colors.success} />
              <Text style={styles.safetyBadgeText}>HIPAA Compliant</Text>
            </View>
            <View style={styles.safetyBadge}>
              <CheckCircle size={16} color={Colors.success} />
              <Text style={styles.safetyBadgeText}>End-to-End Encrypted</Text>
            </View>
          </View>
        </View>
      </View>

      <LinearGradient
        colors={[Colors.accent, Colors.accentDark]}
        style={styles.ctaSection}
      >
        <Text style={styles.ctaTitle}>Ready to Get Started?</Text>
        <Text style={styles.ctaSubtitle}>
          Join thousands of users managing their medications safely with AI
        </Text>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/auth')}
          activeOpacity={0.9}
        >
          <Text style={styles.ctaButtonText}>Start Free Today</Text>
          <ChevronRight size={20} color={Colors.primary} />
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2024 MedCheck AI. All rights reserved.</Text>
        <View style={styles.footerLinks}>
          <Text style={styles.footerLink}>Privacy Policy</Text>
          <Text style={styles.footerDivider}>•</Text>
          <Text style={styles.footerLink}>Terms of Service</Text>
          <Text style={styles.footerDivider}>•</Text>
          <Text style={styles.footerLink}>Contact</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  heroSection: {
    paddingTop: 80,
    paddingBottom: Spacing.massive,
    paddingHorizontal: Spacing.xl,
  },
  heroContent: {
    alignItems: 'center',
    marginBottom: Spacing.huge,
  },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.lg,
  },
  heroTitle: {
    ...Typography.displayLarge,
    color: Colors.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.base,
    lineHeight: 32,
  },
  heroDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.huge,
    maxWidth: 400,
  },
  heroButtons: {
    width: '100%',
    gap: Spacing.base,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: BorderRadius.xxl,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  primaryButtonText: {
    ...Typography.button,
    color: Colors.textOnDark,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    height: 56,
    borderRadius: BorderRadius.xxl,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    ...Typography.button,
    color: Colors.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    ...Typography.displayMedium,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.base,
  },

  section: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.massive,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  sectionTitle: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  sectionSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxl,
  },

  featuresGrid: {
    gap: Spacing.base,
  },
  featureCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.sm,
  },
  featureIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  featureTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  featureDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 24,
  },

  howItWorksSection: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.massive,
  },
  howItWorksTitle: {
    ...Typography.h1,
    color: Colors.textOnDark,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  howItWorksSubtitle: {
    ...Typography.body,
    color: Colors.textOnDark,
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: Spacing.huge,
  },
  stepsContainer: {
    gap: 0,
  },
  stepItem: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  stepNumber: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  stepNumberText: {
    ...Typography.h3,
    color: Colors.primary,
  },
  stepContent: {
    flex: 1,
    paddingBottom: Spacing.xl,
  },
  stepTitle: {
    ...Typography.h3,
    color: Colors.textOnDark,
    marginBottom: Spacing.xs,
  },
  stepDescription: {
    ...Typography.body,
    color: Colors.textOnDark,
    opacity: 0.9,
  },
  stepConnector: {
    width: 2,
    height: Spacing.xl,
    backgroundColor: Colors.secondary,
    opacity: 0.3,
    marginLeft: 23,
  },

  benefitsList: {
    gap: Spacing.base,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    backgroundColor: Colors.surface,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
  },
  benefitIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.success}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },

  safetySection: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.massive,
  },
  safetyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  safetyTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.base,
    textAlign: 'center',
  },
  safetyDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 24,
  },
  safetyBadges: {
    flexDirection: 'row',
    gap: Spacing.base,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  safetyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: `${Colors.success}15`,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
  },
  safetyBadgeText: {
    ...Typography.bodySmall,
    color: Colors.success,
    fontWeight: '600',
  },

  ctaSection: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.massive,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  ctaTitle: {
    ...Typography.h1,
    color: Colors.textOnDark,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  ctaSubtitle: {
    ...Typography.body,
    color: Colors.textOnDark,
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary,
    height: 56,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.xxl,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  ctaButtonText: {
    ...Typography.button,
    color: Colors.primary,
  },

  footer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.base,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  footerLink: {
    ...Typography.bodySmall,
    color: Colors.accent,
  },
  footerDivider: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
});
