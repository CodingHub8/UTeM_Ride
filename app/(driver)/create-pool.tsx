import { View, Text, TouchableOpacity, StyleSheet, TextInput, Switch, ScrollView, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { getCurrentLocationAddress, getPlaceAutocomplete, getPlaceDetails } from '@/utils/location';

const UTEM_REGION = {
  latitude: 2.3086,
  longitude: 102.3197,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

interface PoolSlot {
  id: string;
  destination: string;
  date_time?: Timestamp;
  seats_total: number;
  seats_booked: number;
  price_per_seat: number;
  status: string;
}

export default function CreatePoolScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [destination, setDestination] = useState('');
  const [pickup, setPickup] = useState('');
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [seats, setSeats] = useState(3);
  const [genderMatching, setGenderMatching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [destinationCoords, setDestinationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [selectedPickup, setSelectedPickup] = useState<string | null>(null);
  const [activeInput, setActiveInput] = useState<'pickup' | 'destination'>('destination');
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const [poolBookings, setPoolBookings] = useState<Record<string, any[]>>({});
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<MapView>(null);

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d;
  }, []);
  const [scheduled, setScheduled] = useState<Date>(tomorrow);

  const [myPools, setMyPools] = useState<PoolSlot[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'carpool_slots'), where('driver_id', '==', user.id));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PoolSlot, 'id'>) }));
      list.sort((a, b) => (b.date_time?.toMillis?.() || 0) - (a.date_time?.toMillis?.() || 0));
      setMyPools(list);
    });
    return () => unsub();
  }, [user?.id]);

  useEffect(() => {
    (async () => {
      const loc = await getCurrentLocationAddress();
      if (loc?.coords) {
        const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setCurrentCoords(c);
        setPickupCoords(c);
        setPickup(loc.address);
        setSelectedPickup(loc.address);
        mapRef.current?.animateToRegion({ ...c, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600);
      }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      const queryText = activeInput === 'pickup' ? pickup : destination;
      const selected = activeInput === 'pickup' ? selectedPickup : selectedPlace;
      if (queryText.length > 2 && queryText !== selected) {
        setSearchingPlaces(true);
        const results = await getPlaceAutocomplete(queryText, currentCoords?.latitude, currentCoords?.longitude);
        setSuggestions(results);
        setSearchingPlaces(false);
      } else {
        setSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [destination, pickup, selectedPlace, selectedPickup, activeInput, currentCoords]);

  const selectSuggestion = async (item: any) => {
    const details = await getPlaceDetails(item.id);
    if (activeInput === 'pickup') {
      setPickup(item.name);
      setSelectedPickup(item.name);
      if (details) setPickupCoords(details);
    } else {
      setDestination(item.name);
      setSelectedPlace(item.name);
      if (details) setDestinationCoords(details);
    }
    setSuggestions([]);
    const focus = details || pickupCoords || destinationCoords;
    if (focus) mapRef.current?.animateToRegion({ ...focus, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600);
  };

  useEffect(() => {
    if (!expandedPoolId) return;
    const unsub = onSnapshot(collection(db, 'carpool_slots', expandedPoolId, 'bookings'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPoolBookings((prev) => ({ ...prev, [expandedPoolId]: list }));
    });
    return () => unsub();
  }, [expandedPoolId]);

  const cancelPool = (id: string) => {
    Alert.alert('Cancel Pool', 'Are you sure you want to cancel this pool slot?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'carpool_slots', id), { status: 'cancelled', updated_at: serverTimestamp() });
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to cancel pool.');
          }
        },
      },
    ]);
  };

  const formatSlot = (ts?: Timestamp) => {
    if (!ts?.toDate) return '';
    const d = ts.toDate();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const statusColor = (status: string) => {
    if (status === 'open') return Colors.success;
    if (status === 'cancelled') return Colors.error;
    if (status === 'full') return Colors.warning;
    return Colors.gray400;
  };

  const adjust = (kind: 'day' | 'hour' | 'min', delta: number) => {
    const next = new Date(scheduled);
    if (kind === 'day') next.setDate(next.getDate() + delta);
    if (kind === 'hour') next.setHours(next.getHours() + delta);
    if (kind === 'min') next.setMinutes(next.getMinutes() + delta * 15);
    setScheduled(next);
  };

  const dateLabel = `${scheduled.getFullYear()}-${pad(scheduled.getMonth() + 1)}-${pad(scheduled.getDate())}`;
  const timeLabel = `${pad(scheduled.getHours())}:${pad(scheduled.getMinutes())}`;

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    input: { 
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      color: isDark ? Colors.white : Colors.gray900,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200
    },
    divider: { backgroundColor: isDark ? Colors.darkBorder : Colors.gray100 }
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 }]}>
          <Ionicons name="arrow-back" size={24} color={isDark ? Colors.white : Colors.gray900} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.text]}>Create Pool Slot</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Route Information</Text>
        <View style={[styles.card, dynamicStyles.card]}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pickup</Text>
            <View style={[styles.input, dynamicStyles.input, styles.searchRow]}>
              <Ionicons name="navigate" size={18} color={Colors.success} />
              <TextInput
                style={[styles.searchInput, { color: isDark ? Colors.white : Colors.gray900 }]}
                placeholder="Search pickup..."
                placeholderTextColor={Colors.gray500}
                value={pickup}
                onFocus={() => setActiveInput('pickup')}
                onChangeText={(text) => { setPickup(text); if (selectedPickup) setSelectedPickup(null); if (pickupCoords) setPickupCoords(null); }}
              />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Destination</Text>
            <View style={[styles.input, dynamicStyles.input, styles.searchRow]}>
              <Ionicons name="search" size={18} color={Colors.gray400} />
              <TextInput
                style={[styles.searchInput, { color: isDark ? Colors.white : Colors.gray900 }]}
                placeholder="Search destination..."
                placeholderTextColor={Colors.gray500}
                value={destination}
                onFocus={() => setActiveInput('destination')}
                onChangeText={(text) => {
                  setDestination(text);
                  if (selectedPlace) setSelectedPlace(null);
                  if (destinationCoords) setDestinationCoords(null);
                }}
              />
              {searchingPlaces && <ActivityIndicator size="small" color={Colors.primary} />}
              {destination.length > 0 && !searchingPlaces && (
                <TouchableOpacity onPress={() => { setDestination(''); setSelectedPlace(null); setDestinationCoords(null); setSuggestions([]); }}>
                  <Ionicons name="close-circle" size={18} color={Colors.gray400} />
                </TouchableOpacity>
              )}
            </View>

            {suggestions.length > 0 && (
              <View style={[styles.suggestBox, { backgroundColor: isDark ? Colors.gray900 : Colors.white, borderColor: isDark ? Colors.darkBorder : Colors.gray200 }]}>
                {suggestions.map((item) => (
                  <TouchableOpacity key={item.id} style={[styles.suggestRow, dynamicStyles.divider]} onPress={() => selectSuggestion(item)}>
                    <Ionicons name="location-outline" size={18} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.suggestName, dynamicStyles.text]} numberOfLines={1}>{item.name}</Text>
                      <Text style={[styles.rowSub, dynamicStyles.subText]} numberOfLines={1}>{item.address}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.mapPreview}>
              <MapView
                key={isDark ? 'pool-dark' : 'pool-light'}
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                initialRegion={currentCoords ? { ...currentCoords, latitudeDelta: 0.02, longitudeDelta: 0.02 } : UTEM_REGION}
                showsUserLocation
                showsMyLocationButton={false}
              >
                {pickupCoords && (
                  <Marker coordinate={pickupCoords} title={selectedPickup || 'Pickup'} pinColor={Colors.success} />
                )}
                {destinationCoords && (
                  <Marker coordinate={destinationCoords} title={selectedPlace || 'Destination'} pinColor={Colors.error} />
                )}
                {pickupCoords && destinationCoords && (
                  <Polyline coordinates={[pickupCoords, destinationCoords]} strokeColor={Colors.primary} strokeWidth={3} />
                )}
              </MapView>
              {!destinationCoords && (
                <View style={styles.mapHint} pointerEvents="none">
                  <Text style={styles.mapHintText}>Search a destination to drop a pin</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Schedule</Text>
        <View style={[styles.card, dynamicStyles.card]}>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.md }]}>
              <Text style={styles.label}>Date</Text>
              <View style={[styles.input, dynamicStyles.input, styles.picker]}>
                <TouchableOpacity onPress={() => adjust('day', -1)} style={styles.adjustBtn}>
                  <Ionicons name="chevron-back" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={[dynamicStyles.text, { fontWeight: FontWeight.semibold }]}>{dateLabel}</Text>
                <TouchableOpacity onPress={() => adjust('day', 1)} style={styles.adjustBtn}>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Time</Text>
              <View style={[styles.input, dynamicStyles.input, styles.picker]}>
                <TouchableOpacity onPress={() => adjust('hour', -1)} style={styles.adjustBtn}>
                  <Ionicons name="chevron-back" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={[dynamicStyles.text, { fontWeight: FontWeight.semibold }]}>{timeLabel}</Text>
                <TouchableOpacity onPress={() => adjust('hour', 1)} style={styles.adjustBtn}>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Pricing</Text>
        <View style={[styles.card, dynamicStyles.card]}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Price per seat (RM)</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder="e.g. 2.50"
              placeholderTextColor={Colors.gray500}
              keyboardType="decimal-pad"
              value={pricePerSeat}
              onChangeText={setPricePerSeat}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={[styles.card, dynamicStyles.card]}>
          <View style={styles.rowItem}>
            <View style={{ flex: 1, paddingRight: Spacing.sm }}>
              <Text style={[styles.rowLabel, dynamicStyles.text]}>Available Seats</Text>
              <Text style={[styles.rowSub, dynamicStyles.subText]}>How many passengers can join?</Text>
            </View>
            <View style={styles.counter}>
              <TouchableOpacity onPress={() => setSeats(Math.max(1, seats - 1))} style={styles.counterBtn}>
                <Ionicons name="remove" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.counterVal, dynamicStyles.text]}>{seats}</Text>
              <TouchableOpacity onPress={() => setSeats(Math.min(6, seats + 1))} style={styles.counterBtn}>
                <Ionicons name="add" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={[styles.divider, dynamicStyles.divider]} />

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
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          disabled={submitting}
          onPress={async () => {
            if (!user) {
              Alert.alert('Not signed in', 'Please log in as a driver.');
              return;
            }
            if (!user.is_2FA_verified) {
              Alert.alert('2FA Required', 'Please complete 2FA verification first.');
              return;
            }
            if (!pickup.trim()) {
              Alert.alert('Missing pickup', 'Please enter a pickup location.');
              return;
            }
            if (!destination.trim()) {
              Alert.alert('Missing destination', 'Please enter a destination.');
              return;
            }
            const numericPrice = parseFloat(pricePerSeat);
            if (isNaN(numericPrice) || numericPrice <= 0) {
              Alert.alert('Invalid price', 'Enter a valid price per seat.');
              return;
            }
            if (scheduled.getTime() < Date.now() + 5 * 60 * 1000) {
              Alert.alert('Invalid time', 'Pick a time at least 5 minutes from now.');
              return;
            }

            setSubmitting(true);
            try {
              await addDoc(collection(db, 'carpool_slots'), {
                driver_id: user.id,
                driver_name: user.name,
                driver_vehicle: `${user.vehicleModel || ''} ${user.vehicleColor ? `(${user.vehicleColor})` : ''}`.trim(),
                driver_plate: user.vehiclePlate || '',
                pickup: pickup.trim(),
                pickup_coords: pickupCoords,
                destination: destination.trim(),
                destination_coords: destinationCoords,
                date_time: Timestamp.fromDate(scheduled),
                seats_total: seats,
                seats_booked: 0,
                price_per_seat: numericPrice,
                gender_matching: genderMatching,
                driver_gender: user.gender,
                status: 'open',
                created_at: serverTimestamp(),
              });
              setDestination('');
              setSelectedPlace(null);
              setDestinationCoords(null);
              setPricePerSeat('');
              Alert.alert('Success', 'Pool slot published.');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to publish pool slot.');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitText}>Publish Pool Slot</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Your Pools</Text>
        {myPools.length === 0 ? (
          <View style={[styles.card, dynamicStyles.card, { alignItems: 'center', paddingVertical: Spacing.lg }]}>
            <Ionicons name="people-outline" size={28} color={Colors.gray400} />
            <Text style={[styles.rowSub, dynamicStyles.subText, { marginTop: Spacing.xs }]}>You haven't published any pools yet.</Text>
          </View>
        ) : (
          myPools.map((pool) => (
            <View key={pool.id} style={[styles.card, dynamicStyles.card, { marginBottom: Spacing.sm }]}>
              <View style={styles.poolTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.poolDest, dynamicStyles.text]} numberOfLines={1}>{pool.destination}</Text>
                  <Text style={[styles.rowSub, dynamicStyles.subText]}>{formatSlot(pool.date_time)}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusColor(pool.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor(pool.status) }]}>{pool.status.toUpperCase()}</Text>
                </View>
              </View>
              <View style={[styles.divider, dynamicStyles.divider]} />
              <View style={styles.poolMeta}>
                <View style={styles.poolMetaItem}>
                  <Ionicons name="people" size={16} color={Colors.gray400} />
                  <Text style={[styles.rowSub, dynamicStyles.subText]}>{pool.seats_booked}/{pool.seats_total} seats</Text>
                </View>
                <View style={styles.poolMetaItem}>
                  <Ionicons name="cash-outline" size={16} color={Colors.gray400} />
                  <Text style={[styles.rowSub, dynamicStyles.subText]}>RM {Number(pool.price_per_seat).toFixed(2)}/seat</Text>
                </View>
                {pool.status === 'open' && (
                  <TouchableOpacity style={styles.cancelPoolBtn} onPress={() => cancelPool(pool.id)}>
                    <Ionicons name="close-circle-outline" size={16} color={Colors.error} />
                    <Text style={styles.cancelPoolText}>Cancel</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.cancelPoolBtn} onPress={() => setExpandedPoolId(expandedPoolId === pool.id ? null : pool.id)}>
                  <Ionicons name="people-outline" size={16} color={Colors.primary} />
                  <Text style={[styles.cancelPoolText, { color: Colors.primary }]}>Passengers</Text>
                </TouchableOpacity>
              </View>
              {expandedPoolId === pool.id && (
                <View style={{ marginTop: Spacing.sm }}>
                  {(poolBookings[pool.id] || []).length === 0 ? (
                    <Text style={[styles.rowSub, dynamicStyles.subText]}>No passengers joined yet.</Text>
                  ) : (
                    (poolBookings[pool.id] || []).map((b) => (
                      <View key={b.id} style={[styles.passengerRow, { borderColor: isDark ? Colors.darkBorder : Colors.gray200 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.poolDest, dynamicStyles.text]}>{b.passenger_name || b.passenger_id}</Text>
                          <Text style={[styles.rowSub, dynamicStyles.subText]}>{b.passenger_phone || '—'} · {b.payment_method?.toUpperCase()} · {b.payment_status || b.status}</Text>
                        </View>
                        {b.passenger_phone ? (
                          <TouchableOpacity onPress={() => Linking.openURL(`tel:${b.passenger_phone}`)}>
                            <Ionicons name="call" size={18} color={Colors.primary} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.lg, marginBottom: Spacing.sm, marginLeft: 4 },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.sm },
  inputGroup: { marginBottom: Spacing.sm },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.gray500, marginBottom: 8, textTransform: 'uppercase' },
  input: { height: 50, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: FontSize.md, justifyContent: 'center' },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adjustBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row' },
  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  rowLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  rowSub: { fontSize: FontSize.xs, marginTop: 2 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  counterBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  counterVal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, minWidth: 20, textAlign: 'center' },
  divider: { height: 1, marginVertical: Spacing.md },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.xl, ...Shadows.md },
  submitText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  poolTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  poolDest: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  statusPill: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4, marginLeft: Spacing.sm },
  statusText: { fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  poolMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  poolMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cancelPoolBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  cancelPoolText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.error },
  passengerRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.xs },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSize.md },
  suggestBox: { borderWidth: 1, borderRadius: BorderRadius.md, marginTop: Spacing.xs, overflow: 'hidden' },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderBottomWidth: 1 },
  suggestName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  mapPreview: { height: 180, borderRadius: BorderRadius.md, overflow: 'hidden', marginTop: Spacing.sm, backgroundColor: Colors.gray100 },
  mapHint: { position: 'absolute', bottom: Spacing.sm, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  mapHintText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.medium },
});
