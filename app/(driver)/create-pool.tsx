import { View, Text, TouchableOpacity, StyleSheet, TextInput, Switch, ScrollView, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where, getDoc, increment } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { getCurrentLocationAddress, getPlaceAutocomplete, getPlaceDetails, getDirections } from '@/utils/location';

function calculateHaversineDistance(
  c1: { latitude: number; longitude: number },
  c2: { latitude: number; longitude: number }
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(c2.latitude - c1.latitude);
  const dLon = toRad(c2.longitude - c1.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(c1.latitude)) *
      Math.cos(toRad(c2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  useEffect(() => {
    if (!pickupCoords || !destinationCoords) {
      setDistanceKm(null);
      return;
    }
    let active = true;
    (async () => {
      const directions = await getDirections(
        { lat: pickupCoords.latitude, lng: pickupCoords.longitude },
        { lat: destinationCoords.latitude, lng: destinationCoords.longitude }
      );
      if (!active) return;
      if (directions && directions.distanceValue) {
        setDistanceKm(directions.distanceValue / 1000);
      } else {
        // Fallback: Haversine distance
        const distance = calculateHaversineDistance(pickupCoords, destinationCoords);
        setDistanceKm(distance);
      }
    })();
    return () => {
      active = false;
    };
  }, [pickupCoords, destinationCoords]);

  const calculatedPricePerSeat = useMemo(() => {
    if (distanceKm === null) return 0;
    const totalFare = 3.50 + distanceKm * 0.50;
    return parseFloat((totalFare / seats).toFixed(2));
  }, [distanceKm, seats]);

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

  const handleAcceptBooking = async (pool: any, booking: any) => {
    try {
      const remainingSeats = pool.seats_total - pool.seats_booked;
      if (remainingSeats <= 0) {
        Alert.alert('Pool Full', 'This pool is already full.');
        return;
      }

      const bookingRef = doc(db, 'carpool_slots', pool.id, 'bookings', booking.passenger_id);
      await updateDoc(bookingRef, {
        status: 'confirmed',
        updated_at: serverTimestamp(),
      });

      const nextBooked = (pool.seats_booked || 0) + 1;
      await updateDoc(doc(db, 'carpool_slots', pool.id), {
        seats_booked: increment(1),
        status: nextBooked >= pool.seats_total ? 'full' : 'open',
        updated_at: serverTimestamp(),
      });

      Alert.alert('Success', `Accepted ${booking.passenger_name || 'passenger'}'s request.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to accept passenger.');
    }
  };

  const handleRejectBooking = async (pool: any, booking: any) => {
    try {
      const bookingRef = doc(db, 'carpool_slots', pool.id, 'bookings', booking.passenger_id);
      await updateDoc(bookingRef, {
        status: 'rejected',
        updated_at: serverTimestamp(),
      });

      // If they paid via FPX/Card, write a refund transaction to their e-wallet balance
      if (booking.payment_method !== 'cash') {
        const amount = parseFloat(pool.price_per_seat) || 0;
        await addDoc(collection(db, 'transactions'), {
          user_id: booking.passenger_id,
          amount: amount,
          payment_method: booking.payment_method,
          transaction_type: 'refund',
          label: `Refund: Carpool seat request rejected by driver`,
          role: 'passenger',
          status: 'completed',
          created_at: serverTimestamp(),
        });
      }

      Alert.alert('Success', `Rejected ${booking.passenger_name || 'passenger'}'s request.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to reject passenger.');
    }
  };

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
                <Text style={[dynamicStyles.text, { fontWeight: FontWeight.semibold, textAlign: 'center', flex: 1 }]}>{dateLabel}</Text>
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
                <Text style={[dynamicStyles.text, { fontWeight: FontWeight.semibold, textAlign: 'center', flex: 1 }]}>{timeLabel}</Text>
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
            <View style={[styles.input, dynamicStyles.input, { justifyContent: 'center', opacity: 0.8 }]}>
              <Text style={[dynamicStyles.text, { fontWeight: FontWeight.bold }]}>
                {calculatedPricePerSeat > 0 ? `RM ${calculatedPricePerSeat.toFixed(2)}` : 'RM -- (Select route first)'}
              </Text>
            </View>
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
            if (calculatedPricePerSeat <= 0) {
              Alert.alert('Missing route or price', 'Please select a valid pickup and destination route to automatically calculate the seat price.');
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
                price_per_seat: calculatedPricePerSeat,
                gender_matching: genderMatching,
                driver_gender: user.gender,
                status: 'open',
                created_at: serverTimestamp(),
              });
              setDestination('');
              setSelectedPlace(null);
              setDestinationCoords(null);
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
              
              {/* Refactored layout to prevent overflow clipping on narrow screens */}
              <View style={styles.poolMeta}>
                <View style={styles.poolMetaItem}>
                  <Ionicons name="people" size={16} color={Colors.gray400} />
                  <Text style={[styles.rowSub, dynamicStyles.subText]}>{pool.seats_booked}/{pool.seats_total} seats</Text>
                </View>
                <View style={styles.poolMetaItem}>
                  <Ionicons name="cash-outline" size={16} color={Colors.gray400} />
                  <Text style={[styles.rowSub, dynamicStyles.subText]}>RM {Number(pool.price_per_seat).toFixed(2)}/seat</Text>
                </View>
              </View>

              <View style={styles.poolActionsRow}>
                {pool.status === 'open' && (
                  <TouchableOpacity style={[styles.poolActionBtn, styles.poolActionBtnCancel]} onPress={() => cancelPool(pool.id)}>
                    <Ionicons name="close-circle-outline" size={14} color={Colors.error} />
                    <Text style={styles.cancelPoolText}>Cancel Pool</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.poolActionBtn, styles.poolActionBtnPass]} onPress={() => setExpandedPoolId(expandedPoolId === pool.id ? null : pool.id)}>
                  <Ionicons name="people-outline" size={14} color={Colors.primary} />
                  <Text style={[styles.cancelPoolText, { color: Colors.primary }]}>
                    {expandedPoolId === pool.id ? 'Hide Passengers' : 'Passengers'}
                  </Text>
                </TouchableOpacity>
              </View>

              {expandedPoolId === pool.id && (
                <View style={{ marginTop: Spacing.sm }}>
                  {(poolBookings[pool.id] || []).length === 0 ? (
                    <Text style={[styles.rowSub, dynamicStyles.subText]}>No passengers joined yet.</Text>
                  ) : (
                    (poolBookings[pool.id] || []).map((b) => (
                      <View key={b.id} style={[styles.passengerRow, { borderColor: isDark ? Colors.darkBorder : Colors.gray200, flexDirection: 'column', alignItems: 'stretch' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.poolDest, dynamicStyles.text]}>{b.passenger_name || b.passenger_id}</Text>
                            <Text style={[styles.rowSub, dynamicStyles.subText]}>
                              {b.passenger_phone || '—'} · {b.payment_method?.toUpperCase()} · {b.status?.toUpperCase()}
                            </Text>
                          </View>
                          {b.passenger_phone ? (
                            <TouchableOpacity onPress={() => Linking.openURL(`tel:${b.passenger_phone}`)} style={{ padding: 4 }}>
                              <Ionicons name="call" size={18} color={Colors.primary} />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                        
                        {/* Passenger Pickup Address Details */}
                        <View style={{ marginTop: 6, backgroundColor: isDark ? Colors.gray900 : Colors.gray50, padding: 8, borderRadius: BorderRadius.sm }}>
                          <Text style={{ fontSize: 9, color: Colors.gray500, fontWeight: FontWeight.bold }}>PICKUP ADDRESS</Text>
                          <Text style={[styles.rowSub, dynamicStyles.text, { marginTop: 2 }]} numberOfLines={2}>
                            {b.pickup_address || 'Not specified'}
                          </Text>
                        </View>

                        {/* Driver Decisions (Accept / Reject) */}
                        {b.status === 'pending' && (
                          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: 10 }}>
                            <TouchableOpacity
                              style={[styles.bookingActionBtn, { backgroundColor: Colors.error + '15', borderColor: Colors.error + '30' }]}
                              onPress={() => handleRejectBooking(pool, b)}
                            >
                              <Ionicons name="close" size={14} color={Colors.error} />
                              <Text style={{ color: Colors.error, fontSize: FontSize.xs, fontWeight: 'bold' }}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.bookingActionBtn, { backgroundColor: Colors.success + '15', borderColor: Colors.success + '30' }]}
                              onPress={() => handleAcceptBooking(pool, b)}
                            >
                              <Ionicons name="checkmark" size={14} color={Colors.success} />
                              <Text style={{ color: Colors.success, fontSize: FontSize.xs, fontWeight: 'bold' }}>Accept</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        {b.status === 'confirmed' && (
                          <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: Colors.success + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.sm }}>
                            <Text style={{ color: Colors.success, fontSize: 10, fontWeight: 'bold' }}>✓ CONFIRMED</Text>
                          </View>
                        )}
                        {b.status === 'rejected' && (
                          <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: Colors.error + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.sm }}>
                            <Text style={{ color: Colors.error, fontSize: 10, fontWeight: 'bold' }}>✗ REJECTED</Text>
                          </View>
                        )}
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
  poolMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.md },
  poolMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cancelPoolBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cancelPoolText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.error },
  passengerRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.xs },
  poolActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  poolActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderWidth: 1, borderRadius: BorderRadius.md },
  poolActionBtnCancel: { backgroundColor: Colors.error + '10', borderColor: Colors.error + '30' },
  poolActionBtnPass: { backgroundColor: Colors.primary + '10', borderColor: Colors.primary + '30' },
  bookingActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderWidth: 1, borderRadius: BorderRadius.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSize.md },
  suggestBox: { borderWidth: 1, borderRadius: BorderRadius.md, marginTop: Spacing.xs, overflow: 'hidden' },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderBottomWidth: 1 },
  suggestName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  mapPreview: { height: 180, borderRadius: BorderRadius.md, overflow: 'hidden', marginTop: Spacing.sm, backgroundColor: Colors.gray100 },
  mapHint: { position: 'absolute', bottom: Spacing.sm, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  mapHintText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.medium },
});
