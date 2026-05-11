import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = name && email && phone && password && password === confirmPassword;

  const handleRegister = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await register(name, email, phone, password);
      router.replace('/(auth)/role-select');
    } catch {
      // TODO: error handling
    } finally {
      setLoading(false);
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
          <View style={styles.card}>
            <InputField icon="person-outline" placeholder="Full name" value={name} onChangeText={setName} />
            <InputField icon="mail-outline" placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <InputField icon="call-outline" placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <InputField icon="lock-closed-outline" placeholder="Password" value={password} onChangeText={setPassword} secure />
            <InputField
              icon="shield-checkmark-outline"
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secure
            />

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
                <Text style={styles.btnText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginLabel}>Already have an account? </Text>
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'email-address' | 'phone-pad' | 'default';
  secure?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Ionicons name={icon} size={20} color={Colors.gray400} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.gray400}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        secureTextEntry={secure}
        autoCapitalize={secure || keyboardType === 'email-address' ? 'none' : 'words'}
      />
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
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray200,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.gray900,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
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
    color: Colors.gray500,
  },
  loginLink: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
});
