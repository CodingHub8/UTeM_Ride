import { BorderRadius, Colors, FontSize, FontWeight, Shadows, Spacing } from '@/constants/theme';
import { Gender, useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender>('Male');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Validation errors
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateEmail = () => {
    if (!email) {
      setEmailError('');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidFormat = emailRegex.test(email);
    const endsWithUtem = email.endsWith('@student.utem.edu.my') || email.endsWith('@utem.edu.my');
    
    if (!isValidFormat) {
      setEmailError('Enter a valid email address');
    } else if (!endsWithUtem) {
      setEmailError('Only use UTeM provided email domains (@student.utem.edu.my or @utem.edu.my)');
    } else {
      setEmailError('');
    }
  };

  const validateAndFormatPhone = () => {
    if (!phone) {
      setPhoneError('');
      return;
    }
    
    // Clean all non-digit characters
    let clean = phone.replace(/\D/g, '');
    
    // If it starts with 60, strip it to get the local part
    if (clean.startsWith('60')) {
      clean = clean.substring(2);
    }
    
    // Ensure it starts with 0
    if (clean.length > 0 && !clean.startsWith('0')) {
      clean = '0' + clean;
    }
    
    // Check if it's 11 digits starting with 011
    if (clean.startsWith('011') && clean.length === 11) {
      const part1 = clean.substring(3, 7);
      const part2 = clean.substring(7);
      const formatted = `+6011-${part1} ${part2}`;
      setPhone(formatted);
      setPhoneError('');
    }
    // Check if it's 10 digits starting with 01
    else if (clean.startsWith('01') && !clean.startsWith('011') && clean.length === 10) {
      const x = clean.charAt(2);
      const part1 = clean.substring(3, 6);
      const part2 = clean.substring(6);
      const formatted = `+601${x}-${part1} ${part2}`;
      setPhone(formatted);
      setPhoneError('');
    } else {
      setPhoneError('Incorrect phone number format. E.g 011XXXXXXXX, 01XXXXXXXX');
    }
  };

  const validatePassword = () => {
    if (!password) {
      setPasswordError('');
      return;
    }
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    if (!hasMinLength) {
      setPasswordError('Must be at least 8 characters long');
    } else if (!hasUppercase) {
      setPasswordError('Must contain at least 1 uppercase letter');
    } else if (!hasLowercase) {
      setPasswordError('Must contain at least 1 lowercase letter');
    } else if (!hasNumber) {
      setPasswordError('Must contain at least 1 number');
    } else if (!hasSymbol) {
      setPasswordError('Must contain at least 1 symbol/special character');
    } else {
      setPasswordError('');
    }
  };

  const isValid = email && phone && password && password === confirmPassword && !emailError && !phoneError && !passwordError;

  const handleRegister = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      // Navigate to the next step: document upload (name will be extracted via OCR)
      router.push({
        pathname: '/(auth)/document-upload' as any,
        params: { email, phone, gender, password }
      });
    } catch {
      // error handling
    } finally {
      setLoading(false);
    }
  };

  const dynamicStyles = {
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    label: { color: isDark ? Colors.white : Colors.gray700 },
    genderBtn: { 
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    }
  };

  return (
    <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Account</Text>
            <Text style={styles.headerSub}>Join UTeM Ride today</Text>
          </View>

          {/* Card */}
          <View style={[styles.card, dynamicStyles.card]}>
            <InputField 
              icon="mail-outline" 
              placeholder="Email address" 
              value={email} 
              onChangeText={(t) => { setEmail(t); if (emailError) setEmailError(''); }} 
              keyboardType="email-address" 
              onBlur={validateEmail}
              error={emailError}
              isDark={isDark}
            />

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
                    const newEmail = `${localPart}${cleanSuggestion}`;
                    setEmail(newEmail);
                    
                    const endsWithUtem = newEmail.endsWith('@student.utem.edu.my') || newEmail.endsWith('@utem.edu.my');
                    if (!endsWithUtem) {
                      setEmailError('Only use UTeM provided email domains');
                    } else {
                      setEmailError('');
                    }
                  }}
                >
                  <Text style={[styles.suggestionText, { color: isDark ? Colors.primaryLight : Colors.primary }]}>
                    {suggestion}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <InputField 
              icon="call-outline" 
              placeholder="Phone number" 
              value={phone} 
              onChangeText={(t) => { setPhone(t); if (phoneError) setPhoneError(''); }} 
              keyboardType="phone-pad" 
              onBlur={validateAndFormatPhone}
              error={phoneError}
              isDark={isDark}
            />
            
            <InputField 
              icon="lock-closed-outline" 
              placeholder="Password" 
              value={password} 
              onChangeText={(t) => { setPassword(t); if (passwordError) setPasswordError(''); }} 
              secure 
              onBlur={validatePassword}
              error={passwordError}
              isDark={isDark}
            />
            
            <InputField
              icon="shield-checkmark-outline"
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secure
              isDark={isDark}
            />

            {/* Gender Selection */}
            <Text style={[styles.label, dynamicStyles.label]}>Gender</Text>
            <View style={styles.genderRow}>
              {(['Male', 'Female'] as Gender[]).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderBtn, dynamicStyles.genderBtn, gender === g && styles.genderBtnActive]}
                  onPress={() => setGender(g)}
                >
                  <Ionicons
                    name={g === 'Male' ? 'male' : 'female'}
                    size={18}
                    color={gender === g ? Colors.white : Colors.gray500}
                  />
                  <Text style={[styles.genderText, gender === g && styles.genderTextActive, { color: gender === g ? Colors.white : (isDark ? Colors.gray300 : Colors.gray700) }]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {password && confirmPassword && password !== confirmPassword && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}

            <TouchableOpacity
              style={[styles.registerBtn, !isValid && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading || !isValid}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>{loading ? 'Proceeding…' : 'Next: Upload Documents'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={[styles.loginLabel, dynamicStyles.subText]}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function InputField({
  icon,
  placeholder,
  value,
  onChangeText,
  keyboardType,
  secure,
  onBlur,
  error,
  isDark,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'email-address' | 'phone-pad' | 'default';
  secure?: boolean;
  onBlur?: () => void;
  error?: string;
  isDark: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);

  const dynamicStyles = {
    inputGroup: {
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      borderColor: error ? Colors.error : (isDark ? Colors.darkBorder : Colors.gray200),
    },
    input: {
      color: isDark ? Colors.white : Colors.gray900,
    }
  };

  return (
    <View style={{ marginBottom: Spacing.md }}>
      <View style={[styles.inputGroup, dynamicStyles.inputGroup]}>
        <Ionicons name={icon} size={20} color={Colors.gray400} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, dynamicStyles.input]}
          placeholder={placeholder}
          placeholderTextColor={Colors.gray400}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType ?? 'default'}
          secureTextEntry={secure && !showPassword}
          autoCapitalize={secure || keyboardType === 'email-address' ? 'none' : 'sentences'}
          onBlur={onBlur}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.gray400} />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.inputError}>{error}</Text> : null}
    </View>
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
    marginBottom: Spacing.xl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  headerSub: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.lg,
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
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  inputError: {
    color: Colors.error,
    fontSize: FontSize.xs,
    marginTop: 4,
    marginLeft: Spacing.xs,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  genderRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  genderBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genderText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  genderTextActive: {
    fontWeight: FontWeight.bold,
  },
  registerBtn: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
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
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginLabel: {
    fontSize: FontSize.sm,
  },
  loginLink: {
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
