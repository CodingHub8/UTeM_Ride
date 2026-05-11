import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';

const TRANSACTIONS = [
  { id: '1', type: 'trip', label: 'Trip to Melaka Sentral', amount: '+RM 5.50', time: '2:30 PM' },
  { id: '2', type: 'trip', label: 'Trip to Dataran Pahlawan', amount: '+RM 4.00', time: '1:15 PM' },
  { id: '3', type: 'trip', label: 'Trip to AEON Bandaraya', amount: '+RM 7.00', time: '11:40 AM' },
  { id: '4', type: 'withdrawal', label: 'Withdrawal to Bank', amount: '-RM 50.00', time: 'Yesterday' },
  { id: '5', type: 'trip', label: 'Trip to UTeM Campus', amount: '+RM 6.50', time: 'Yesterday' },
  { id: '6', type: 'trip', label: 'Trip to Hospital Melaka', amount: '+RM 8.00', time: 'Yesterday' },
];

export default function WalletScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wallet</Text>
      </View>

      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceValue}>RM 125.50</Text>
        <View style={styles.balanceStats}>
          <View style={styles.balanceStat}>
            <Text style={styles.bStatValue}>RM 45.50</Text>
            <Text style={styles.bStatLabel}>Today</Text>
          </View>
          <View style={styles.balanceStatDivider} />
          <View style={styles.balanceStat}>
            <Text style={styles.bStatValue}>RM 230.00</Text>
            <Text style={styles.bStatLabel}>This Week</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.withdrawBtn}>
          <Ionicons name="arrow-down-circle" size={20} color={Colors.darkBg} />
          <Text style={styles.withdrawText}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      {/* Today's trips */}
      <View style={styles.todayCard}>
        <View style={styles.todayRow}>
          <View style={styles.todayItem}>
            <Ionicons name="car" size={22} color={Colors.accent} />
            <Text style={styles.todayValue}>6</Text>
            <Text style={styles.todayLabel}>Trips</Text>
          </View>
          <View style={styles.todayItem}>
            <Ionicons name="time" size={22} color={Colors.accent} />
            <Text style={styles.todayValue}>4.2h</Text>
            <Text style={styles.todayLabel}>Online</Text>
          </View>
          <View style={styles.todayItem}>
            <Ionicons name="navigate" size={22} color={Colors.accent} />
            <Text style={styles.todayValue}>38 km</Text>
            <Text style={styles.todayLabel}>Driven</Text>
          </View>
        </View>
      </View>

      {/* Transaction history */}
      <Text style={styles.sectionTitle}>Transaction History</Text>
      <FlatList
        data={TRANSACTIONS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.txList}
        renderItem={({ item }) => (
          <View style={styles.txRow}>
            <View style={[styles.txIcon, item.type === 'withdrawal' && styles.txIconWithdraw]}>
              <Ionicons
                name={item.type === 'trip' ? 'car' : 'arrow-down'}
                size={18}
                color={item.type === 'trip' ? Colors.accent : Colors.error}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.txLabel}>{item.label}</Text>
              <Text style={styles.txTime}>{item.time}</Text>
            </View>
            <Text style={[styles.txAmount, item.type === 'withdrawal' && styles.txAmountNeg]}>
              {item.amount}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.white },
  balanceCard: { marginHorizontal: Spacing.md, backgroundColor: Colors.accent, borderRadius: BorderRadius.xl, padding: Spacing.lg },
  balanceLabel: { fontSize: FontSize.sm, color: 'rgba(0,0,0,0.5)', fontWeight: FontWeight.medium },
  balanceValue: { fontSize: 40, fontWeight: FontWeight.bold, color: Colors.darkBg, marginTop: 4 },
  balanceStats: { flexDirection: 'row', marginTop: Spacing.md, gap: Spacing.lg },
  balanceStat: {},
  balanceStatDivider: { width: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  bStatValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.darkBg },
  bStatLabel: { fontSize: FontSize.xs, color: 'rgba(0,0,0,0.5)' },
  withdrawBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.darkBg, borderRadius: BorderRadius.md, paddingVertical: 12, marginTop: Spacing.lg },
  withdrawText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.accent },
  todayCard: { marginHorizontal: Spacing.md, marginTop: Spacing.md, backgroundColor: Colors.darkCard, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  todayRow: { flexDirection: 'row', justifyContent: 'space-around' },
  todayItem: { alignItems: 'center', gap: 4 },
  todayValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.white },
  todayLabel: { fontSize: FontSize.xs, color: Colors.gray400 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  txList: { paddingHorizontal: Spacing.md },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.darkCard, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  txIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.accent + '20', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  txIconWithdraw: { backgroundColor: Colors.error + '20' },
  txLabel: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.white },
  txTime: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2 },
  txAmount: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.success },
  txAmountNeg: { color: Colors.error },
});
