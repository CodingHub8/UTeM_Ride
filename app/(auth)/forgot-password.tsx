import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { auth } from '@/utils/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const buttonScale = useRef(new Animated.Value(1)).current;
  const buttonColor = useRef(new Animated.Value(0)).current;

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg);
    Animated.sequence([
      Animated.timing(buttonColor, { toValue: 1, duration: 200, useNativeDriver: false }),
      Animated.delay(2000),
      Animated.timing(buttonColor, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start(() => setErrorMsg(''));
  }, [buttonColor]);

  const handleResetPassword = async () => {
    if (!email) return;

    // Validate email format and domains
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError('Please enter a valid email address!');
      return;
    }

    const endsWithUtem = email.endsWith('@student.utem.edu.my') || email.endsWith('@utem.edu.my');
    if (!endsWithUtem) {
      showError('Only UTeM emails can be reset!');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err: any) {
      console.error('[Reset Password Error]', err);
      if (err.code === 'auth/user-not-found') {
        showError('Email is not registered!');
      } else {
        showError(err.message || 'Failed to send password reset link!');
      }
    } finally {
      setLoading(false);
    }
  };

  const onPressIn = () => {
    Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();
  };

  const dynamicStyles = {
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    cardTitle: { color: isDark ? Colors.white : Colors.gray900 },
    cardDesc: { color: isDark ? Colors.gray400 : Colors.gray600 },
    inputGroup: { 
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    },
    input: { color: isDark ? Colors.white : Colors.gray900 },
  };

  return (
    <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🔑</Text>
            </View>
            <Text style={styles.appName}>UTeM Ride</Text>
            <Text style={styles.tagline}>Reset your password</Text>
          </View>

          {/* Card */}
          <View style={[styles.card, dynamicStyles.card]}>
            {!success ? (
              <>
                <Text style={[styles.cardTitle, dynamicStyles.cardTitle]}>Forgot Password</Text>
                <Text style={[styles.cardDesc, dynamicStyles.cardDesc]}>
                  Enter your registered UTeM email address below. We'll send you a link to reset your password.
                </Text>

                {/* Email Input */}
                <View style={[styles.inputGroup, dynamicStyles.inputGroup]}>
                  <Ionicons name="mail-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, dynamicStyles.input]}
                    placeholder="Email address"
                    placeholderTextColor={Colors.gray400}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                    editable={!loading}
                  />
                </View>

                {/* Email Suggestions */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.suggestionsScroll}
                  contentContainerStyle={styles.suggestionsContainer}
                >
                  {['@student.utem.edu.my', 'student.utem.edu.my', '@utem.edu.my', 'utem.edu.my'].map((suggestion) => (
                    <TouchableOpacity
                      key={suggestion}
                      style={[styles.suggestionChip, { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 }]}
                      onPress={() => {
                        if (loading) return;
                        let localPart = email;
                        if (email.includes('@')) {
                          localPart = email.split('@')[0];
                        }
                        const cleanSuggestion = suggestion.startsWith('@') ? suggestion : `@${suggestion}`;
                        setEmail(`${localPart}${cleanSuggestion}`);
                      }}
                    >
                      <Text style={[styles.suggestionText, { color: isDark ? Colors.primaryLight : Colors.primary }]}>
                        {suggestion}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Reset Button */}
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    style={[styles.actionBtn, !email && styles.btnDisabled]}
                    onPress={handleResetPassword}
                    onPressIn={onPressIn}
                    onPressOut={onPressOut}
                    disabled={loading || !email}
                    activeOpacity={0.9}
                  >
                    <Animated.View
                      style={[
                        styles.btnGradient,
                        {
                          backgroundColor: buttonColor.interpolate({
                            inputRange: [0, 1],
                            outputRange: [Colors.primary, Colors.error],
                          }),
                        },
                      ]}
                    >
                      <Text style={styles.btnText}>
                        {loading ? 'Sending link…' : errorMsg || 'Send Reset Link'}
                      </Text>
                    </Animated.View>
                  </TouchableOpacity>
                </Animated.View>
              </>
            ) : (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle-outline" size={64} color={Colors.success} style={{ marginBottom: Spacing.md }} />
                <Text style={[styles.cardTitle, dynamicStyles.cardTitle, { textAlign: 'center', marginBottom: Spacing.sm }]}>Email Sent</Text>
                <Text style={[styles.cardDesc, dynamicStyles.cardDesc, { textAlign: 'center', marginBottom: Spacing.xl }]}>
                  We have sent a password reset link to <Text style={{ fontWeight: FontWeight.bold, color: Colors.primary }}>{email}</Text>. Please check your inbox and spam folder.
                </Text>

                <TouchableOpacity
                  style={styles.backToLoginBtn}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <Text style={styles.backToLoginBtnText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Back Link */}
            {!success && (
              <View style={styles.backRow}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backLinkContainer}>
                  <Ionicons name="arrow-back-outline" size={16} color={Colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.backLinkText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    left: 0,
    top: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    marginTop: 20,
  },
  logoEmoji: { fontSize: 36 },
  appName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  tagline: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  cardTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  cardDesc: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: {
    flex: 1,
    fontSize: FontSize.md,
  },
  actionBtn: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  btnDisabled: { opacity: 0.6 },
  btnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  btnText: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  backRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  backLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backLinkText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  suggestionsScroll: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: 4,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  suggestionText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  backToLoginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    alignSelf: 'stretch',
    alignItems: 'center',
    ...Shadows.md,
  },
  backToLoginBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});
