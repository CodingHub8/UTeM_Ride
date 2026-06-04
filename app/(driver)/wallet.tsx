import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useState } from 'react';

interface PassengerDetails {
  name: string;
  username: string;
  email: string;
  phone: string;
  gender: string;
}

interface RouteInfo {
  pickup: string;
  destination: string;
}

interface Transaction {
  id: string;
  type: 'trip' | 'withdrawal';
  label: string;
  amount: string;
  time: string;
  route?: RouteInfo;
  passenger?: PassengerDetails;
}

const TRANSACTIONS: Transaction[] = [
  {
    id: 'tx1',
    type: 'trip',
    label: 'Trip payment from passenger',
    amount: 'RM 12.50',
    time: 'Today, 2:30 pm',
    route: {
      pickup: 'FTMK, UTeM Main Campus',
      destination: 'Melaka Sentral Bus Terminal',
    },
    passenger: {
      name: 'Muhammad Haziq',
      username: 'haziq_utem',
      email: 'b032110123@student.utem.edu.my',
      phone: '+6011-2345 6789',
      gender: 'Male',
    }
  },
  {
    id: 'tx2',
    type: 'withdrawal',
    label: 'Withdrawal to Maybank',
    amount: '-RM 50.00',
    time: 'Yesterday, 10:15 am',
  },
  {
    id: 'tx3',
    type: 'trip',
    label: 'Trip payment from passenger',
    amount: 'RM 15.00',
    time: 'Yesterday, 8:45 am',
    route: {
      pickup: 'UTeM Technology Campus',
      destination: 'AEON Bandaraya Melaka',
    },
    passenger: {
      name: 'Alicia Tan Wei',
      username: 'alicia_tan',
      email: 'b032110456@student.utem.edu.my',
      phone: '+6012-345 6789',
      gender: 'Female',
    }
  }
];

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const [selectedPassenger, setSelectedPassenger] = useState<PassengerDetails | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleOpenPassenger = (passenger: PassengerDetails) => {
    setSelectedPassenger(passenger);
    setModalVisible(true);
  };

  const handleClosePassenger = () => {
    setSelectedPassenger(null);
    setModalVisible(false);
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    headerTitle: { color: isDark ? Colors.white : Colors.gray900 },
    todayCard: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    todayValue: { color: isDark ? Colors.white : Colors.gray900 },
    todayLabel: { color: isDark ? Colors.gray400 : Colors.gray500 },
    txRow: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    txLabel: { color: isDark ? Colors.white : Colors.gray900 },
    txTime: { color: isDark ? Colors.gray400 : Colors.gray500 },
    modalOverlay: { backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    modalTitle: { color: isDark ? Colors.white : Colors.gray900 },
    modalText: { color: isDark ? Colors.white : Colors.gray800 },
    modalLabel: { color: isDark ? Colors.gray400 : Colors.gray500 },
    modalDivider: { backgroundColor: isDark ? Colors.darkBorder : Colors.gray200 },
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>Wallet</Text>
      </View>

      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceValue}>RM 27.50</Text>
        <View style={styles.balanceStats}>
          <View style={styles.balanceStat}>
            <Text style={styles.bStatValue}>RM 12.50</Text>
            <Text style={styles.bStatLabel}>Today</Text>
          </View>
          <View style={styles.balanceStatDivider} />
          <View style={styles.balanceStat}>
            <Text style={styles.bStatValue}>RM 27.50</Text>
            <Text style={styles.bStatLabel}>This Week</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.withdrawBtn}>
          <Ionicons name="arrow-down-circle" size={20} color={Colors.white} />
          <Text style={styles.withdrawText}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      {/* Today's stats */}
      <View style={[styles.todayCard, dynamicStyles.todayCard]}>
        <View style={styles.todayRow}>
          <View style={styles.todayItem}>
            <Ionicons name="car" size={22} color={Colors.primary} />
            <Text style={[styles.todayValue, dynamicStyles.todayValue]}>1</Text>
            <Text style={[styles.todayLabel, dynamicStyles.todayLabel]}>Trip</Text>
          </View>
          <View style={styles.todayItem}>
            <Ionicons name="time" size={22} color={Colors.primary} />
            <Text style={[styles.todayValue, dynamicStyles.todayValue]}>1.5h</Text>
            <Text style={[styles.todayLabel, dynamicStyles.todayLabel]}>Online</Text>
          </View>
          <View style={styles.todayItem}>
            <Ionicons name="navigate" size={22} color={Colors.primary} />
            <Text style={[styles.todayValue, dynamicStyles.todayValue]}>18 km</Text>
            <Text style={[styles.todayLabel, dynamicStyles.todayLabel]}>Driven</Text>
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
          <View style={[styles.txRow, dynamicStyles.txRow]}>
            <View style={[styles.txIcon, item.type === 'withdrawal' && styles.txIconWithdraw]}>
              <Ionicons
                name={item.type === 'trip' ? 'car' : 'arrow-down'}
                size={18}
                color={item.type === 'trip' ? Colors.primary : Colors.error}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.txLabel, dynamicStyles.txLabel]}>{item.label}</Text>
              
              {item.passenger && (
                <TouchableOpacity 
                  style={styles.passengerBadge}
                  onPress={() => handleOpenPassenger(item.passenger!)}
                >
                  <Text style={styles.passengerText}>@{item.passenger.username}</Text>
                </TouchableOpacity>
              )}

              {item.route && (
                <Text style={[styles.routeInfoText, dynamicStyles.txTime]}>
                  {item.route.pickup} ➔ {item.route.destination}
                </Text>
              )}

              <Text style={[styles.txTime, dynamicStyles.txTime]}>{item.time}</Text>
            </View>
            <Text style={[styles.txAmount, item.type === 'withdrawal' && styles.txAmountNeg]}>
              {item.amount}
            </Text>
          </View>
        )}
      />

      {/* Passenger Profile Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleClosePassenger}
      >
        <View style={[styles.modalOverlay, dynamicStyles.modalOverlay]}>
          <View style={[styles.modalContent, dynamicStyles.modalContent]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>Passenger Profile</Text>
              <TouchableOpacity onPress={handleClosePassenger} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={isDark ? Colors.white : Colors.gray900} />
              </TouchableOpacity>
            </View>

            {selectedPassenger && (
              <ScrollView contentContainerStyle={styles.modalBody}>
                {/* Profile Header */}
                <View style={styles.modalProfileHeader}>
                  <View style={styles.modalAvatar}>
                    <Ionicons name="person" size={40} color={Colors.white} />
                  </View>
                  <Text style={[styles.modalName, dynamicStyles.modalText]}>{selectedPassenger.name}</Text>
                  <Text style={styles.modalUsername}>@{selectedPassenger.username}</Text>
                </View>

                {/* Details Table */}
                <View style={styles.modalDetails}>
                  <View style={styles.detailRowItem}>
                    <Text style={[styles.detailRowLabel, dynamicStyles.modalLabel]}>Email</Text>
                    <Text style={[styles.detailRowValue, dynamicStyles.modalText]}>{selectedPassenger.email}</Text>
                  </View>
                  <View style={[styles.modalDivider, dynamicStyles.modalDivider]} />
                  
                  <View style={styles.detailRowItem}>
                    <Text style={[styles.detailRowLabel, dynamicStyles.modalLabel]}>Phone Number</Text>
                    <Text style={[styles.detailRowValue, dynamicStyles.modalText]}>{selectedPassenger.phone}</Text>
                  </View>
                  <View style={[styles.modalDivider, dynamicStyles.modalDivider]} />
                  
                  <View style={styles.detailRowItem}>
                    <Text style={[styles.detailRowLabel, dynamicStyles.modalLabel]}>Gender</Text>
                    <Text style={[styles.detailRowValue, dynamicStyles.modalText]}>{selectedPassenger.gender}</Text>
                  </View>
                </View>

                {/* Confirm Action Button */}
                <TouchableOpacity style={styles.modalActionBtn} onPress={handleClosePassenger}>
                  <Text style={styles.modalActionText}>Done</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  balanceCard: { marginHorizontal: Spacing.md, backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadows.md },
  balanceLabel: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', fontWeight: FontWeight.medium },
  balanceValue: { fontSize: 40, fontWeight: FontWeight.bold, color: Colors.white, marginTop: 4 },
  balanceStats: { flexDirection: 'row', marginTop: Spacing.md, gap: Spacing.lg },
  balanceStat: {},
  balanceStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  bStatValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.white },
  bStatLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)' },
  withdrawBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: BorderRadius.md, paddingVertical: 12, marginTop: Spacing.lg },
  withdrawText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.white },
  todayCard: { marginHorizontal: Spacing.md, marginTop: Spacing.md, borderRadius: BorderRadius.lg, padding: Spacing.lg, ...Shadows.sm },
  todayRow: { flexDirection: 'row', justifyContent: 'space-around' },
  todayItem: { alignItems: 'center', gap: 4 },
  todayValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  todayLabel: { fontSize: FontSize.xs },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  txList: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  txRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadows.sm },
  txIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  txIconWithdraw: { backgroundColor: Colors.error + '20' },
  txLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  txTime: { fontSize: FontSize.xs, marginTop: 4 },
  routeInfoText: { fontSize: FontSize.xs, marginTop: 4, fontWeight: FontWeight.medium },
  txAmount: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.success },
  txAmountNeg: { color: Colors.error },
  passengerBadge: { alignSelf: 'flex-start', backgroundColor: Colors.primary + '12', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, marginTop: 4 },
  passengerText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary },
  
  // Modal styles
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalContent: { width: '100%', borderRadius: BorderRadius.xl, ...Shadows.lg, padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  modalCloseBtn: { padding: 4 },
  modalBody: { alignItems: 'center' },
  modalProfileHeader: { alignItems: 'center', marginBottom: Spacing.lg },
  modalAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  modalName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  modalUsername: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: 2 },
  modalDetails: { width: '100%', borderRadius: BorderRadius.md, borderWidth: 0.5, borderColor: Colors.gray300, padding: Spacing.md, marginBottom: Spacing.xl },
  detailRowItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  detailRowLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  detailRowValue: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flex: 1, textAlign: 'right', marginLeft: Spacing.md },
  modalDivider: { height: 0.5, width: '100%' },
  modalActionBtn: { width: '100%', backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 14, alignItems: 'center', ...Shadows.md },
  modalActionText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
