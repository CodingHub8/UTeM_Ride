import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function DriverProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, switchRole } = useAuth();

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={36} color={Colors.darkBg} />
        </View>
        <Text style={styles.name}>{user?.name ?? 'Driver'}</Text>
        <Text style={styles.email}>{user?.email ?? 'driver@utem.edu.my'}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name="car-sport" size={14} color={Colors.accent} />
          <Text style={styles.roleText}>Driver</Text>
        </View>
      </View>

      {/* Vehicle info */}
      <Text style={styles.sectionTitle}>Vehicle Information</Text>
      <View style={styles.card}>
        <DriverRow icon="car" label="Vehicle" value="Perodua Myvi 2023" />
        <DriverRow icon="document-text" label="Plate Number" value="WKL 2847" />
        <DriverRow icon="color-palette" label="Color" value="White" last />
      </View>

      {/* License */}
      <Text style={styles.sectionTitle}>License & Documents</Text>
      <View style={styles.card}>
        <DriverRow icon="card" label="Driving License" value="Active" valueColor={Colors.success} />
        <DriverRow icon="shield-checkmark" label="Insurance" value="Verified" valueColor={Colors.success} />
        <DriverRow icon="document" label="Vehicle Registration" value="Verified" valueColor={Colors.success} last />
      </View>

      {/* Account */}
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.card}>
        <DriverRow icon="person-outline" label="Full Name" value={user?.name ?? 'Driver'} />
        <DriverRow icon="mail-outline" label="Email" value={user?.email ?? 'driver@utem.edu.my'} />
        <DriverRow icon="call-outline" label="Phone" value={user?.phone ?? '+60123456789'} last />
      </View>

      {/* Switch & Logout */}
      <TouchableOpacity style={styles.switchBtn} onPress={() => { switchRole(); router.replace('/(passenger)/home'); }}>
        <Ionicons name="swap-horizontal" size={20} color={Colors.primary} />
        <Text style={styles.switchText}>Switch to Passenger Mode</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => { logout(); router.replace('/(auth)/login'); }}>
        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function DriverRow({ icon, label, value, valueColor, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; valueColor?: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Ionicons name={icon} size={20} color={Colors.gray400} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  content: { paddingBottom: Spacing.xxl },
  profileHeader: { alignItems: 'center', paddingVertical: Spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  name: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
  email: { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 2 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accent + '20', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 4, marginTop: Spacing.sm },
  roleText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.accent },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.darkCard, marginHorizontal: Spacing.md, borderRadius: BorderRadius.lg },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.darkBorder },
  rowInfo: { marginLeft: Spacing.md, flex: 1 },
  rowLabel: { fontSize: FontSize.xs, color: Colors.gray400 },
  rowValue: { fontSize: FontSize.md, color: Colors.white, fontWeight: FontWeight.medium, marginTop: 1 },
  switchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary + '15', marginHorizontal: Spacing.md, borderRadius: BorderRadius.md, paddingVertical: 14, marginTop: Spacing.xl },
  switchText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginHorizontal: Spacing.md, borderRadius: BorderRadius.md, paddingVertical: 14, marginTop: Spacing.sm },
  logoutText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.error },
});
