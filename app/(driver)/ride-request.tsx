import { View, Text, TouchableOpacity, StyleSheet, Alert, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { acceptRide } from '@/utils/rides';

interface PendingRide {
  id: string;
  passenger_id?: string;
  passenger_name?: string;
  passenger_phone?: string;
  pickup_address?: string;
  destination_address?: string;
  fare?: string;
  distance?: string;
  duration?: string;
  payment_label?: string;
  timestamp?: number;
}

export default function DriverRideRequestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [rides, setRides] = useState<PendingRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'rides'),
      where('status', '==', 'requested'),
      where('driver_id', '==', null)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: PendingRide[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setRides(list);
        setLoading(false);
      },
      (err) => {
        console.error('Pending rides listener error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const handleAccept = async (ride: PendingRide) => {
    if (!user) {
      Alert.alert('Not signed in', 'Please log in as a driver to accept rides.');
      return;
    }
    if (!user.is_2FA_verified) {
      Alert.alert(
        '2FA Required',
        'Please complete your 2FA verification first to accept ride requests.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!user.vehicleModel || !user.vehiclePlate) {
      Alert.alert(
        'Vehicle Info Missing',
        'Please set your vehicle model, colour and plate number in your profile before accepting rides, so passengers can identify your car.',
        [{ text: 'OK' }]
      );
      return;
    }

    const vehicleStr = user.vehicleColor
      ? `${user.vehicleModel} (${user.vehicleColor})`
      : user.vehicleModel;

    setAccepting(ride.id);
    try {
      await acceptRide({
        rideId: ride.id,
        driver_id: user.id,
        driver_name: user.name,
        driver_vehicle: vehicleStr,
        driver_plate: user.vehiclePlate,
        driver_phone: user.phone,
        driver_location: null,
      });

      router.push({
        pathname: '/(driver)/active-pickup',
        params: {
          rideId: ride.id,
          price: ride.fare || '',
          pickup: ride.pickup_address || '',
          destination: ride.destination_address || '',
          passengerName: ride.passenger_name || 'Passenger',
          passengerUsername: (ride.passenger_name || 'passenger').toLowerCase().replace(/\s+/g, '_'),
          passengerEmail: '',
          passengerPhone: ride.passenger_phone || '',
          passengerGender: '',
        },
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to accept ride. Another driver may have accepted it.');
    } finally {
      setAccepting(null);
    }
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    headerTitle: { color: isDark ? Colors.white : Colors.gray900 },
    backBtn: { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 },
    requestCard: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    passengerName: { color: isDark ? Colors.white : Colors.gray900 },
    ratingText: { color: isDark ? Colors.gray300 : Colors.gray600 },
    routeCard: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    routeValue: { color: isDark ? Colors.white : Colors.gray900 },
    detailValue: { color: isDark ? Colors.white : Colors.gray900 },
    detailDivider: { backgroundColor: isDark ? Colors.darkBorder : Colors.gray200 },
    emptyText: { color: isDark ? Colors.gray400 : Colors.gray500 },
  };

  const renderItem = ({ item }: { item: PendingRide }) => {
    const isAccepting = accepting === item.id;
    return (
      <View style={[styles.requestCard, dynamicStyles.requestCard]}>
        <View style={styles.passengerRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.passengerName, dynamicStyles.passengerName]}>{item.passenger_name || 'Passenger'}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="call" size={14} color={Colors.primary} />
              <Text style={[styles.ratingText, dynamicStyles.ratingText]}>{item.passenger_phone || '—'}</Text>
            </View>
          </View>
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>{item.fare || 'RM —'}</Text>
          </View>
        </View>

        <View style={[styles.routeCard, dynamicStyles.routeCard]}>
          <View style={styles.routeRow}>
            <View style={styles.routeMarkers}>
              <View style={[styles.dot, { backgroundColor: Colors.success }]} />
              <View style={styles.dotLine} />
              <View style={[styles.dot, { backgroundColor: Colors.error }]} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={styles.routeLabel}>Pickup</Text>
                <Text style={[styles.routeValue, dynamicStyles.routeValue]} numberOfLines={2}>
                  {item.pickup_address || '—'}
                </Text>
              </View>
              <View>
                <Text style={styles.routeLabel}>Destination</Text>
                <Text style={[styles.routeValue, dynamicStyles.routeValue]} numberOfLines={2}>
                  {item.destination_address || '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="car" size={18} color={Colors.primary} />
            <Text style={[styles.detailValue, dynamicStyles.detailValue]}>{item.distance || '—'}</Text>
            <Text style={styles.detailLabel}>Distance</Text>
          </View>
          <View style={[styles.detailDivider, dynamicStyles.detailDivider]} />
          <View style={styles.detailItem}>
            <Ionicons name="time" size={18} color={Colors.primary} />
            <Text style={[styles.detailValue, dynamicStyles.detailValue]}>{item.duration || '—'}</Text>
            <Text style={styles.detailLabel}>Duration</Text>
          </View>
          <View style={[styles.detailDivider, dynamicStyles.detailDivider]} />
          <View style={styles.detailItem}>
            <Ionicons name="wallet" size={18} color={Colors.primary} />
            <Text style={[styles.detailValue, dynamicStyles.detailValue]} numberOfLines={1}>
              {item.payment_label || '—'}
            </Text>
            <Text style={styles.detailLabel}>Payment</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.declineBtn} onPress={() => router.back()} disabled={isAccepting}>
            <Ionicons name="close" size={22} color={Colors.error} />
            <Text style={styles.declineText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, isAccepting && { opacity: 0.7 }]}
            onPress={() => handleAccept(item)}
            disabled={isAccepting}
          >
            {isAccepting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark" size={22} color={Colors.white} />
                <Text style={styles.acceptText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, dynamicStyles.backBtn]}>
          <Ionicons name="arrow-back" size={24} color={isDark ? Colors.white : Colors.gray900} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>
          Incoming Requests {rides.length > 0 ? `(${rides.length})` : ''}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : rides.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="car-outline" size={64} color={isDark ? Colors.gray700 : Colors.gray300} />
          <Text style={[styles.emptyTitle, dynamicStyles.passengerName]}>No requests yet</Text>
          <Text style={[styles.emptySub, dynamicStyles.emptyText]}>
            New ride requests will appear here in real time.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: Spacing.xl }}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  emptySub: { fontSize: FontSize.sm, textAlign: 'center' },
  requestCard: { margin: Spacing.md, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadows.md },
  passengerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  passengerName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  priceBadge: { backgroundColor: Colors.primary + '20', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  priceText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  routeCard: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.lg },
  routeRow: { flexDirection: 'row' },
  routeMarkers: { alignItems: 'center', marginRight: Spacing.md, paddingTop: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotLine: { width: 2, height: 24, backgroundColor: Colors.gray600, marginVertical: 4 },
  routeLabel: { fontSize: FontSize.xs, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5 },
  routeValue: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginTop: 2 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.xl },
  detailItem: { alignItems: 'center', gap: 4, flex: 1 },
  detailValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  detailLabel: { fontSize: FontSize.xs, color: Colors.gray400 },
  detailDivider: { width: 1 },
  actionRow: { flexDirection: 'row', gap: Spacing.md },
  declineBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.error + '15', borderRadius: BorderRadius.lg, paddingVertical: 14, borderWidth: 1, borderColor: Colors.error + '30' },
  declineText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.error },
  acceptBtn: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.success, borderRadius: BorderRadius.lg, paddingVertical: 14 },
  acceptText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.white },
});
