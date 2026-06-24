import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, ScrollView, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { processBankPayout } from '@/utils/payment';
import { processHitPayCheckout, parseAmount } from '@/utils/paymentStore';
import { useRouter } from 'expo-router';

interface Transaction {
  id: string;
  type: 'payment' | 'refund' | 'withdrawal' | 'topup';
  label: string;
  amount: string;
  numericAmount: number;
  time: string;
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

export default function PassengerWalletScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals visibility
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [topupModalVisible, setTopupModalVisible] = useState(false);

  // Form states
  const [connectedBank, setConnectedBank] = useState<{ name: string; account: string } | null>(null);
  const [bankNameInput, setBankNameInput] = useState('');
  const [bankAccountInput, setBankAccountInput] = useState('');
  const [withdrawAmountInput, setWithdrawAmountInput] = useState('');
  const [topupAmountInput, setTopupAmountInput] = useState('');
  const [topupPayMethod, setTopupPayMethod] = useState<'fpx' | 'card'>('fpx');
  const [selectedBank, setSelectedBank] = useState('Maybank2u');

  const [bankSaving, setBankSaving] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);

  // Real-time listener for passenger's transactions
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
        
        // Exclude driver role transactions
        if (data.role === 'driver') return;
        if (!data.role) {
          // Fallback filtering for older seeded/unlabeled documents
          if (data.transaction_type === 'service_fee') return;
          if (data.transaction_type === 'fare_payment' && data.amount > 0 && !data.label?.toLowerCase().includes('refund')) return;
        }

        let type: Transaction['type'] = 'payment';
        if (data.transaction_type === 'withdrawal') type = 'withdrawal';
        else if (data.transaction_type === 'refund') type = 'refund';
        else if (data.transaction_type === 'topup') type = 'topup';

        const isCash = data.payment_method === 'cash';
        const displayAmt = isCash
          ? `RM ${(data.cash_amount || 0).toFixed(2)} (Cash)`
          : (data.amount < 0 ? '-' : '+') + ' RM ' + Math.abs(data.amount).toFixed(2);

        txs.push({
          id: doc.id,
          type,
          label: data.label || 'Transaction',
          amount: displayAmt,
          numericAmount: data.amount || 0,
          time: data.created_at ? new Date(data.created_at.seconds * 1000).toLocaleString() : 'Just now',
        });
      });
      setTransactions(txs);
      setLoading(false);
    }, (err) => {
      console.warn('[PassengerWallet] Transactions load error:', err);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  // Real-time listener for passenger's bank account connection info
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

  // Calculate passenger's wallet balance
  const walletBalance = Math.max(0, transactions.reduce((acc, tx) => acc + tx.numericAmount, 0));

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
        'Please link your bank account first before initiating a withdrawal.',
        [{ text: 'OK', onPress: () => setBankModalVisible(true) }]
      );
      return;
    }
    setWithdrawAmountInput('');
    setWithdrawModalVisible(true);
  };

  const handleConfirmWithdraw = async () => {
    const numericAmount = parseFloat(withdrawAmountInput);
    if (isNaN(numericAmount) || numericAmount <= 1) {
      Alert.alert('Invalid Amount', 'The minimum withdrawal limit is RM 2.00 to cover the RM 1.00 payment gateway transfer fee.');
      return;
    }
    if (numericAmount > walletBalance) {
      Alert.alert('Insufficient Balance', 'The amount exceeds your available balance.');
      return;
    }
    if (!connectedBank) return;

    setWithdrawLoading(true);
    try {
      // Trigger banking payout
      const payoutResult = await processBankPayout(numericAmount - 1.0, {
        bankName: connectedBank.name,
        accountNumber: connectedBank.account
      });

      if (payoutResult.success) {
        // Log transaction in Firestore (deducting the full amount from balance)
        await addDoc(collection(db, 'transactions'), {
          user_id: user?.id,
          amount: -numericAmount,
          payment_method: 'fpx',
          transaction_type: 'withdrawal',
          label: `Withdrawal to ${connectedBank.name} (incl. RM 1.00 gateway fee)`,
          role: 'passenger',
          status: 'completed',
          created_at: serverTimestamp()
        });

        Alert.alert('Withdrawal Successful', `RM ${(numericAmount - 1.00).toFixed(2)} has been successfully transferred to your bank account. RM 1.00 was deducted for the gateway transaction fee.`);
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

  const handleOpenTopup = () => {
    setTopupAmountInput('');
    setTopupModalVisible(true);
  };

  const handleConfirmTopup = async () => {
    const numericAmount = parseFloat(topupAmountInput);
    if (isNaN(numericAmount) || numericAmount < 1) {
      Alert.alert('Invalid Amount', 'The minimum top-up limit is RM 1.00.');
      return;
    }
    if (!user) return;

    setTopupLoading(true);
    try {
      const checkout = await processHitPayCheckout({
        amount: numericAmount,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        paymentMethod: topupPayMethod,
        paymentLabel: topupPayMethod === 'fpx' ? `FPX (${selectedBank})` : 'Card (Secure checkout)',
        bankName: topupPayMethod === 'fpx' ? selectedBank : undefined,
        context: 'wallet_topup',
        purpose: 'E-Wallet Balance Top-Up',
      });

      if (checkout.success) {
        // Create positive transaction log in Firestore
        await addDoc(collection(db, 'transactions'), {
          user_id: user.id,
          amount: numericAmount, // positive amount
          payment_method: topupPayMethod,
          transaction_type: 'topup',
          label: `Wallet Top Up via ${topupPayMethod === 'fpx' ? `FPX (${selectedBank})` : 'Card'}`,
          role: 'passenger',
          status: 'completed',
          created_at: serverTimestamp()
        });

        Alert.alert('Top Up Successful', `RM ${numericAmount.toFixed(2)} has been added to your wallet balance.`);
        setTopupModalVisible(false);
      }
    } catch (err: any) {
      Alert.alert('Top Up Failed', err.message || 'Payment processing failed.');
    } finally {
      setTopupLoading(false);
    }
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    headerTitle: { color: isDark ? Colors.white : Colors.gray900 },
    backBtn: { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    border: { borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 },
    divider: { backgroundColor: isDark ? Colors.darkBorder : Colors.gray100 },
    input: {
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      color: isDark ? Colors.white : Colors.gray900,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    },
    modalOverlay: { backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, dynamicStyles.backBtn]}>
          <Ionicons name="arrow-back" size={24} color={isDark ? Colors.white : Colors.gray900} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>My E-Wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceValue}>RM {walletBalance.toFixed(2)}</Text>

        {connectedBank ? (
          <View style={styles.bankStatusContainer}>
            <Text style={styles.bankStatusText}>
              Linked: {connectedBank.name} (***{connectedBank.account.slice(-4)})
            </Text>
            <TouchableOpacity onPress={() => setBankModalVisible(true)} style={styles.bankStatusEditBtn}>
              <Text style={styles.bankStatusEditText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setBankModalVisible(true)} style={styles.connectBtn}>
            <Ionicons name="link-outline" size={16} color={Colors.white} />
            <Text style={styles.connectText}>Link Bank Account</Text>
          </TouchableOpacity>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.walletBtn} onPress={handleOpenTopup}>
            <Ionicons name="arrow-up-circle" size={20} color={Colors.primary} />
            <Text style={styles.walletBtnText}>Top Up</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.walletBtn, { flex: 1.2 }]} onPress={handleOpenWithdraw}>
            <Ionicons name="arrow-down-circle" size={20} color={Colors.primary} />
            <Text style={styles.walletBtnText}>Withdraw Payout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Transactions list */}
      <Text style={styles.sectionTitle}>Transaction History</Text>
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.txList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color={isDark ? Colors.gray700 : Colors.gray300} />
              <Text style={[styles.emptyText, dynamicStyles.subText]}>No transactions yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isNegative = item.numericAmount < 0;
            const getIcon = () => {
              switch (item.type) {
                case 'topup': return 'arrow-up';
                case 'withdrawal': return 'arrow-down';
                case 'refund': return 'refresh';
                default: return 'car';
              }
            };
            const getIconColor = () => {
              if (item.type === 'refund' || item.type === 'topup') return Colors.success;
              if (item.type === 'withdrawal') return Colors.error;
              return Colors.primary;
            };

            return (
              <View style={[styles.txRow, dynamicStyles.card]}>
                <View style={[styles.txIcon, { backgroundColor: getIconColor() + '15' }]}>
                  <Ionicons name={getIcon()} size={18} color={getIconColor()} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.txLabel, dynamicStyles.text]} numberOfLines={1}>{item.label}</Text>
                  <Text style={[styles.txTime, dynamicStyles.subText]}>{item.time}</Text>
                </View>
                <Text style={[styles.txAmount, { color: isNegative ? Colors.error : Colors.success }]}>
                  {item.amount}
                </Text>
              </View>
            );
          }}
        />
      )}

      {/* Link Bank Account Modal */}
      <Modal visible={bankModalVisible} transparent animationType="slide" onRequestClose={() => setBankModalVisible(false)}>
        <View style={[styles.modalOverlay, dynamicStyles.modalOverlay]}>
          <View style={[styles.modalContent, dynamicStyles.modalContent]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Connect Bank Account</Text>
              <TouchableOpacity onPress={() => setBankModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={isDark ? Colors.white : Colors.gray900} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: Spacing.lg }}>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.subText]}>Select Bank</Text>
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
                      <Text style={[dynamicStyles.text, bankNameInput === bank && { color: Colors.primary, fontWeight: 'bold' }]}>
                        {bank}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.subText]}>Account Number</Text>
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
      <Modal visible={withdrawModalVisible} transparent animationType="slide" onRequestClose={() => setWithdrawModalVisible(false)}>
        <View style={[styles.modalOverlay, dynamicStyles.modalOverlay]}>
          <View style={[styles.modalContent, dynamicStyles.modalContent]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Withdraw Payout</Text>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={isDark ? Colors.white : Colors.gray900} />
              </TouchableOpacity>
            </View>

            {connectedBank && (
              <ScrollView contentContainerStyle={{ paddingBottom: Spacing.lg }}>
                <View style={styles.withdrawSummary}>
                  <Text style={[styles.withdrawSummaryLabel, dynamicStyles.subText]}>Available Balance</Text>
                  <Text style={[styles.withdrawSummaryValue, dynamicStyles.text]}>RM {walletBalance.toFixed(2)}</Text>
                  <Text style={[styles.withdrawSummaryTarget, dynamicStyles.subText]}>
                    Target Bank: {connectedBank.name} (***{connectedBank.account.slice(-4)})
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, dynamicStyles.subText]}>Withdrawal Amount (Min RM 2.00)</Text>
                  <TextInput
                    style={[styles.modalInput, dynamicStyles.input]}
                    placeholder="Enter amount (e.g. 10.00)"
                    placeholderTextColor={Colors.gray400}
                    keyboardType="decimal-pad"
                    value={withdrawAmountInput}
                    onChangeText={setWithdrawAmountInput}
                  />
                </View>

                {/* Fee Disclosure Box */}
                <View style={styles.feeDisclosureBox}>
                  <Ionicons name="information-circle" size={16} color={Colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feeDisclosureTitle}>Payment Gateway Fee Disclosure</Text>
                    <Text style={styles.feeDisclosureText}>
                      A flat transaction fee of RM 1.00 is charged by the payment gateway for bank payouts.
                    </Text>
                    {parseFloat(withdrawAmountInput) > 2.0 && (
                      <Text style={styles.feeDisclosureText}>
                        You will receive RM {(parseFloat(withdrawAmountInput) - 1.0).toFixed(2)} in your bank account.
                      </Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity style={styles.modalActionBtn} onPress={handleConfirmWithdraw} disabled={withdrawLoading}>
                  {withdrawLoading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.modalActionText}>Confirm Withdrawal</Text>}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Top Up Modal */}
      <Modal visible={topupModalVisible} transparent animationType="slide" onRequestClose={() => setTopupModalVisible(false)}>
        <View style={[styles.modalOverlay, dynamicStyles.modalOverlay]}>
          <View style={[styles.modalContent, dynamicStyles.modalContent]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Top Up E-Wallet</Text>
              <TouchableOpacity onPress={() => setTopupModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={isDark ? Colors.white : Colors.gray900} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: Spacing.lg }}>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.subText]}>Top-Up Amount (RM)</Text>
                <TextInput
                  style={[styles.modalInput, dynamicStyles.input]}
                  placeholder="Enter amount (e.g. 20.00)"
                  placeholderTextColor={Colors.gray400}
                  keyboardType="decimal-pad"
                  value={topupAmountInput}
                  onChangeText={setTopupAmountInput}
                />
              </View>

              <Text style={[styles.formLabel, dynamicStyles.subText]}>Payment Method</Text>
              <View style={styles.payMethodRow}>
                <TouchableOpacity
                  style={[styles.payMethodOption, topupPayMethod === 'fpx' && styles.payMethodOptionActive]}
                  onPress={() => setTopupPayMethod('fpx')}
                >
                  <Ionicons name="business" size={20} color={topupPayMethod === 'fpx' ? Colors.primary : Colors.gray400} />
                  <Text style={[styles.payMethodText, dynamicStyles.text, topupPayMethod === 'fpx' && { color: Colors.primary }]}>FPX Banking</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.payMethodOption, topupPayMethod === 'card' && styles.payMethodOptionActive]}
                  onPress={() => setTopupPayMethod('card')}
                >
                  <Ionicons name="card" size={20} color={topupPayMethod === 'card' ? Colors.primary : Colors.gray400} />
                  <Text style={[styles.payMethodText, dynamicStyles.text, topupPayMethod === 'card' && { color: Colors.primary }]}>Credit Card</Text>
                </TouchableOpacity>
              </View>

              {topupPayMethod === 'fpx' && (
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, dynamicStyles.subText]}>Choose Bank</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                    {MALAYSIAN_BANKS.map((b) => (
                      <TouchableOpacity
                        key={b}
                        style={[styles.bankChip, selectedBank === b && styles.bankChipActive]}
                        onPress={() => setSelectedBank(b)}
                      >
                        <Text style={[styles.bankChipText, dynamicStyles.text, selectedBank === b && { color: Colors.primary, fontWeight: 'bold' }]}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <TouchableOpacity style={styles.modalActionBtn} onPress={handleConfirmTopup} disabled={topupLoading}>
                {topupLoading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.modalActionText}>Proceed to Pay</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  balanceCard: { margin: Spacing.md, backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadows.md },
  balanceLabel: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', fontWeight: FontWeight.medium },
  balanceValue: { fontSize: 40, fontWeight: FontWeight.bold, color: Colors.white, marginTop: 4 },
  bankStatusContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md, backgroundColor: 'rgba(255,255,255,0.12)', padding: Spacing.sm, borderRadius: BorderRadius.sm },
  bankStatusText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  bankStatusEditBtn: { padding: 4 },
  bankStatusEditText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.bold, textDecorationLine: 'underline' },
  connectBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md, backgroundColor: 'rgba(255,255,255,0.15)', padding: Spacing.sm, borderRadius: BorderRadius.sm, alignSelf: 'flex-start' },
  connectText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  actionRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  walletBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.white, borderRadius: BorderRadius.md, paddingVertical: 12, ...Shadows.sm },
  walletBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  txList: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, flexGrow: 1 },
  txRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadows.sm },
  txIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  txLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  txTime: { fontSize: FontSize.xs, marginTop: 4 },
  txAmount: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, marginTop: 60 },
  emptyText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  
  // Modal styles
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalContent: { width: '100%', borderRadius: BorderRadius.xl, ...Shadows.lg, padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  modalCloseBtn: { padding: 4 },
  formGroup: { marginBottom: Spacing.md, width: '100%' },
  formLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginBottom: 8, textTransform: 'uppercase' },
  bankSelectorContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  bankSelectOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: BorderRadius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalInput: { height: 48, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: FontSize.md, width: '100%' },
  modalActionBtn: { width: '100%', backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 14, alignItems: 'center', ...Shadows.md, marginTop: Spacing.md },
  modalActionText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  
  // Withdrawal summary
  withdrawSummary: { width: '100%', padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: 'rgba(0, 87, 184, 0.08)', marginBottom: Spacing.md, alignItems: 'center' },
  withdrawSummaryLabel: { fontSize: FontSize.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  withdrawSummaryValue: { fontSize: 32, fontWeight: FontWeight.bold, marginVertical: 4 },
  withdrawSummaryTarget: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: 4 },
  
  // Fee disclosure
  feeDisclosureBox: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(235, 172, 0, 0.08)', padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(235, 172, 0, 0.2)', marginBottom: Spacing.sm },
  feeDisclosureTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  feeDisclosureText: { fontSize: 11, color: Colors.accent, lineHeight: 16, fontWeight: FontWeight.semibold },

  // Top Up specific styles
  payMethodRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  payMethodOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, borderWidth: 1, borderColor: Colors.gray300, paddingVertical: 12, borderRadius: BorderRadius.md },
  payMethodOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  payMethodText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  bankChip: { borderWidth: 1, borderColor: Colors.gray300, borderRadius: BorderRadius.sm, paddingVertical: 6, paddingHorizontal: 12 },
  bankChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  bankChipText: { fontSize: FontSize.xs },
});
