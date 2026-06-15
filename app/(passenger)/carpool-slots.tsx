import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { collection, doc, getDoc, increment, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/utils/firebase';

interface PoolSlot {
  id: string;
  driver_id: string;
  driver_name: string;
  driver_vehicle?: string;
  driver_plate?: string;
  driver_gender?: string;
  destination: string;
  date_time?: any;
  seats_total: number;
  seats_booked: number;
  price_per_seat: number;
  gender_matching?: boolean;
  status: string;
}

function formatSlot(ts: any) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hh = d.getHours();
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${d.getDate()} ${months[d.getMonth()]} · ${h12}:${mm} ${ampm}`;
}

export default function CarpoolSlotsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [pools, setPools] = useState<PoolSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'carpool_slots'), where('status', '==', 'open'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const now = Date.now();
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PoolSlot, 'id'>) }))
          .filter((p) => {
            // Bypass driver check in testing to allow joining your own pools on a single account
            // if (p.driver_id === user?.id) return false;
            if ((p.seats_booked ?? 0) >= (p.seats_total ?? 0)) return false;
            if (p.date_time?.toMillis && p.date_time.toMillis() < now) return false;
            if (p.gender_matching && p.driver_gender && user?.gender && p.driver_gender !== user.gender) return false;
            return true;
          });
        list.sort((a, b) => (a.date_time?.toMillis?.() || 0) - (b.date_time?.toMillis?.() || 0));
        setPools(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Carpool slots listener error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user?.id, user?.gender]);

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
  };

  const handleJoinPool = async (pool: PoolSlot) => {
    if (!user) {
      Alert.alert('Not signed in', 'Please log in to join a pool.');
      return;
    }
    if (!user.is_2FA_verified) {
      Alert.alert(
        '2FA Verification Required',
        'To join pools, please verify your account using the 2FA link sent to your email/SMS. You can simulate this by clicking the banner on the home screen.',
        [{ text: 'OK' }]
      );
      return;
    }

    setJoiningId(pool.id);
    try {
      const bookingRef = doc(db, 'carpool_slots', pool.id, 'bookings', user.id);
      const existing = await getDoc(bookingRef);
      if (existing.exists()) {
        Alert.alert('Already booked', `You have already joined ${pool.driver_name}'s pool.`);
        return;
      }

      await setDoc(bookingRef, {
        passenger_id: user.id,
        passenger_name: user.name,
        passenger_phone: user.phone || '',
        seats_booked: 1,
        payment_method: 'cash',
        status: 'pending',
        created_at: serverTimestamp(),
      });

      const nextBooked = (pool.seats_booked ?? 0) + 1;
      await updateDoc(doc(db, 'carpool_slots', pool.id), {
        seats_booked: increment(1),
        status: nextBooked >= pool.seats_total ? 'full' : 'open',
        updated_at: serverTimestamp(),
      });

      Alert.alert('Success', `Requested to join ${pool.driver_name}'s pool!`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to join pool.');
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 }]}>
          <Ionicons name="arrow-back" size={24} color={isDark ? Colors.white : Colors.gray900} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.text]}>Available Pools</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={pools}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={isDark ? Colors.gray700 : Colors.gray300} />
              <Text style={[styles.emptyText, dynamicStyles.text]}>No available pools for now.</Text>
              <Text style={[styles.emptySub, dynamicStyles.subText]}>Check back later or schedule your own pool.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const seatsLeft = (item.seats_total ?? 0) - (item.seats_booked ?? 0);
            return (
              <View style={[styles.poolCard, dynamicStyles.card]}>
                <View style={styles.poolHeader}>
                  <View style={styles.driverInfo}>
                    <View style={styles.avatar}>
                      <Ionicons name="person" size={20} color={Colors.white} />
                    </View>
                    <View>
                      <Text style={[styles.driverName, dynamicStyles.text]}>{item.driver_name}</Text>
                      <Text style={[styles.vehicleText, dynamicStyles.subText]} numberOfLines={1}>
                        {item.driver_vehicle || 'Vehicle'} {item.driver_plate ? `· ${item.driver_plate}` : ''}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.priceText}>RM {Number(item.price_per_seat).toFixed(2)}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.poolDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="location" size={16} color={Colors.error} />
                    <Text style={[styles.detailText, dynamicStyles.text]} numberOfLines={1}>{item.destination}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="time" size={16} color={Colors.primary} />
                    <Text style={[styles.detailText, dynamicStyles.text]}>{formatSlot(item.date_time)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="people" size={16} color={Colors.success} />
                    <Text style={[styles.detailText, dynamicStyles.text]}>{seatsLeft} seat{seatsLeft !== 1 ? 's' : ''} available</Text>
                  </View>
                  {item.gender_matching && (
                    <View style={styles.detailRow}>
                      <Ionicons name="shield-checkmark" size={16} color={Colors.accent} />
                      <Text style={[styles.detailText, dynamicStyles.text]}>{item.driver_gender || ''} passengers only</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.joinBtn, joiningId === item.id && { opacity: 0.7 }]}
                  disabled={joiningId === item.id}
                  onPress={() => handleJoinPool(item)}
                >
                  {joiningId === item.id ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={styles.joinText}>Join Pool</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  listContent: { padding: Spacing.md, flexGrow: 1 },
  poolCard: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, ...Shadows.md },
  poolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  driverInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  driverName: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  vehicleText: { fontSize: FontSize.xs, marginTop: 2, maxWidth: 180 },
  priceText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.gray100, marginVertical: Spacing.md },
  poolDetails: { gap: Spacing.sm, marginBottom: Spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  detailText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flex: 1 },
  joinBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' },
  joinText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, marginTop: 100 },
  emptyText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginTop: Spacing.md, textAlign: 'center' },
  emptySub: { fontSize: FontSize.sm, marginTop: 4, textAlign: 'center' },
});
