import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { sendOtpCode, verifyOtpCode, OtpChannel } from '@/utils/twoFactor';

interface TwoFactorModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  email: string;
  phoneNumber?: string;
  onVerified: () => void;
  isDark: boolean;
}

export default function TwoFactorModal({
  visible,
  onClose,
  userId,
  email,
  phoneNumber = '',
  onVerified,
  isDark,
}: TwoFactorModalProps) {
  const [channel, setChannel] = useState<OtpChannel>('email');
  const [phoneInput, setPhoneInput] = useState(phoneNumber);
  const [emailInput, setEmailInput] = useState(email);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const dynamic = {
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    sub: { color: isDark ? Colors.gray400 : Colors.gray500 },
    input: {
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      color: isDark ? Colors.white : Colors.gray900,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    },
    tabInactive: {
      backgroundColor: isDark ? Colors.gray900 : Colors.gray100,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    },
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    if (visible) {
      setEmailInput(email);
      setPhoneInput(phoneNumber);
      setCode('');
      setOtpSent(false);
      setResendTimer(0);
    }
  }, [visible, email, phoneNumber]);

  const handleSendOtp = async () => {
    const destination = channel === 'email' ? emailInput : phoneInput;
    if (!destination || destination.trim().length === 0) {
      Alert.alert(
        'Missing Destination',
        `Please enter a valid ${channel === 'email' ? 'UTeM email address' : 'mobile phone number'}.`
      );
      return;
    }

    setLoading(true);
    try {
      const result = await sendOtpCode(userId, channel, destination);
      setOtpSent(true);
      setResendTimer(60);

      Alert.alert(
        '2FA Verification Code Sent 📲',
        `A 6-digit verification code has been dispatched to ${destination.trim()} via ${channel === 'email' ? 'UTeM Email' : 'SMS/WhatsApp'}.\n\nPlease check your inbox/messages and enter the code below.`
      );
    } catch (e: any) {
      Alert.alert('Send Error', e.message || 'Could not send OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit OTP code.');
      return;
    }

    setLoading(true);
    try {
      await verifyOtpCode(userId, code);
      setCode('');
      onVerified();
      onClose();
      Alert.alert('Success 🎉', 'Two-Factor Authentication (2FA) is now verified and enabled for your account.');
    } catch (e: any) {
      Alert.alert('Verification Failed', e.message || 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, dynamic.card]}>
            <View style={styles.headerRow}>
              <Ionicons name="shield-checkmark" size={28} color={Colors.primary} />
              <Text style={[styles.title, dynamic.text]}>2FA Security Verification</Text>
            </View>

            <Text style={[styles.sub, dynamic.sub]}>
              Select your preferred channel to receive a 6-digit security OTP code:
            </Text>

            {/* Channel Tabs */}
            <View style={styles.channelContainer}>
              <TouchableOpacity
                style={[
                  styles.channelTab,
                  channel === 'email' ? styles.channelTabActive : dynamic.tabInactive,
                ]}
                onPress={() => setChannel('email')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={channel === 'email' ? Colors.white : isDark ? Colors.gray300 : Colors.gray700}
                />
                <Text
                  style={[
                    styles.channelTabText,
                    channel === 'email' ? styles.channelTabTextActive : dynamic.sub,
                  ]}
                >
                  UTeM Email
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.channelTab,
                  channel === 'sms' ? styles.channelTabActive : dynamic.tabInactive,
                ]}
                onPress={() => setChannel('sms')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chatbox-ellipses-outline"
                  size={18}
                  color={channel === 'sms' ? Colors.white : isDark ? Colors.gray300 : Colors.gray700}
                />
                <Text
                  style={[
                    styles.channelTabText,
                    channel === 'sms' ? styles.channelTabTextActive : dynamic.sub,
                  ]}
                >
                  SMS / WhatsApp
                </Text>
              </TouchableOpacity>
            </View>

            {/* Destination Input Field */}
            {channel === 'email' ? (
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, dynamic.sub]}>UTeM Student / Staff Email</Text>
                <TextInput
                  style={[styles.input, dynamic.input]}
                  value={emailInput}
                  onChangeText={setEmailInput}
                  placeholder="name@student.utem.edu.my"
                  placeholderTextColor={Colors.gray400}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            ) : (
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, dynamic.sub]}>Mobile Phone Number (SMS/WhatsApp)</Text>
                <TextInput
                  style={[styles.input, dynamic.input]}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  placeholder="+60123456789"
                  placeholderTextColor={Colors.gray400}
                  keyboardType="phone-pad"
                />
              </View>
            )}

            {/* Send OTP Button */}
            <TouchableOpacity
              style={[styles.sendBtn, resendTimer > 0 && styles.disabledBtn]}
              onPress={handleSendOtp}
              disabled={loading || resendTimer > 0}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.sendBtnText}>
                  {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : otpSent ? 'Resend 6-Digit OTP' : 'Send 6-Digit OTP Code'}
                </Text>
              )}
            </TouchableOpacity>

            {/* OTP Code Input */}
            <View style={[styles.fieldGroup, { marginTop: Spacing.md }]}>
              <Text style={[styles.label, dynamic.sub]}>Enter 6-Digit OTP Code</Text>
              <TextInput
                style={[styles.otpInput, dynamic.input]}
                value={code}
                onChangeText={setCode}
                placeholder="──────"
                placeholderTextColor={Colors.gray400}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            {/* Verify Button */}
            <TouchableOpacity style={styles.primaryBtn} onPress={handleVerify} disabled={loading || code.length < 6}>
              {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryText}>Verify & Enable 2FA</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={[styles.cancelText, dynamic.sub]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  sub: { fontSize: FontSize.sm, marginBottom: Spacing.md, lineHeight: 20 },
  channelContainer: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  channelTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  channelTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  channelTabText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  channelTabTextActive: { color: Colors.white, fontWeight: FontWeight.bold },
  fieldGroup: { marginBottom: Spacing.xs },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginBottom: 4 },
  input: {
    height: 46,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    fontSize: FontSize.md,
  },
  otpInput: {
    height: 52,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    fontSize: FontSize.xl,
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: FontWeight.bold,
  },
  sendBtn: {
    backgroundColor: Colors.info,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sendBtnText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  disabledBtn: { opacity: 0.6 },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  primaryText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  cancelBtn: { alignItems: 'center', marginTop: Spacing.md },
  cancelText: { fontSize: FontSize.sm },
});
