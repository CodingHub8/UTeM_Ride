import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useState } from 'react';
import TwoFactorModal from '@/components/TwoFactorModal';

export default function PassengerProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, switchRole } = useAuth();
  const { themeMode, setTheme, isDark } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [show2FA, setShow2FA] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    border: { borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 },
  };

  return (
    <ScrollView
      style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
    >
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={36} color={Colors.white} />
        </View>
        <Text style={[styles.name, dynamicStyles.text]}>{user?.name ?? 'Guest'}</Text>
        <Text style={[styles.email, dynamicStyles.subText]}>{user?.email ?? 'guest@utem.edu.my'}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name="car" size={14} color={Colors.primary} />
          <Text style={styles.roleText}>Passenger</Text>
        </View>
      </View>

      {/* Personal Info */}
      <Text style={styles.sectionTitle}>Personal Information</Text>
      <View style={[styles.card, dynamicStyles.card]}>
        <ProfileRow icon="person-outline" label="Full Name" value={user?.name ?? 'Guest'} isDark={isDark} />
        <ProfileRow icon="mail-outline" label="Email" value={user?.email ?? 'guest@utem.edu.my'} isDark={isDark} />
        <ProfileRow icon="call-outline" label="Phone" value={user?.phone ?? '+60123456789'} isDark={isDark} />
        <ProfileRow icon="people-outline" label="Gender" value={user?.gender ?? 'Male'} isDark={isDark} last />
      </View>

      {/* Payment & E-Wallet */}
      <Text style={styles.sectionTitle}>Payment & E-Wallet</Text>
      <View style={[styles.card, dynamicStyles.card]}>
        <TouchableOpacity style={[styles.addBtn, { borderBottomWidth: 1, borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 }]} onPress={() => router.push('/(passenger)/wallet' as never)}>
          <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
          <Text style={styles.addBtnText}>My Passenger E-Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(passenger)/payment-history' as never)}>
          <Ionicons name="receipt-outline" size={20} color={Colors.primary} />
          <Text style={styles.addBtnText}>Payment History & Receipts</Text>
        </TouchableOpacity>
      </View>

      {/* Security */}
      <Text style={styles.sectionTitle}>Security</Text>
      <View style={[styles.card, dynamicStyles.card]}>
        <TouchableOpacity
          style={[styles.settingRow, dynamicStyles.border]}
          onPress={() => {
            if (!user?.is_2FA_verified) setShow2FA(true);
          }}
          activeOpacity={user?.is_2FA_verified ? 1 : 0.7}
        >
          <View style={styles.settingLeft}>
            <Ionicons name="shield-checkmark-outline" size={20} color={user?.is_2FA_verified ? Colors.success : Colors.warning} />
            <Text style={[styles.settingLabel, dynamicStyles.text]}>Two-Factor Authentication</Text>
          </View>
          <Text style={{ color: user?.is_2FA_verified ? Colors.success : Colors.warning, fontWeight: FontWeight.semibold, fontSize: FontSize.sm }}>
            {user?.is_2FA_verified ? 'Verified ✓' : 'Verify now'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Settings */}
      <Text style={styles.sectionTitle}>Settings</Text>
      <View style={[styles.card, dynamicStyles.card]}>
        <View style={[styles.settingRow, dynamicStyles.border, { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.sm }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={styles.settingLeft}>
              <Ionicons name="color-palette-outline" size={20} color={isDark ? Colors.gray300 : Colors.gray600} />
              <Text style={[styles.settingLabel, dynamicStyles.text]}>Theme</Text>
            </View>
          </View>
          
          <View style={styles.themeSelectorGroup}>
            {(['system', 'light', 'dark'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.themeSelectorBtn,
                  { backgroundColor: isDark ? Colors.gray900 : Colors.gray50 },
                  themeMode === mode && { backgroundColor: Colors.primary }
                ]}
                onPress={() => setTheme(mode)}
              >
                <Text
                  style={[
                    styles.themeSelectorText,
                    { color: isDark ? Colors.gray400 : Colors.gray600 },
                    themeMode === mode && { color: Colors.white, fontWeight: 'bold' }
                  ]}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={[styles.settingRow, dynamicStyles.border]}>
          <View style={styles.settingLeft}>
            <Ionicons name="notifications-outline" size={20} color={isDark ? Colors.gray300 : Colors.gray600} />
            <Text style={[styles.settingLabel, dynamicStyles.text]}>Notifications</Text>
          </View>
          <Switch value={notifications} onValueChange={setNotifications} trackColor={{ true: Colors.primary }} />
        </View>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => router.push('/(passenger)/support')}
        >
          <View style={styles.settingLeft}>
            <Ionicons name="help-circle-outline" size={20} color={isDark ? Colors.gray300 : Colors.gray600} />
            <Text style={[styles.settingLabel, dynamicStyles.text]}>Help & Support (FAQ)</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={isDark ? Colors.gray500 : Colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* Switch & Logout */}
      <TouchableOpacity style={styles.switchBtn} onPress={() => { switchRole(); router.replace('/(driver)/home'); }}>
        <Ionicons name="swap-horizontal" size={20} color={Colors.primary} />
        <Text style={styles.switchText}>Switch to Driver Mode</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      {user && (
        <TwoFactorModal
          visible={show2FA}
          onClose={() => setShow2FA(false)}
          userId={user.id}
          email={user.email}
          phoneNumber={user.phone}
          onVerified={() => {}}
          isDark={isDark}
        />
      )}
    </ScrollView>
  );
}

function ProfileRow({
  icon,
  label,
  value,
  isDark,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isDark: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 }]}>
      <Ionicons name={icon} size={20} color={isDark ? Colors.gray400 : Colors.gray500} />
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: isDark ? Colors.gray400 : Colors.gray500 }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: isDark ? Colors.white : Colors.gray900 }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  profileHeader: { alignItems: 'center', marginVertical: Spacing.sm },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    ...Shadows.md,
  },
  name: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginBottom: 2 },
  email: { fontSize: FontSize.sm, marginBottom: Spacing.xs },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  roleText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.primary },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.xs,
  },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.sm, ...Shadows.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xs },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: FontSize.xs },
  rowValue: { fontSize: FontSize.md, fontWeight: FontWeight.medium, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xs },
  addBtnText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.medium },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.xs },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  settingLabel: { fontSize: FontSize.md },
  themeSelectorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingTop: 2,
  },
  themeSelectorBtn: {
    flex: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeSelectorText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginTop: Spacing.sm,
  },
  switchText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.primary },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.error + '10',
  },
  logoutText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.error },
});
