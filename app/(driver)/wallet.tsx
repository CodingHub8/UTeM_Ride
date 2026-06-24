import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, ScrollView, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { processBankPayout } from '@/utils/payment';

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
  numericAmount: number;
  time: string;
  route?: RouteInfo;
  passenger?: PassengerDetails;
}

const MALAYSIAN_BANKS = [
  'Maybank2u',
  'CIMB Clicks',
  'Bank Islam',
  'Public Bank',
  'RHB Now',
  'AmBank',
  'Hong Leong Connect',
];

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedPassenger, setSelectedPassenger] = useState<PassengerDetails | null>(null);
  
  // Modals visibility
  const [passengerModalVisible, setPassengerModalVisible] = useState(false);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);

  // Form states
  const [connectedBank, setConnectedBank] = useState<{ name: string; account: string } | null>(null);
  const [bankNameInput, setBankNameInput] = useState('');
  const [bankAccountInput, setBankAccountInput] = useState('');
  const [withdrawAmountInput, setWithdrawAmountInput] = useState('');
  
  const [bankSaving, setBankSaving] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // 1. Listen to real-time transactions from Firestore
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'transactions'),
      where('user_id', '==', user.id)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs: Transaction[] = [];
      const docs = [...snapshot.docs].sort((a, b) => {
        const ta = a.data().created_at?.toMillis?.() || a.data().created_at?.seconds * 1000 || 0;
        const tb = b.data().created_at?.toMillis?.() || b.data().created_at?.seconds * 1000 || 0;
        return tb - ta;
      });
      docs.forEach((doc) => {
        const data = doc.data();

        // Exclude passenger role transactions
        if (data.role === 'passenger') return;
        if (!data.role) {
          // Fallback filtering for older seeded/unlabeled documents
          if (data.transaction_type === 'topup' || data.transaction_type === 'carpool_booking' || data.transaction_type === 'refund') return;
          if (data.transaction_type === 'fare_payment' && data.amount < 0) return;
        }

        const isCash = data.payment_method === 'cash';
        const displayAmt = isCash
          ? `RM ${(data.cash_amount || 0).toFixed(2)} (Cash)`
          : (data.amount < 0 ? '-' : '') + 'RM ' + Math.abs(data.amount).toFixed(2);

        txs.push({
          id: doc.id,
          type: data.transaction_type === 'withdrawal' ? 'withdrawal' : 'trip',
          label: data.label || (data.transaction_type === 'withdrawal' ? 'Withdrawal' : 'Ride Earnings'),
          amount: displayAmt,
          numericAmount: data.amount || 0,
          time: data.created_at ? new Date(data.created_at.seconds * 1000).toLocaleString() : 'Just now',
          route: data.route,
          passenger: data.passenger,
        });
      });
      setTransactions(txs);
    }, (err) => {
      console.warn('Transactions listen error:', err);
    });
    return unsubscribe;
  }, [user]);

  // 2. Listen to connected bank account information in the user document
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.bank_name && data.bank_account_number) {
          setConnectedBank({
            name: data.bank_name,
            account: data.bank_account_number
          });
          setBankNameInput(data.bank_name);
          setBankAccountInput(data.bank_account_number);
        } else {
          setConnectedBank(null);
        }
      }
    });
    return unsubscribe;
  }, [user]);

  // Calculate live e-wallet balance
  const walletBalance = Math.max(0, transactions.reduce((acc, tx) => acc + tx.numericAmount, 0));

  // Daily statistics derived dynamically
  const todayTripsCount = transactions.filter(t => t.type === 'trip' && t.time.includes(new Date().toLocaleDateString())).length;
  
  const handleOpenPassenger = (passenger: PassengerDetails) => {
    setSelectedPassenger(passenger);
    setPassengerModalVisible(true);
  };

  const handleClosePassenger = () => {
    setSelectedPassenger(null);
    setPassengerModalVisible(false);
  };

  const openConnectBankModal = () => {
    setBankModalVisible(true);
  };

  const handleSaveBank = async () => {
    if (!bankNameInput || !bankAccountInput) {
      Alert.alert('Incomplete Fields', 'Please select a bank and enter an account number.');
      return;
    }

    setBankSaving(true);
    try {
      if (user) {
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, {
          bank_name: bankNameInput,
          bank_account_number: bankAccountInput,
          updated_at: serverTimestamp()
        });
        Alert.alert('Success', 'Bank account connected successfully.');
        setBankModalVisible(false);
      }
    } catch (e: any) {
      Alert.alert('Connection Failed', e.message || 'Could not update bank details.');
    } finally {
      setBankSaving(false);
    }
  };

  const handleOpenWithdraw = () => {
    if (!connectedBank) {
      Alert.alert(
        'Bank Account Required',
        'Please connect your bank account first before initiating a withdrawal.',
        [{ text: 'OK', onPress: () => setBankModalVisible(true) }]
      );
      return;
    }
    setWithdrawAmountInput('');
    setWithdrawModalVisible(true);
  };

  const handleConfirmWithdraw = async () => {
    const numericAmount = parseFloat(withdrawAmountInput);
    if (isNaN(numericAmount) || numericAmount < 1) {
      Alert.alert('Invalid Amount', 'The minimum withdrawal limit is RM 1.00.');
      return;
    }
    if (numericAmount > walletBalance) {
      Alert.alert('Insufficient Funds', 'The amount exceeds your available balance.');
      return;
    }
    if (!connectedBank) return;

    setWithdrawLoading(true);
    try {
      // Trigger gateway API payout
      const payoutResult = await processBankPayout(numericAmount, {
        bankName: connectedBank.name,
        accountNumber: connectedBank.account
      });

      if (payoutResult.success) {
        // Log transaction in Firestore
        await addDoc(collection(db, 'transactions'), {
          user_id: user?.id,
          amount: -numericAmount,
          payment_method: 'fpx',
          transaction_type: 'withdrawal',
          label: `Withdrawal to ${connectedBank.name}`,
          role: 'driver',
          status: 'completed',
          created_at: serverTimestamp()
        });

        Alert.alert('Withdrawal Successful', `RM ${numericAmount.toFixed(2)} has been successfully transferred to your bank account.`);
        setWithdrawModalVisible(false);
      } else {
        Alert.alert('Failed', 'Gateway transfer failed. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Withdrawal could not be completed.');
    } finally {
      setWithdrawLoading(false);
    }
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
    input: {
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      color: isDark ? Colors.white : Colors.gray900,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    }
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
        <Text style={styles.balanceValue}>RM {walletBalance.toFixed(2)}</Text>
        
        {/* Connection status display */}
        {connectedBank ? (
          <View style={styles.bankStatusContainer}>
            <Text style={styles.bankStatusText}>
              Connected: {connectedBank.name} (***{connectedBank.account.slice(-4)})
            </Text>
            <TouchableOpacity onPress={openConnectBankModal} style={styles.bankStatusEditBtn}>
              <Text style={styles.bankStatusEditText}>Edit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={openConnectBankModal} style={styles.connectBtn}>
            <Ionicons name="link-outline" size={16} color={Colors.white} />
            <Text style={styles.connectText}>Connect Online Banking Account</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.withdrawBtn} onPress={handleOpenWithdraw}>
          <Ionicons name="arrow-down-circle" size={20} color={Colors.primary} />
          <Text style={styles.withdrawText}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      {/* Stats derived from Firestore */}
      <View style={[styles.todayCard, dynamicStyles.todayCard]}>
        <View style={styles.todayRow}>
          <View style={styles.todayItem}>
            <Ionicons name="car" size={22} color={Colors.primary} />
            <Text style={[styles.todayValue, dynamicStyles.todayValue]}>{todayTripsCount}</Text>
            <Text style={[styles.todayLabel, dynamicStyles.todayLabel]}>Today's Trips</Text>
          </View>
          <View style={styles.todayItem}>
            <Ionicons name="wallet-outline" size={22} color={Colors.primary} />
            <Text style={[styles.todayValue, dynamicStyles.todayValue]}>RM 1.00</Text>
            <Text style={[styles.todayLabel, dynamicStyles.todayLabel]}>Min Withdraw</Text>
          </View>
        </View>
      </View>

      {/* Transaction history */}
      <Text style={styles.sectionTitle}>Transaction History</Text>
      <FlatList
        data={transactions}
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
        visible={passengerModalVisible}
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
                <View style={styles.modalProfileHeader}>
                  <View style={styles.modalAvatar}>
                    <Ionicons name="person" size={40} color={Colors.white} />
                  </View>
                  <Text style={[styles.modalName, dynamicStyles.modalText]}>{selectedPassenger.name}</Text>
                  <Text style={styles.modalUsername}>@{selectedPassenger.username}</Text>
                </View>

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

                <TouchableOpacity style={styles.modalActionBtn} onPress={handleClosePassenger}>
                  <Text style={styles.modalActionText}>Done</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Connect Bank Account Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={bankModalVisible}
        onRequestClose={() => setBankModalVisible(false)}
      >
        <View style={[styles.modalOverlay, dynamicStyles.modalOverlay]}>
          <View style={[styles.modalContent, dynamicStyles.modalContent]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>Connect Online Banking</Text>
              <TouchableOpacity onPress={() => setBankModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={isDark ? Colors.white : Colors.gray900} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: Spacing.lg }}>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.modalLabel]}>Select Bank</Text>
                <View style={styles.bankSelectorContainer}>
                  {MALAYSIAN_BANKS.map((bank) => (
                    <TouchableOpacity
                      key={bank}
                      style={[
                        styles.bankSelectOption,
                        { borderColor: isDark ? Colors.darkBorder : Colors.gray200 },
                        bankNameInput === bank && { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' }
                      ]}
                      onPress={() => setBankNameInput(bank)}
                    >
                      <Text style={[dynamicStyles.modalText, bankNameInput === bank && { color: Colors.primary, fontWeight: 'bold' }]}>
                        {bank}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.modalLabel]}>Account Number</Text>
                <TextInput
                  style={[styles.modalInput, dynamicStyles.input]}
                  placeholder="Enter your bank account number"
                  placeholderTextColor={Colors.gray400}
                  keyboardType="numeric"
                  value={bankAccountInput}
                  onChangeText={setBankAccountInput}
                />
              </View>

              <TouchableOpacity style={styles.modalActionBtn} onPress={handleSaveBank} disabled={bankSaving}>
                {bankSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.modalActionText}>Connect Account</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Withdrawal Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={withdrawModalVisible}
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={[styles.modalOverlay, dynamicStyles.modalOverlay]}>
          <View style={[styles.modalContent, dynamicStyles.modalContent]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>Initiate Payout</Text>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={isDark ? Colors.white : Colors.gray900} />
              </TouchableOpacity>
            </View>

            {connectedBank && (
              <ScrollView contentContainerStyle={{ paddingBottom: Spacing.lg }}>
                <View style={styles.withdrawSummary}>
                  <Text style={[styles.withdrawSummaryLabel, dynamicStyles.modalLabel]}>Available Balance</Text>
                  <Text style={[styles.withdrawSummaryValue, dynamicStyles.modalTitle]}>RM {walletBalance.toFixed(2)}</Text>
                  <Text style={[styles.withdrawSummaryTarget, dynamicStyles.modalText]}>
                    Target Bank: {connectedBank.name} (***{connectedBank.account.slice(-4)})
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, dynamicStyles.modalLabel]}>Withdrawal Amount (Min RM 1.00)</Text>
                  <TextInput
                    style={[styles.modalInput, dynamicStyles.input]}
                    placeholder="Enter amount (e.g. 10.00)"
                    placeholderTextColor={Colors.gray400}
                    keyboardType="decimal-pad"
                    value={withdrawAmountInput}
                    onChangeText={setWithdrawAmountInput}
                  />
                </View>

                <TouchableOpacity style={styles.modalActionBtn} onPress={handleConfirmWithdraw} disabled={withdrawLoading}>
                  {withdrawLoading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.modalActionText}>Confirm Withdrawal</Text>}
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
  
  // Connection states
  bankStatusContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md, backgroundColor: 'rgba(255,255,255,0.12)', padding: Spacing.sm, borderRadius: BorderRadius.sm },
  bankStatusText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  bankStatusEditBtn: { padding: 4 },
  bankStatusEditText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.bold, textDecorationLine: 'underline' },
  connectBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md, backgroundColor: 'rgba(255,255,255,0.15)', padding: Spacing.sm, borderRadius: BorderRadius.sm, alignSelf: 'flex-start' },
  connectText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  
  withdrawBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.white, borderRadius: BorderRadius.md, paddingVertical: 12, marginTop: Spacing.lg, ...Shadows.sm },
  withdrawText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  
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
  modalActionBtn: { width: '100%', backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 14, alignItems: 'center', ...Shadows.md, marginTop: Spacing.md },
  modalActionText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  // Form styles
  formGroup: { marginBottom: Spacing.md, width: '100%' },
  formLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginBottom: 8 },
  bankSelectorContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  bankSelectOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: BorderRadius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalInput: { height: 48, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: FontSize.md, width: '100%' },
  
  // Withdrawal summary
  withdrawSummary: { width: '100%', padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: 'rgba(0, 87, 184, 0.08)', marginBottom: Spacing.md, alignItems: 'center' },
  withdrawSummaryLabel: { fontSize: FontSize.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  withdrawSummaryValue: { fontSize: 32, fontWeight: FontWeight.bold, marginVertical: 4 },
  withdrawSummaryTarget: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: 4 },
});
