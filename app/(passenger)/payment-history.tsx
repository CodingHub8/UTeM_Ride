import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/utils/firebase';

interface PaymentItem {
  id: string;
  amount: number;
  payment_method: string;
  payment_label?: string;
  status: string;
  context: string;
  purpose: string;
  hitpay_id?: string;
  created_at?: any;
}

export default function PaymentHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(collection(db, 'payments'), where('user_id', '==', user.id));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentItem, 'id'>) }));
      list.sort((a, b) => (b.created_at?.toMillis?.() || 0) - (a.created_at?.toMillis?.() || 0));
      setPayments(list);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.id]);

  const dynamic = {
    bg: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    sub: { color: isDark ? Colors.gray400 : Colors.gray500 },
  };

  const statusColor = (s: string) => {
    if (s === 'completed') return Colors.success;
    if (s === 'pending') return Colors.warning;
    if (s === 'failed' || s === 'cancelled') return Colors.error;
    return Colors.gray400;
  };

  return (
    <View style={[styles.container, dynamic.bg, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 }]}>
          <Ionicons name="arrow-back" size={24} color={isDark ? Colors.white : Colors.gray900} />
        </TouchableOpacity>
        <Text style={[styles.title, dynamic.text]}>Payment History</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.md, flexGrow: 1 }}
          ListEmptyComponent={<Text style={[styles.empty, dynamic.sub]}>No payment records yet.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.card, dynamic.card]}>
              <View style={styles.row}>
                <Text style={[styles.amount, dynamic.text]}>RM {Number(item.amount).toFixed(2)}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '20' }]}>
                  <Text style={[styles.badgeText, { color: statusColor(item.status) }]}>{item.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={[styles.purpose, dynamic.text]}>{item.purpose}</Text>
              <Text style={[styles.meta, dynamic.sub]}>{item.payment_label || item.payment_method?.toUpperCase()} · {item.context?.replace('_', ' ')}</Text>
              {item.hitpay_id ? <Text style={[styles.meta, dynamic.sub]}>HitPay: {item.hitpay_id}</Text> : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadows.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  badge: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: FontWeight.bold },
  purpose: { fontSize: FontSize.sm, marginTop: Spacing.xs, fontWeight: FontWeight.medium },
  meta: { fontSize: FontSize.xs, marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 60 },
});
