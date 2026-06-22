import { useState, useEffect, useCallback } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { setupTotpAuthenticator, verifyTotpCode } from '@/utils/twoFactor';

interface TwoFactorModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  email: string;
  onVerified: () => void;
  isDark: boolean;
}

export default function TwoFactorModal({ visible, onClose, userId, email, onVerified, isDark }: TwoFactorModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [manualSecret, setManualSecret] = useState('');
  const [copied, setCopied] = useState(false);

  const dynamic = {
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    sub: { color: isDark ? Colors.gray400 : Colors.gray500 },
    input: {
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      color: isDark ? Colors.white : Colors.gray900,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    },
    secretBox: {
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    },
  };

  const loadSetup = useCallback(async () => {
    setLoading(true);
    try {
      const setup = await setupTotpAuthenticator(userId, email);
      setOtpauthUrl(setup.otpauthUrl);
      setManualSecret(setup.secret);
    } catch (e: any) {
      Alert.alert('Setup Error', e.message || 'Could not start authenticator setup.');
    } finally {
      setLoading(false);
    }
  }, [userId, email]);

  useEffect(() => {
    if (visible) {
      void loadSetup();
    } else {
      setCode('');
      setOtpauthUrl('');
      setManualSecret('');
      setCopied(false);
    }
  }, [visible, loadSetup]);

  const copyManualKey = async () => {
    if (!manualSecret) return;
    await Clipboard.setStringAsync(manualSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const verify = async () => {
    if (code.length < 6) {
      Alert.alert('Invalid Code', 'Enter the 6-digit code from Google Authenticator.');
      return;
    }
    setLoading(true);
    try {
      await verifyTotpCode(userId, code);
      setCode('');
      onVerified();
      onClose();
      Alert.alert('Verified', 'Google Authenticator is linked to your account.');
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
            <Text style={[styles.title, dynamic.text]}>Set up Google Authenticator</Text>
            <Text style={[styles.sub, dynamic.sub]}>
              1. Install Google Authenticator{'\n'}
              2. Tap + → Scan QR code{'\n'}
              3. Enter the 6-digit code below
            </Text>

            {loading && !otpauthUrl ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.lg }} />
            ) : otpauthUrl ? (
              <View style={styles.qrWrap}>
                <QRCode value={otpauthUrl} size={200} />
              </View>
            ) : null}

            {manualSecret ? (
              <TouchableOpacity
                style={[styles.secretBox, dynamic.secretBox]}
                onPress={copyManualKey}
                activeOpacity={0.7}
              >
                <View style={styles.secretHeader}>
                  <Text style={[styles.secretLabel, dynamic.sub]}>Manual key (tap to copy)</Text>
                  <Ionicons
                    name={copied ? 'checkmark-circle' : 'copy-outline'}
                    size={16}
                    color={copied ? Colors.success : Colors.primary}
                  />
                </View>
                <Text style={[styles.secretValue, dynamic.text]}>{manualSecret}</Text>
                {copied ? <Text style={styles.copiedText}>Copied to clipboard</Text> : null}
              </TouchableOpacity>
            ) : null}

            <TextInput
              style={[styles.input, dynamic.input]}
              value={code}
              onChangeText={setCode}
              placeholder="6-digit code"
              placeholderTextColor={Colors.gray400}
              keyboardType="number-pad"
              maxLength={6}
            />

            <TouchableOpacity style={styles.primaryBtn} onPress={verify} disabled={loading}>
              {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryText}>Verify & Enable</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={loadSetup} disabled={loading}>
              <Text style={styles.linkText}>Refresh QR code</Text>
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
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginBottom: Spacing.xs },
  sub: { fontSize: FontSize.sm, marginBottom: Spacing.md, lineHeight: 20 },
  qrWrap: { alignItems: 'center', marginBottom: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md },
  secretBox: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.md },
  secretHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  secretLabel: { fontSize: FontSize.xs },
  secretValue: { fontSize: FontSize.sm, letterSpacing: 1, fontWeight: FontWeight.semibold },
  copiedText: { fontSize: FontSize.xs, color: Colors.success, marginTop: 6, fontWeight: FontWeight.semibold },
  input: { height: 48, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, marginBottom: Spacing.md, fontSize: FontSize.lg, letterSpacing: 4, textAlign: 'center' },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  linkBtn: { alignItems: 'center', marginTop: Spacing.sm, paddingVertical: 8 },
  linkText: { color: Colors.primary, fontWeight: FontWeight.semibold },
  cancelBtn: { alignItems: 'center', marginTop: Spacing.md },
  cancelText: { fontSize: FontSize.sm },
});
