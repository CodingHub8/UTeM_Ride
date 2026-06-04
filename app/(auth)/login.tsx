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
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { isDark } = useTheme();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const buttonScale = useRef(new Animated.Value(1)).current;
  const buttonColor = useRef(new Animated.Value(0)).current;

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg);
    Animated.sequence([
      Animated.timing(buttonColor, { toValue: 1, duration: 200, useNativeDriver: false }),
      Animated.delay(1000),
      Animated.timing(buttonColor, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start(() => setErrorMsg(''));
  }, [buttonColor]);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setErrorMsg('');
    try {
      await login(email, password);
      router.replace('/(auth)/role-select');
    } catch {
      showError('Incorrect email/password!');
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
    inputGroup: { 
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    },
    input: { color: isDark ? Colors.white : Colors.gray900 },
    signupLabel: { color: isDark ? Colors.gray400 : Colors.gray500 },
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
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🚗</Text>
            </View>
            <Text style={styles.appName}>UTeM Ride</Text>
            <Text style={styles.tagline}>Welcome back</Text>
          </View>

          {/* Card */}
          <View style={[styles.card, dynamicStyles.card]}>
            <Text style={[styles.cardTitle, dynamicStyles.cardTitle]}>Sign In</Text>

            {/* Email */}
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

            {/* Password */}
            <View style={[styles.inputGroup, dynamicStyles.inputGroup]}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, dynamicStyles.input]}
                placeholder="Password"
                placeholderTextColor={Colors.gray400}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.gray400} />
              </TouchableOpacity>
            </View>

            {/* Forgot */}
            <TouchableOpacity style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={[styles.loginBtn, (!email || !password) && styles.loginBtnDisabled]}
                onPress={handleLogin}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                disabled={loading || !email || !password}
                activeOpacity={0.9}
              >
                <Animated.View
                  style={[
                    styles.loginGradient,
                    {
                      backgroundColor: buttonColor.interpolate({
                        inputRange: [0, 1],
                        outputRange: [Colors.primary, Colors.error],
                      }),
                    },
                  ]}
                >
                  <Text style={styles.loginBtnText}>
                    {loading ? 'Signing in…' : errorMsg || 'Sign In'}
                  </Text>
                </Animated.View>
              </TouchableOpacity>
            </Animated.View>

            {/* Sign Up Link */}
            <View style={styles.signupRow}>
              <Text style={[styles.signupLabel, dynamicStyles.signupLabel]}>{"Don't have an account? "}</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
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
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
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
  eyeBtn: { padding: 4 },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.lg,
  },
  forgotText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  loginBtn: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  loginBtnText: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupLabel: {
    fontSize: FontSize.sm,
  },
  signupLink: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  suggestionsScroll: {
    marginTop: -Spacing.sm,
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
});
