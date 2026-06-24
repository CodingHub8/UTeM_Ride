import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator, Modal, Platform, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { collection, doc, getDoc, increment, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, addDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { processHitPayCheckout, parseAmount } from '@/utils/paymentStore';
import { checkPassengerOverlap } from '@/utils/validation';
import { getCurrentLocationAddress, getPlaceAutocomplete } from '@/utils/location';

interface PoolSlot {
  id: string;
  driver_id: string;
  driver_name: string;
  driver_vehicle?: string;
  driver_plate?: string;
  driver_gender?: string;
  pickup?: string;
  pickup_coords?: { latitude: number; longitude: number };
  destination: string;
  destination_coords?: { latitude: number; longitude: number };
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
  const [selectedPool, setSelectedPool] = useState<PoolSlot | null>(null);
  const [payMethod, setPayMethod] = useState<'cash' | 'fpx' | 'card' | 'wallet'>('cash');
  const [pickupAddress, setPickupAddress] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [locating, setLocating] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [joinedPools, setJoinedPools] = useState<Record<string, boolean>>({});

  const handleLocateMe = async () => {
    setLocating(true);
    const loc = await getCurrentLocationAddress();
    if (loc) {
      setPickupAddress(loc.address);
    } else {
      Alert.alert('Location Error', 'Unable to detect your current location.');
    }
    setLocating(false);
  };

  const handleTextChange = async (text: string) => {
    setPickupAddress(text);
    if (!text.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const results = await getPlaceAutocomplete(text);
      setSuggestions(results);
    } catch (e) {
      console.warn('Autocomplete error:', e);
    }
  };

  // Monitor passenger's dynamic wallet balance
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'transactions'), where('user_id', '==', user.id));
    const unsub = onSnapshot(q, (snap) => {
      let balance = 0;
      snap.forEach((d) => {
        const data = d.data();
        // Exclude driver role transactions
        if (data.role === 'driver') return;
        if (!data.role) {
          // Fallback filtering for older seeded/unlabeled documents
          if (data.transaction_type === 'service_fee') return;
          if (data.transaction_type === 'fare_payment' && data.amount > 0 && !data.label?.toLowerCase().includes('refund')) return;
        }
        balance += Number(data.amount) || 0;
      });
      setWalletBalance(Math.max(0, balance));
    }, (err) => console.warn('[CarpoolSlots] Failed to fetch wallet transactions:', err));
    return unsub;
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'carpool_slots'), where('status', '==', 'open'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const now = Date.now();
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PoolSlot, 'id'>) }))
          .filter((p) => {
            if (p.driver_id === user?.id) return false;
            if ((p.seats_booked ?? 0) >= (p.seats_total ?? 0)) return false;
            if (p.date_time?.toMillis && p.date_time.toMillis() < now) return false;
            if (p.gender_matching && p.driver_gender && user?.gender && p.driver_gender !== user.gender) return false;
            return true;
          });
        list.sort((a, b) => (a.date_time?.toMillis?.() || 0) - (b.date_time?.toMillis?.() || 0));
        setPools(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [user?.id, user?.gender]);

  useEffect(() => {
    if (!user?.id || pools.length === 0) {
      setJoinedPools({});
      return;
    }

    let active = true;

    const checkJoinedPools = async () => {
      const results: Record<string, boolean> = {};
      for (const pool of pools) {
        try {
          const bookingRef = doc(db, 'carpool_slots', pool.id, 'bookings', user.id);
          const snap = await getDoc(bookingRef);
          if (snap.exists()) {
            const status = snap.data().status;
            if (status === 'pending' || status === 'confirmed') {
              results[pool.id] = true;
            }
          }
        } catch (e) {
          console.warn(`Error checking booking for pool ${pool.id}:`, e);
        }
      }
      if (active) {
        setJoinedPools(results);
      }
    };

    checkJoinedPools();

    return () => {
      active = false;
    };
  }, [pools, user?.id]);

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
  };

  const confirmJoin = async () => {
    if (!selectedPool || !user) return;
    if (!pickupAddress.trim()) {
      Alert.alert('Pickup Required', 'Please enter a pickup location so the driver knows where to pick you up.');
      return;
    }

    setJoiningId(selectedPool.id);
    try {
      // 1. Run time overlap validation checks
      const overlap = await checkPassengerOverlap(user.id, selectedPool.date_time);
      if (overlap.hasOverlap) {
        Alert.alert('Schedule Overlap', overlap.details);
        setJoiningId(null);
        return;
      }

      const bookingRef = doc(db, 'carpool_slots', selectedPool.id, 'bookings', user.id);
      const existing = await getDoc(bookingRef);
      if (existing.exists()) {
        Alert.alert('Already booked', `You have already requested to join ${selectedPool.driver_name}'s pool.`);
        setJoiningId(null);
        return;
      }

      const amount = parseAmount(selectedPool.price_per_seat);
      let paymentId = '';
      let paymentStatus = payMethod === 'cash' ? 'completed' : 'pending';

      if (payMethod === 'wallet') {
        if (walletBalance < amount) {
          Alert.alert(
            'Insufficient Balance',
            `Your E-Wallet balance is RM ${walletBalance.toFixed(2)}, which is insufficient to cover this seat fare of RM ${amount.toFixed(2)}. Please choose another payment method.`
          );
          setJoiningId(null);
          return;
        }
        paymentId = 'wal_' + Math.random().toString(36).substring(2, 11).toUpperCase();
        paymentStatus = 'completed';
      } else if (payMethod !== 'cash') {
        const checkout = await processHitPayCheckout({
          amount,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          paymentMethod: payMethod,
          paymentLabel: payMethod === 'fpx' ? 'FPX (HitPay)' : 'Card (HitPay)',
          context: 'pool_booking',
          contextId: selectedPool.id,
          purpose: `Pool seat - ${selectedPool.destination}`,
        });
        if (!checkout.success) {
          setJoiningId(null);
          return;
        }
        paymentId = checkout.paymentId;
        paymentStatus = 'completed';
      }

      // Write booking with 'pending' status (driver must approve)
      await setDoc(bookingRef, {
        passenger_id: user.id,
        passenger_name: user.name,
        passenger_phone: user.phone || '',
        pickup_address: pickupAddress.trim(),
        seats_booked: 1,
        payment_method: payMethod,
        payment_id: paymentId || null,
        payment_status: paymentStatus,
        status: 'pending',
        created_at: serverTimestamp(),
      });

      // Write passenger's escrow transaction to transactions collection
      if (payMethod !== 'cash') {
        await addDoc(collection(db, 'transactions'), {
          user_id: user.id,
          amount: -amount,
          payment_method: payMethod,
          transaction_type: 'carpool_booking',
          label: `Carpool seat to ${selectedPool.destination} (Held in Escrow)`,
          role: 'passenger',
          status: 'held',
          ride_id: selectedPool.id,
          created_at: serverTimestamp(),
        });
      }

      setJoinedPools((prev) => ({ ...prev, [selectedPool.id]: true }));
      setSelectedPool(null);
      setPickupAddress('');
      Alert.alert(
        'Request Sent',
        `Your request to join ${selectedPool.driver_name}'s pool has been sent. The driver will review your pickup location and accept or decline.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to request pool.');
    } finally {
      setJoiningId(null);
    }
  };

  const routeCoords = selectedPool?.pickup_coords && selectedPool?.destination_coords
    ? [selectedPool.pickup_coords, selectedPool.destination_coords]
    : [];

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
        <View style={styles.emptyContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={pools}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={isDark ? Colors.gray700 : Colors.gray300} />
              <Text style={[styles.emptyText, dynamicStyles.text]}>No available pools for now.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const seatsLeft = (item.seats_total ?? 0) - (item.seats_booked ?? 0);
            return (
              <View style={[styles.poolCard, dynamicStyles.card]}>
                {item.pickup_coords && item.destination_coords && (
                  <View style={styles.mapBox}>
                    <MapView
                      style={StyleSheet.absoluteFillObject}
                      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      initialRegion={{
                        latitude: (item.pickup_coords.latitude + item.destination_coords.latitude) / 2,
                        longitude: (item.pickup_coords.longitude + item.destination_coords.longitude) / 2,
                        latitudeDelta: 0.08,
                        longitudeDelta: 0.08,
                      }}
                    >
                      <Marker coordinate={item.pickup_coords} pinColor={Colors.success} />
                      <Marker coordinate={item.destination_coords} pinColor={Colors.error} />
                      <Polyline coordinates={[item.pickup_coords, item.destination_coords]} strokeColor={Colors.primary} strokeWidth={3} />
                    </MapView>
                  </View>
                )}
                <View style={styles.poolHeader}>
                  <View style={styles.driverInfo}>
                    <View style={styles.avatar}><Ionicons name="person" size={20} color={Colors.white} /></View>
                    <View>
                      <Text style={[styles.driverName, dynamicStyles.text]}>{item.driver_name}</Text>
                      <Text style={[styles.vehicleText, dynamicStyles.subText]} numberOfLines={1}>{item.driver_vehicle || 'Vehicle'} {item.driver_plate ? `· ${item.driver_plate}` : ''}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.priceText}>
                      RM {((item.price_per_seat * item.seats_total) / 3).toFixed(2)} to RM {((item.price_per_seat * item.seats_total) / 6).toFixed(2)}
                    </Text>
                    <Text style={[styles.vehicleText, dynamicStyles.subText]}>price range (3-6 seats)</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.poolDetails}>
                  <View style={styles.detailRow}><Ionicons name="navigate" size={16} color={Colors.success} /><Text style={[styles.detailText, dynamicStyles.text]} numberOfLines={1}>{item.pickup || 'Pickup TBC'}</Text></View>
                  <View style={styles.detailRow}><Ionicons name="location" size={16} color={Colors.error} /><Text style={[styles.detailText, dynamicStyles.text]} numberOfLines={1}>{item.destination}</Text></View>
                  <View style={styles.detailRow}><Ionicons name="time" size={16} color={Colors.primary} /><Text style={[styles.detailText, dynamicStyles.text]}>{formatSlot(item.date_time)}</Text></View>
                  <View style={styles.detailRow}><Ionicons name="people" size={16} color={Colors.success} /><Text style={[styles.detailText, dynamicStyles.text]}>{seatsLeft} seat{seatsLeft !== 1 ? 's' : ''} left</Text></View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.joinBtn,
                    joinedPools[item.id] && { backgroundColor: isDark ? Colors.gray800 : Colors.gray300 }
                  ]}
                  disabled={joinedPools[item.id]}
                  onPress={() => { setPayMethod('cash'); setSelectedPool(item); }}
                >
                  <Text style={[
                    styles.joinText,
                    joinedPools[item.id] && { color: isDark ? Colors.gray500 : Colors.gray600 }
                  ]}>
                    {joinedPools[item.id] ? 'Pool Already Joined' : 'Join Pool'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      <Modal visible={!!selectedPool} transparent animationType="slide" onRequestClose={() => { setSelectedPool(null); setPickupAddress(''); setSuggestions([]); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, dynamicStyles.card]}>
            <Text style={[styles.modalTitle, dynamicStyles.text]}>Request Pool Seat</Text>
            <Text style={[styles.modalSub, dynamicStyles.subText]}>Seat price: RM {Number(selectedPool?.price_per_seat || 0).toFixed(2)}</Text>
            
            <Text style={[styles.modalLabel, { color: isDark ? Colors.gray300 : Colors.gray600 }]}>Pickup Location</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.pickupInput, {
                  backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
                  color: isDark ? Colors.white : Colors.gray900,
                  borderColor: isDark ? Colors.darkBorder : Colors.gray200,
                  flex: 1,
                  marginRight: Spacing.xs,
                  marginBottom: 0
                }]}
                placeholder="e.g. Kolej Kediaman Lestari Foyer"
                placeholderTextColor={Colors.gray400}
                value={pickupAddress}
                onChangeText={handleTextChange}
              />
              <TouchableOpacity onPress={handleLocateMe} style={[styles.locateBtn, { backgroundColor: isDark ? Colors.gray900 : Colors.gray100, borderColor: isDark ? Colors.darkBorder : Colors.gray200 }]}>
                {locating ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Ionicons name="locate-sharp" size={20} color={Colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            {suggestions.length > 0 && (
              <View style={[styles.suggestionsBox, { backgroundColor: isDark ? Colors.gray900 : Colors.white, borderColor: isDark ? Colors.darkBorder : Colors.gray200 }]}>
                {suggestions.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.suggestionRow}
                    onPress={() => {
                      setPickupAddress(item.name + ', ' + item.address);
                      setSuggestions([]);
                    }}
                  >
                    <Ionicons name="location-outline" size={16} color={Colors.gray400} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.suggestionName, dynamicStyles.text]}>{item.name}</Text>
                      <Text style={{ fontSize: 10, color: Colors.gray500 }} numberOfLines={1}>{item.address}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={[styles.modalLabel, { color: isDark ? Colors.gray300 : Colors.gray600, marginTop: Spacing.sm }]}>Payment Method</Text>
            {(['cash', 'fpx', 'card', 'wallet'] as const).map((m) => (
              <TouchableOpacity key={m} style={[styles.payOption, payMethod === m && styles.payOptionActive]} onPress={() => setPayMethod(m)}>
                <Text style={[styles.payOptionText, dynamicStyles.text]}>
                  {m === 'cash' ? 'Cash' : m === 'fpx' ? 'FPX (HitPay Sandbox)' : m === 'card' ? 'Card (HitPay Sandbox)' : `E-Wallet (RM ${walletBalance.toFixed(2)})`}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.joinBtn, joiningId && { opacity: 0.7 }]} disabled={!!joiningId} onPress={confirmJoin}>
              {joiningId ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.joinText}>Confirm & Send Request</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={() => { setSelectedPool(null); setPickupAddress(''); setSuggestions([]); }}><Text style={dynamicStyles.subText}>Cancel</Text></TouchableOpacity>
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
  listContent: { padding: Spacing.md, flexGrow: 1 },
  poolCard: { borderRadius: BorderRadius.lg, marginBottom: Spacing.md, overflow: 'hidden', ...Shadows.md },
  mapBox: { height: 140, backgroundColor: Colors.gray100 },
  poolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  driverInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  driverName: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  vehicleText: { fontSize: FontSize.xs, marginTop: 2, maxWidth: 180 },
  priceText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.gray100, marginHorizontal: Spacing.md },
  poolDetails: { gap: Spacing.sm, padding: Spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  detailText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flex: 1 },
  joinBtn: { backgroundColor: Colors.primary, margin: Spacing.md, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' },
  joinText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, marginTop: 100 },
  emptyText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginTop: Spacing.md, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  modalSub: { fontSize: FontSize.sm, marginBottom: Spacing.md },
  payOption: { borderWidth: 1, borderColor: Colors.gray200, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  payOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  payOptionText: { fontWeight: FontWeight.semibold },
  cancelLink: { alignItems: 'center', paddingVertical: Spacing.md },
  modalLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginBottom: 8, textTransform: 'uppercase', marginTop: Spacing.xs },
  pickupInput: { height: 48, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: FontSize.md, marginBottom: Spacing.md },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  locateBtn: { width: 48, height: 48, borderRadius: BorderRadius.md, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  suggestionsBox: { borderRadius: BorderRadius.md, borderWidth: 1, maxHeight: 160, overflow: 'hidden', marginBottom: Spacing.md },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: Colors.gray200 },
  suggestionName: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});
