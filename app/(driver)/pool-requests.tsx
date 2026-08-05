import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { collection, onSnapshot, query, where, doc, updateDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { sendUserNotification } from '@/utils/notifications';
import { getDirections } from '@/utils/location';

interface PassengerRequest {
  id: string;
  passenger_id: string;
  passenger_name: string;
  passenger_phone?: string;
  passenger_gender?: string;
  pickup: string;
  destination: string;
  pickup_coords?: { latitude: number; longitude: number };
  destination_coords?: { latitude: number; longitude: number };
  date_time?: Timestamp;
  gender_matching?: boolean;
  status: string;
}

export default function DriverPoolRequestsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [requests, setRequests] = useState<PassengerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<PassengerRequest | null>(null);
  
  // Pricing and Preferences matching create-pool.tsx
  const [availableSeats, setAvailableSeats] = useState(3);
  const [genderMatching, setGenderMatching] = useState(true);
  const [farePerSeat, setFarePerSeat] = useState('3.00');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'carpool_slots'),
      where('type', '==', 'passenger_request'),
      where('status', '==', 'open')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PassengerRequest, 'id'>),
        }));

        // Filter out requests if gender matching is enabled and gender does not match driver
        const filtered = list.filter((r) => {
          if (r.gender_matching && r.passenger_gender && user?.gender) {
            if (r.passenger_gender.toLowerCase() !== user.gender.toLowerCase()) {
              return false;
            }
          }
          return true;
        });

        filtered.sort(
          (a, b) => (b.date_time?.toMillis?.() || 0) - (a.date_time?.toMillis?.() || 0)
        );
        setRequests(filtered);
        setLoading(false);
      },
      (err) => {
        console.warn('[DriverPoolRequests] Error fetching requests:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.gender]);

  // Auto-calculate fare using Google Maps driving distance (matching create-pool.tsx 1:1)
  useEffect(() => {
    if (!selectedReq?.pickup_coords || !selectedReq?.destination_coords) {
      setFarePerSeat((9.00 / availableSeats).toFixed(2));
      return;
    }

    let active = true;
    (async () => {
      let distKm = 0;
      try {
        const directions = await getDirections(
          { lat: selectedReq.pickup_coords!.latitude, lng: selectedReq.pickup_coords!.longitude },
          { lat: selectedReq.destination_coords!.latitude, lng: selectedReq.destination_coords!.longitude }
        );
        if (directions && directions.distanceValue) {
          distKm = directions.distanceValue / 1000;
        } else {
          // Haversine fallback
          const toRad = (v: number) => (v * Math.PI) / 180;
          const R = 6371;
          const dLat = toRad(selectedReq.destination_coords!.latitude - selectedReq.pickup_coords!.latitude);
          const dLon = toRad(selectedReq.destination_coords!.longitude - selectedReq.pickup_coords!.longitude);
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(selectedReq.pickup_coords!.latitude)) *
              Math.cos(toRad(selectedReq.destination_coords!.latitude)) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
      } catch {
        distKm = 5;
      }

      if (!active) return;
      const totalFare = 3.50 + distKm * 0.50;
      setFarePerSeat((totalFare / availableSeats).toFixed(2));
    })();

    return () => {
      active = false;
    };
  }, [selectedReq, availableSeats]);

  const handleConfirmAccept = async () => {
    if (!selectedReq || !user) return;
    const fareNum = parseFloat(farePerSeat);

    if (isNaN(fareNum) || fareNum <= 0) {
      Alert.alert('Invalid Fare', 'Please enter a valid fare per seat (RM).');
      return;
    }

    setAccepting(true);
    try {
      // 1. Update the carpool slot document
      await updateDoc(doc(db, 'carpool_slots', selectedReq.id), {
        driver_id: user.id,
        driver_name: user.name,
        driver_gender: user.gender || 'Male',
        driver_vehicle: `${user.vehicleModel || 'Vehicle'} (${user.vehiclePlate || ''})`.trim(),
        price_per_seat: fareNum,
        seats_total: availableSeats,
        seats_booked: 1, // Passenger who requested takes 1 seat
        gender_matching: genderMatching,
        status: 'open',
        type: 'driver_accepted',
        accepted_at: serverTimestamp(),
      });

      // 2. Write passenger booking to sub-collection with passenger_phone, pickup_address & pickup set
      await setDoc(doc(db, 'carpool_slots', selectedReq.id, 'bookings', selectedReq.passenger_id), {
        passenger_id: selectedReq.passenger_id,
        passenger_name: selectedReq.passenger_name,
        passenger_phone: selectedReq.passenger_phone || user?.phone || '',
        pickup: selectedReq.pickup,
        pickup_address: selectedReq.pickup,
        status: 'confirmed',
        payment_method: 'cash',
        booked_at: new Date().toISOString(),
      });

      // Send notification to the passenger
      if (selectedReq.passenger_id) {
        await sendUserNotification(
          selectedReq.passenger_id,
          'Carpool Request Accepted! 🎉',
          `Driver ${user.name} accepted your carpool request from ${selectedReq.pickup} to ${selectedReq.destination}.`,
          'pool_join'
        );
      }

      Alert.alert('Success', 'You have accepted the passenger carpool request!');
      setSelectedReq(null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to accept request.');
    } finally {
      setAccepting(false);
    }
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    input: { backgroundColor: isDark ? Colors.gray900 : Colors.gray50, borderColor: isDark ? Colors.darkBorder : Colors.gray300 },
    divider: { backgroundColor: isDark ? Colors.darkBorder : Colors.gray100 },
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, dynamicStyles.text]}>Passenger Pool Requests</Text>
          <Text style={[styles.headerSub, dynamicStyles.subText]}>
            Offer a drive to passengers requesting carpools
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="search-outline"
                size={64}
                color={isDark ? Colors.gray700 : Colors.gray300}
              />
              <Text style={[styles.emptyText, dynamicStyles.text]}>
                No passenger pool requests right now.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, dynamicStyles.card]}>
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
                      latitudeDelta: 0.06,
                      longitudeDelta: 0.06,
                    }}
                  >
                    <Marker coordinate={item.pickup_coords} pinColor={Colors.success} />
                    <Marker coordinate={item.destination_coords} pinColor={Colors.error} />
                    <Polyline
                      coordinates={[item.pickup_coords, item.destination_coords]}
                      strokeColor={Colors.primary}
                      strokeWidth={3}
                    />
                  </MapView>
                </View>
              )}

              <View style={styles.cardHeader}>
                <View style={styles.passengerInfo}>
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={20} color={Colors.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.passengerName, dynamicStyles.text]}>
                      {item.passenger_name}
                    </Text>
                    <View style={styles.badgeRow}>
                      <View
                        style={[
                          styles.genderBadge,
                          {
                            backgroundColor:
                              (item.passenger_gender === 'Female' ? '#E91E63' : '#0057B8') +
                              '20',
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: 'bold',
                            color:
                              item.passenger_gender === 'Female' ? '#E91E63' : '#0057B8',
                          }}
                        >
                          {item.passenger_gender === 'Female' ? '♀️ Female' : '♂️ Male'}
                        </Text>
                      </View>
                      {item.gender_matching && (
                        <View style={styles.matchingBadge}>
                          <Text style={styles.matchingBadgeText}>🔒 Gender Match ON</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailsBox}>
                <View style={styles.detailRow}>
                  <Ionicons name="navigate" size={16} color={Colors.success} />
                  <Text style={[styles.detailText, dynamicStyles.text]} numberOfLines={1}>
                    {item.pickup}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={16} color={Colors.error} />
                  <Text style={[styles.detailText, dynamicStyles.text]} numberOfLines={1}>
                    {item.destination}
                  </Text>
                </View>
                {item.date_time && (
                  <View style={styles.detailRow}>
                    <Ionicons name="time" size={16} color={Colors.primary} />
                    <Text style={[styles.detailText, dynamicStyles.text]}>
                      {new Date(item.date_time.toMillis()).toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => setSelectedReq(item)}
              >
                <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
                <Text style={styles.acceptBtnText}>Accept Pool Request</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Driver Acceptance Options Modal (Identical Pricing & Preferences container to create-pool.tsx) */}
      <Modal
        visible={!!selectedReq}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedReq(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, dynamicStyles.card]}>
            <Text style={[styles.modalTitle, dynamicStyles.text]}>Accept Carpool Request</Text>
            <Text style={[styles.modalSub, dynamicStyles.subText]}>
              Configure pricing & preferences for {selectedReq?.passenger_name}'s pool
            </Text>

            {/* Pricing Section (Auto Calculated identical to create-pool.tsx) */}
            <Text style={styles.sectionTitle}>Pricing</Text>
            <View style={[styles.innerCard, { backgroundColor: isDark ? Colors.gray900 : Colors.gray50 }]}>
              <Text style={styles.label}>Price per seat (RM)</Text>
              <View style={[styles.inputBoxReadOnly, dynamicStyles.input]}>
                <Text style={[dynamicStyles.text, { fontWeight: FontWeight.bold, fontSize: FontSize.md }]}>
                  RM {farePerSeat}
                </Text>
              </View>
            </View>

            {/* Preferences Section (Identical to create-pool.tsx) */}
            <Text style={styles.sectionTitle}>Preferences</Text>
            <View style={[styles.innerCard, { backgroundColor: isDark ? Colors.gray900 : Colors.gray50 }]}>
              {/* Available Seats Counter */}
              <View style={styles.rowItem}>
                <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                  <Text style={[styles.rowLabel, dynamicStyles.text]}>Available Seats</Text>
                  <Text style={[styles.rowSub, dynamicStyles.subText]}>How many passengers can join?</Text>
                </View>
                <View style={styles.counter}>
                  <TouchableOpacity
                    onPress={() => setAvailableSeats(Math.max(1, availableSeats - 1))}
                    style={styles.counterBtn}
                  >
                    <Ionicons name="remove" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={[styles.counterVal, dynamicStyles.text]}>{availableSeats}</Text>
                  <TouchableOpacity
                    onPress={() => setAvailableSeats(Math.min(6, availableSeats + 1))}
                    style={styles.counterBtn}
                  >
                    <Ionicons name="add" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.divider, dynamicStyles.divider, { marginVertical: Spacing.sm }]} />

              {/* Gender Matching Switch */}
              <View style={styles.rowItem}>
                <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                  <Text style={[styles.rowLabel, dynamicStyles.text]}>Gender Matching</Text>
                  <Text style={[styles.rowSub, dynamicStyles.subText]}>Only allow passengers of your gender</Text>
                </View>
                <Switch
                  value={genderMatching}
                  onValueChange={setGenderMatching}
                  trackColor={{ false: Colors.gray300, true: Colors.primary }}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.acceptBtn, { marginTop: Spacing.lg }, accepting && { opacity: 0.7 }]}
              disabled={accepting}
              onPress={handleConfirmAccept}
            >
              {accepting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.acceptBtnText}>Confirm Drive Offer</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedReq(null)}>
              <Text style={dynamicStyles.subText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  headerSub: { fontSize: FontSize.xs, marginTop: 2 },
  listContent: { padding: Spacing.md },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginTop: Spacing.sm },
  card: { borderRadius: BorderRadius.lg, marginBottom: Spacing.md, overflow: 'hidden', ...Shadows.md },
  mapBox: { height: 130, backgroundColor: Colors.gray100 },
  cardHeader: { padding: Spacing.md },
  passengerInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerName: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  genderBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  matchingBadge: {
    backgroundColor: Colors.gray200,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  matchingBadgeText: { fontSize: 10, color: Colors.gray700, fontWeight: FontWeight.bold },
  divider: { height: 1, backgroundColor: Colors.gray100, marginHorizontal: Spacing.md },
  detailsBox: { padding: Spacing.md, gap: Spacing.xs },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  detailText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flex: 1 },
  acceptBtn: {
    backgroundColor: Colors.primary,
    margin: Spacing.md,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  acceptBtnText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  modalSub: { fontSize: FontSize.xs, marginBottom: Spacing.md },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
    marginBottom: 6,
  },
  innerCard: { borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.xs },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.gray500, marginBottom: 4, textTransform: 'uppercase' },
  inputBoxReadOnly: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  rowSub: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 2 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterVal: { fontSize: FontSize.md, fontWeight: FontWeight.bold, minWidth: 20, textAlign: 'center' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md },
});
