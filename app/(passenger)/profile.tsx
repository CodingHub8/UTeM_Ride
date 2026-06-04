import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useState } from 'react';

export default function PassengerProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, switchRole } = useAuth();
  const { themeMode, setTheme, isDark, colors } = useTheme();
  const [notifications, setNotifications] = useState(true);

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    border: { borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 },
  };

  return (
    <ScrollView style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
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

      {/* Payment */}
      <Text style={styles.sectionTitle}>Payment Methods</Text>
      <View style={[styles.card, dynamicStyles.card]}>
        <ProfileRow icon="wallet-outline" label="Cash" value="Default" isDark={isDark} />
        <TouchableOpacity style={styles.addBtn}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.addBtnText}>Add Payment Method</Text>
        </TouchableOpacity>
      </View>

      {/* Saved Addresses */}
      <Text style={styles.sectionTitle}>Saved Addresses</Text>
      <View style={[styles.card, dynamicStyles.card]}>
        <ProfileRow icon="home-outline" label="Home" value="Not set" isDark={isDark} />
        <ProfileRow icon="business-outline" label="Campus" value="UTeM Main Campus" isDark={isDark} last />
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
      </View>

      {/* Switch & Logout */}
      <TouchableOpacity style={styles.switchBtn} onPress={() => { switchRole(); router.replace('/(driver)/home'); }}>
        <Ionicons name="swap-horizontal" size={20} color={Colors.accent} />
        <Text style={styles.switchText}>Switch to Driver Mode</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => { logout(); router.replace('/(auth)/login'); }}>
        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ProfileRow({ icon, label, value, last, isDark }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean; isDark: boolean }) {
  return (
    <View style={[styles.profileRow, !last && { borderBottomWidth: 1, borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 }]}>
      <Ionicons name={icon} size={20} color={isDark ? Colors.gray500 : Colors.gray400} />
      <View style={styles.profileRowInfo}>
        <Text style={styles.profileRowLabel}>{label}</Text>
        <Text style={[styles.profileRowValue, { color: isDark ? Colors.white : Colors.gray900 }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: Spacing.xxl },
  profileHeader: { alignItems: 'center', paddingVertical: Spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  name: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  email: { fontSize: FontSize.sm, marginTop: 2 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '12', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 4, marginTop: Spacing.sm },
  roleText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  card: { marginHorizontal: Spacing.md, borderRadius: BorderRadius.lg, ...Shadows.sm },
  profileRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  profileRowInfo: { marginLeft: Spacing.md, flex: 1 },
  profileRowLabel: { fontSize: FontSize.xs, color: Colors.gray400 },
  profileRowValue: { fontSize: FontSize.md, fontWeight: FontWeight.medium, marginTop: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.md },
  addBtnText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.medium },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  settingLabel: { fontSize: FontSize.md },
  switchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.accent + '15', marginHorizontal: Spacing.md, borderRadius: BorderRadius.md, paddingVertical: 14, marginTop: Spacing.xl },
  switchText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.accent },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginHorizontal: Spacing.md, borderRadius: BorderRadius.md, paddingVertical: 14, marginTop: Spacing.sm },
  logoutText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.error },
  themeSelectorGroup: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  themeSelectorBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeSelectorText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
