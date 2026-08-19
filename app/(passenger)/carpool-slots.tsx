import { useEffect, useState, useRef, useMemo } from 'react';
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
  ScrollView,
  TextInput,
  Switch,
  Animated,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  setDoc,
  where,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { getCurrentLocationAddress, getPlaceAutocomplete, getPlaceDetails } from '@/utils/location';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const UTEM_REGION = {
  latitude: 2.3086,
  longitude: 102.3197,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

interface PoolSlot {
  id: string;
  driver_id?: string;
  passenger_id?: string;
  driver_name?: string;
  passenger_name?: string;
  driver_vehicle?: string;
  driver_plate?: string;
  driver_gender?: string;
  passenger_gender?: string;
  pickup?: string;
  pickup_coords?: { latitude: number; longitude: number };
  destination: string;
  destination_coords?: { latitude: number; longitude: number };
  date_time?: any;
  seats_total?: number;
  seats_booked?: number;
  price_per_seat?: number;
  gender_matching?: boolean;
  status: string;
  type?: string;
}

function formatSlot(ts: any) {
  if (!ts?.toDate && !ts?.toMillis) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts.toMillis());
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

  // Tab panel state: 'available' | 'my_requests'
  const [activeTab, setActiveTab] = useState<'available' | 'my_requests'>('available');
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Pools state
  const [pools, setPools] = useState<PoolSlot[]>([]);
  const [myRequests, setMyRequests] = useState<PoolSlot[]>([]);
  const [loading, setLoading] = useState(true);

  // Booking modal state
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [selectedPool, setSelectedPool] = useState<PoolSlot | null>(null);
  const [payMethod, setPayMethod] = useState<'cash' | 'fpx' | 'card' | 'wallet'>('cash');
  const [pickupAddress, setPickupAddress] = useState('');
  const [joinedPools, setJoinedPools] = useState<Record<string, boolean>>({});
  const [bookingStatuses, setBookingStatuses] = useState<Record<string, 'pending' | 'confirmed' | 'rejected'>>({});

  // Passenger carpool creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reqPickup, setReqPickup] = useState('');
  const [reqDestination, setReqDestination] = useState('');
  const [reqPickupCoords, setReqPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [reqDestCoords, setReqDestCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeInput, setActiveInput] = useState<'pickup' | 'destination'>('destination');
  const [reqGenderMatching, setReqGenderMatching] = useState(true);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [locating, setLocating] = useState(false);

  // Date & Time Spinner Modal State (identical to set-destination.tsx)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scheduledDayOffset, setScheduledDayOffset] = useState(0); // 0 = Today, 1 = Tomorrow
  const [spinnerHour, setSpinnerHour] = useState(8);
  const [spinnerMinute, setSpinnerMinute] = useState(0);
  const [scheduledTimeLabel, setScheduledTimeLabel] = useState<string | null>(null);

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d;
  }, []);
  const [scheduledDate, setScheduledDate] = useState<Date>(tomorrow);

  const mapRef = useRef<MapView>(null);

  // Switch tab animation
  const handleTabChange = (tab: 'available' | 'my_requests') => {
    setActiveTab(tab);
    Animated.timing(slideAnim, {
      toValue: tab === 'available' ? 0 : -SCREEN_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  // Fetch available driver pools
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
            if (p.passenger_id === user?.id) return false;
            if (p.type === 'passenger_request') return false;
            if ((p.seats_booked ?? 0) >= (p.seats_total ?? 0)) return false;

            // Strict Gender Matching Filter (Request 3)
            if (p.gender_matching && p.driver_gender && user?.gender) {
              if (p.driver_gender.toLowerCase() !== user.gender.toLowerCase()) {
                return false;
              }
            }

            const slotMs = p.date_time?.toMillis?.() || 0;
            return slotMs > now - 30 * 60 * 1000;
          });

        list.sort(
          (a, b) => (a.date_time?.toMillis?.() || 0) - (b.date_time?.toMillis?.() || 0)
        );
        setPools(list);

        // Hydrate joinedPools and bookingStatuses state
        const joinedMap: Record<string, boolean> = {};
        const statusMap: Record<string, 'pending' | 'confirmed' | 'rejected'> = {};

        list.forEach((p: any) => {
          if (p.bookings && user?.id && p.bookings[user.id]) {
            joinedMap[p.id] = true;
            statusMap[p.id] = p.bookings[user.id].status || 'pending';
          }
        });

        if (user?.id && list.length > 0) {
          Promise.all(
            list.map(async (p) => {
              try {
                const bSnap = await getDoc(doc(db, 'carpool_slots', p.id, 'bookings', user.id));
                if (bSnap.exists()) {
                  joinedMap[p.id] = true;
                  const bData = bSnap.data();
                  if (bData?.status) {
                    statusMap[p.id] = bData.status;
                  }
                }
              } catch {}
            })
          ).then(() => {
            setJoinedPools((prev) => ({ ...prev, ...joinedMap }));
            setBookingStatuses((prev) => ({ ...prev, ...statusMap }));
          });
        } else {
          setJoinedPools((prev) => ({ ...prev, ...joinedMap }));
          setBookingStatuses((prev) => ({ ...prev, ...statusMap }));
        }

        setLoading(false);
      },
      (err) => {
        console.warn('[CarpoolSlots] Failed to fetch pools:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [user?.id]);

  // Fetch passenger's own requests
  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(db, 'carpool_slots'),
      where('passenger_id', '==', user.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PoolSlot, 'id'>) }));
      
      const getPriority = (p: PoolSlot) => {
        if (p.status === 'cancelled') return 3;
        if (p.driver_id || p.type === 'driver_accepted' || p.status === 'accepted') return 2;
        return 1; // Pending
      };

      list.sort((a, b) => {
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
        return (b.date_time?.toMillis?.() || 0) - (a.date_time?.toMillis?.() || 0);
      });

      setMyRequests(list);
    });
    return unsub;
  }, [user?.id]);

  // Handle autocomplete input change
  const handleInputChange = async (text: string) => {
    if (activeInput === 'pickup') {
      setReqPickup(text);
    } else {
      setReqDestination(text);
    }

    if (!text.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const results = await getPlaceAutocomplete(text, reqPickupCoords?.latitude || 2.3086, reqPickupCoords?.longitude || 102.3197);
      setSuggestions(results);
    } catch (e) {
      console.warn('Place autocomplete error:', e);
    }
  };

  const handleSelectPlace = async (place: any) => {
    let coords = place.coords;
    if (!coords && place.id) {
      const details = await getPlaceDetails(place.id);
      if (details) coords = details;
    }
    if (!coords) {
      coords = { latitude: 2.3086, longitude: 102.3197 };
    }

    if (activeInput === 'pickup') {
      setReqPickup(place.name ? `${place.name}, ${place.address || ''}` : place.address);
      setReqPickupCoords(coords);
    } else {
      setReqDestination(place.name ? `${place.name}, ${place.address || ''}` : place.address);
      setReqDestCoords(coords);
    }
    setSuggestions([]);

    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        600
      );
    }
  };

  const handleReqLocateMe = async () => {
    setLocating(true);
    const loc = await getCurrentLocationAddress();
    if (loc?.coords) {
      setReqPickup(loc.address);
      setReqPickupCoords(loc.coords);
    } else {
      Alert.alert('Location Error', 'Unable to detect your current location.');
    }
    setLocating(false);
  };

  const [locatingJoin, setLocatingJoin] = useState(false);
  const handleJoinLocateMe = async () => {
    setLocatingJoin(true);
    const loc = await getCurrentLocationAddress();
    if (loc?.address) {
      setPickupAddress(loc.address);
    } else {
      Alert.alert('Location Error', 'Unable to detect your current location.');
    }
    setLocatingJoin(false);
  };

  // Submit passenger carpool request
  const handlePublishRequest = async () => {
    if (!reqPickup.trim() || !reqDestination.trim()) {
      Alert.alert('Incomplete Fields', 'Please select both pickup and destination addresses.');
      return;
    }
    if (!user) return;

    const selectedTimeMs = scheduledDate.getTime();
    if (selectedTimeMs < Date.now() + 5 * 60 * 1000) {
      Alert.alert('Invalid Time', 'Please pick a time at least 5 minutes in the future.');
      return;
    }

    // 10-minute collision check
    const collision = myRequests.some((p) => {
      if (p.status === 'cancelled') return false;
      const poolTimeMs = p.date_time?.toMillis?.() || 0;
      return Math.abs(poolTimeMs - selectedTimeMs) < 10 * 60 * 1000;
    });

    if (collision) {
      Alert.alert(
        'Time Collision Notice',
        'You have created a carpool for the selected time. Please select a time at least 10 minutes apart from the existing pool.'
      );
      return;
    }

    setCreatingRequest(true);
    try {
      await addDoc(collection(db, 'carpool_slots'), {
        passenger_id: user.id,
        passenger_name: user.name,
        passenger_phone: user.phone || '',
        passenger_gender: user.gender || 'Male',
        pickup: reqPickup.trim(),
        pickup_coords: reqPickupCoords || { latitude: 2.3086, longitude: 102.3197 },
        destination: reqDestination.trim(),
        destination_coords: reqDestCoords || { latitude: 2.3100, longitude: 102.3200 },
        seats_total: 1,
        seats_booked: 0,
        price_per_seat: 0,
        gender_matching: reqGenderMatching,
        status: 'open',
        type: 'passenger_request',
        created_at: serverTimestamp(),
        date_time: scheduledDate,
      });

      Alert.alert(
        'Carpool Request Published! 🎉',
        'Your request is now live. Nearby drivers can view and accept your carpool request.'
      );
      setShowCreateModal(false);
      setReqPickup('');
      setReqDestination('');
      setReqPickupCoords(null);
      setReqDestCoords(null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create carpool request.');
    } finally {
      setCreatingRequest(false);
    }
  };

  // Cancel passenger's carpool request
  const handleCancelMyRequest = (reqId: string) => {
    Alert.alert(
      'Cancel Carpool Request',
      'Are you sure you want to cancel this carpool request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'carpool_slots', reqId), {
                status: 'cancelled',
                cancelled_at: serverTimestamp(),
              });

              if (user?.id) {
                const q = query(
                  collection(db, 'transactions'),
                  where('ride_id', '==', reqId),
                  where('user_id', '==', user.id),
                  where('status', '==', 'held')
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                  let refundTotal = 0;
                  const batch = writeBatch(db);
                  snap.forEach((d) => {
                    batch.update(d.ref, { status: 'refunded' });
                    refundTotal += Math.abs(d.data().amount || 0);
                  });
                  if (refundTotal > 0) {
                    const refundRef = doc(collection(db, 'transactions'));
                    batch.set(refundRef, {
                      user_id: user.id,
                      ride_id: reqId,
                      amount: refundTotal,
                      payment_method: 'wallet',
                      transaction_type: 'refund',
                      label: 'Refund: Carpool request cancelled',
                      role: 'passenger',
                      status: 'completed',
                      created_at: serverTimestamp(),
                    });
                    const userRef = doc(db, 'users', user.id);
                    batch.update(userRef, {
                      wallet_balance: increment(refundTotal),
                      updated_at: serverTimestamp(),
                    });
                    await batch.commit();
                  }
                }
              }

              Alert.alert('Cancelled', 'Your carpool request has been cancelled.');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to cancel carpool request.');
            }
          },
        },
      ]
    );
  };

  // Confirm date & time spinner selection
  const handleConfirmSpinnerTime = () => {
    const totalMin = spinnerHour * 60 + spinnerMinute;
    const minAllowed = 7 * 60 + 30; // 7:30 AM = 450 min
    const maxAllowed = 22 * 60 + 30; // 10:30 PM = 1350 min

    if (totalMin < minAllowed || totalMin > maxAllowed) {
      Alert.alert('Time Restriction', 'Rides can only be scheduled between 7:30 AM and 10:30 PM.');
      return;
    }

    // PAST TIME RESTRICTION FOR TODAY
    if (scheduledDayOffset === 0) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      if (spinnerHour < currentHour || (spinnerHour === currentHour && spinnerMinute <= currentMin)) {
        Alert.alert(
          'Invalid Time Selection',
          'You cannot schedule a ride for a past time. Please select a future time after current time.'
        );
        return;
      }
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + scheduledDayOffset);
    targetDate.setHours(spinnerHour, spinnerMinute, 0, 0);

    setScheduledDate(targetDate);
    setScheduledTimeLabel(
      targetDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    );
    setShowDatePicker(false);
  };

  // Join driver's pool logic
  const confirmJoin = async () => {
    if (!selectedPool || !user) return;
    if (!pickupAddress.trim()) {
      Alert.alert('Pickup Required', 'Please enter a pickup location.');
      return;
    }

    setJoiningId(selectedPool.id);
    try {
      const bookingRef = doc(db, 'carpool_slots', selectedPool.id, 'bookings', user.id);
      const existing = await getDoc(bookingRef);
      if (existing.exists() && existing.data()?.status !== 'rejected') {
        Alert.alert('Already Booked', `You have already requested to join ${selectedPool.driver_name}'s pool.`);
        setJoiningId(null);
        return;
      }

      // 1. Write booking to sub-collection so driver's create-pool screen receives the booking in real time
      await setDoc(bookingRef, {
        passenger_id: user.id,
        passenger_name: user.name,
        passenger_phone: user.phone || '',
        pickup: pickupAddress.trim(),
        pickup_address: pickupAddress.trim(),
        status: 'pending',
        payment_method: payMethod,
        booked_at: new Date().toISOString(),
      });

      // 2. Update main slot document map
      await updateDoc(doc(db, 'carpool_slots', selectedPool.id), {
        [`bookings.${user.id}`]: {
          passenger_id: user.id,
          passenger_name: user.name,
          passenger_phone: user.phone || '',
          pickup: pickupAddress.trim(),
          pickup_address: pickupAddress.trim(),
          status: 'pending',
          payment_method: payMethod,
          booked_at: new Date().toISOString(),
        },
      });

      setJoinedPools((prev) => ({ ...prev, [selectedPool.id]: true }));
      setBookingStatuses((prev) => ({ ...prev, [selectedPool.id]: 'pending' }));
      setSelectedPool(null);
      setPickupAddress('');
      Alert.alert(
        'Request Sent',
        `Your request to join ${selectedPool.driver_name}'s pool has been sent.`
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to request pool.');
    } finally {
      setJoiningId(null);
    }
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 }]}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? Colors.white : Colors.gray900} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.text]}>Carpool</Text>
        <TouchableOpacity
          style={styles.requestBtnHeader}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={18} color={Colors.white} />
          <Text style={styles.requestBtnText}>Request</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Tab Navigator */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeTab === 'available' && styles.segmentBtnActive,
          ]}
          onPress={() => handleTabChange('available')}
        >
          <Ionicons
            name="car-outline"
            size={18}
            color={activeTab === 'available' ? Colors.white : isDark ? Colors.gray400 : Colors.gray600}
          />
          <Text
            style={[
              styles.segmentText,
              activeTab === 'available' && styles.segmentTextActive,
            ]}
          >
            Available Pools ({pools.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeTab === 'my_requests' && styles.segmentBtnActive,
          ]}
          onPress={() => handleTabChange('my_requests')}
        >
          <Ionicons
            name="paper-plane-outline"
            size={18}
            color={activeTab === 'my_requests' ? Colors.white : isDark ? Colors.gray400 : Colors.gray600}
          />
          <Text
            style={[
              styles.segmentText,
              activeTab === 'my_requests' && styles.segmentTextActive,
            ]}
          >
            My Requests ({myRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sliding Panels */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View
          style={[
            styles.slidingContainer,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Panel 1: Available Driver Pools */}
          <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
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
                    <Ionicons
                      name="people-outline"
                      size={64}
                      color={isDark ? Colors.gray700 : Colors.gray300}
                    />
                    <Text style={[styles.emptyText, dynamicStyles.text]}>
                      No available driver pools for now.
                    </Text>
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
                            <Polyline
                              coordinates={[item.pickup_coords, item.destination_coords]}
                              strokeColor={Colors.primary}
                              strokeWidth={3}
                            />
                          </MapView>
                        </View>
                      )}

                      <View style={styles.poolHeader}>
                        <View style={styles.driverInfo}>
                          <View style={styles.avatar}>
                            <Ionicons name="person" size={20} color={Colors.white} />
                          </View>
                          <View>
                            <Text style={[styles.driverName, dynamicStyles.text]}>
                              {item.driver_name}
                            </Text>
                            <Text style={[styles.vehicleText, dynamicStyles.subText]} numberOfLines={1}>
                              {item.driver_vehicle || 'Vehicle'}
                            </Text>
                            {item.gender_matching ? (
                              <View
                                style={{
                                  backgroundColor:
                                    (item.driver_gender === 'Female' ? '#E91E63' : '#0057B8') +
                                    '20',
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 10,
                                  alignSelf: 'flex-start',
                                  marginTop: 3,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    color:
                                      item.driver_gender === 'Female' ? '#E91E63' : '#0057B8',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  {item.driver_gender === 'Female' ? '♀️ Female Only' : '♂️ Male Only'}
                                </Text>
                              </View>
                            ) : (
                              <View
                                style={{
                                  backgroundColor: Colors.gray200,
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 10,
                                  alignSelf: 'flex-start',
                                  marginTop: 3,
                                }}
                              >
                                <Text style={{ fontSize: 10, color: Colors.gray700, fontWeight: 'bold' }}>
                                  🚻 Any Gender
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.priceText}>
                            RM {Number(item.price_per_seat || 0).toFixed(2)}
                          </Text>
                          <Text style={[styles.vehicleText, dynamicStyles.subText]}>per seat</Text>
                        </View>
                      </View>

                      <View style={styles.divider} />

                      <View style={styles.poolDetails}>
                        <View style={styles.detailRow}>
                          <Ionicons name="navigate" size={16} color={Colors.success} />
                          <Text style={[styles.detailText, dynamicStyles.text]} numberOfLines={1}>
                            {item.pickup || 'Pickup TBC'}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="location" size={16} color={Colors.error} />
                          <Text style={[styles.detailText, dynamicStyles.text]} numberOfLines={1}>
                            {item.destination}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="time" size={16} color={Colors.primary} />
                          <Text style={[styles.detailText, dynamicStyles.text]}>
                            {formatSlot(item.date_time)}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="people" size={16} color={Colors.success} />
                          <Text style={[styles.detailText, dynamicStyles.text]}>
                            {seatsLeft} seat{seatsLeft !== 1 ? 's' : ''} left
                          </Text>
                        </View>
                      </View>

                      {bookingStatuses[item.id] === 'rejected' ? (
                        <View style={{ padding: Spacing.md }}>
                          <View
                            style={{
                              backgroundColor: Colors.error + '20',
                              padding: 8,
                              borderRadius: BorderRadius.sm,
                              alignItems: 'center',
                              marginBottom: 8,
                            }}
                          >
                            <Text style={{ color: Colors.error, fontWeight: 'bold', fontSize: 12 }}>
                              ✕ Request Rejected by Driver
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.joinBtn, { backgroundColor: '#E65100', margin: 0, flexDirection: 'row', gap: 6, justifyContent: 'center' }]}
                            onPress={() => {
                              setPayMethod('cash');
                              setSelectedPool(item);
                            }}
                          >
                            <Ionicons name="location-outline" size={18} color={Colors.white} />
                            <Text style={styles.joinText}>Change Pickup Address</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.joinBtn,
                            joinedPools[item.id] && {
                              backgroundColor: isDark ? Colors.gray800 : Colors.gray300,
                            },
                          ]}
                          disabled={joinedPools[item.id]}
                          onPress={() => {
                            setPayMethod('cash');
                            setSelectedPool(item);
                          }}
                        >
                          <Text
                            style={[
                              styles.joinText,
                              joinedPools[item.id] && {
                                color: isDark ? Colors.gray500 : Colors.gray600,
                              },
                            ]}
                          >
                            {bookingStatuses[item.id] === 'confirmed'
                              ? '✓ Joined Pool'
                              : joinedPools[item.id]
                              ? 'Requested to join pool'
                              : 'Join Pool'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
              />
            )}
          </View>

          {/* Panel 2: My Created Pool Requests */}
          <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
            <FlatList
              data={myRequests}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons
                    name="paper-plane-outline"
                    size={64}
                    color={isDark ? Colors.gray700 : Colors.gray300}
                  />
                  <Text style={[styles.emptyText, dynamicStyles.text]}>
                    You haven't requested any carpool rides yet.
                  </Text>
                  <TouchableOpacity
                    style={[styles.requestBtnHeader, { marginTop: Spacing.md }]}
                    onPress={() => setShowCreateModal(true)}
                  >
                    <Ionicons name="add" size={18} color={Colors.white} />
                    <Text style={styles.requestBtnText}>Create Carpool Request</Text>
                  </TouchableOpacity>
                </View>
              }
              renderItem={({ item }) => {
                const isCancelled = item.status === 'cancelled';
                const isAccepted = !isCancelled && (!!item.driver_id || item.type === 'driver_accepted' || item.status === 'accepted');
                const isPending = !isCancelled && !isAccepted;

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
                          <Polyline
                            coordinates={[item.pickup_coords, item.destination_coords]}
                            strokeColor={Colors.primary}
                            strokeWidth={3}
                          />
                        </MapView>
                      </View>
                    )}

                    <View style={styles.poolHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.driverName, dynamicStyles.text]}>
                          Carpool Request
                        </Text>
                        <Text style={[styles.vehicleText, dynamicStyles.subText]}>
                          {item.gender_matching ? '🔒 Gender Matching ON' : '🚻 Any Gender'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          isPending && styles.statusBadgePending,
                          isAccepted && styles.statusBadgeAccepted,
                          isCancelled && styles.statusBadgeCancelled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isPending && { color: '#B78103' },
                            isAccepted && { color: Colors.success },
                            isCancelled && { color: Colors.gray600 },
                          ]}
                        >
                          {isPending ? 'Pending' : isAccepted ? 'Accepted' : 'Cancelled'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.poolDetails}>
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
                      <View style={styles.detailRow}>
                        <Ionicons name="time" size={16} color={Colors.primary} />
                        <Text style={[styles.detailText, dynamicStyles.text]}>
                          {formatSlot(item.date_time)}
                        </Text>
                      </View>
                    </View>

                    {/* Driver details if Accepted (replaces Cancel Request button) */}
                    {isAccepted && (
                      <View style={[styles.acceptedDriverBox, { backgroundColor: isDark ? Colors.gray900 : Colors.gray100 }]}>
                        <View style={styles.driverInfo}>
                          <View style={styles.avatar}>
                            <Ionicons name="person" size={20} color={Colors.white} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.driverName, dynamicStyles.text]}>
                              {item.driver_name ? `Driver: ${item.driver_name}` : 'Driver Accepted'}
                            </Text>
                            <Text style={[styles.vehicleText, dynamicStyles.subText]} numberOfLines={1}>
                              {item.driver_vehicle || 'Vehicle Details'}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.priceText}>
                              RM {Number(item.price_per_seat || 0).toFixed(2)}
                            </Text>
                            <Text style={[styles.vehicleText, dynamicStyles.subText]}>Agreed Fare</Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {isPending && (
                      <TouchableOpacity
                        style={styles.cancelRequestBtn}
                        onPress={() => handleCancelMyRequest(item.id)}
                      >
                        <Ionicons name="close-circle-outline" size={18} color={Colors.white} />
                        <Text style={styles.cancelRequestText}>Cancel Request</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          </View>
        </Animated.View>
      </View>

      {/* CREATE CARPOOL REQUEST MODAL (MIRRORS DRIVER CREATION LAYOUT) */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={[styles.modalFullScreen, dynamicStyles.container, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowCreateModal(false)}
              style={[styles.backBtn, { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 }]}
            >
              <Ionicons name="close" size={24} color={isDark ? Colors.white : Colors.gray900} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, dynamicStyles.text]}>Create Carpool Request</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            <View style={{ padding: Spacing.md }}>
              {/* 1. Pickup Address */}
              <Text style={[styles.modalLabel, dynamicStyles.text]}>Pickup Location</Text>
              <View
                style={[
                  styles.inputBox,
                  activeInput === 'pickup' && styles.inputBoxActive,
                  { backgroundColor: isDark ? Colors.gray900 : Colors.white },
                ]}
              >
                <Ionicons name="navigate" size={20} color={Colors.success} />
                <TextInput
                  style={[styles.inputField, dynamicStyles.text]}
                  placeholder="Select pickup address"
                  placeholderTextColor={Colors.gray400}
                  multiline
                  value={reqPickup}
                  onFocus={() => setActiveInput('pickup')}
                  onChangeText={handleInputChange}
                />
                <TouchableOpacity onPress={handleReqLocateMe} disabled={locating}>
                  {locating ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Ionicons name="locate-outline" size={22} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              </View>

              {/* 2. Destination Address */}
              <Text style={[styles.modalLabel, dynamicStyles.text, { marginTop: Spacing.md }]}>
                Destination Address
              </Text>
              <View
                style={[
                  styles.inputBox,
                  activeInput === 'destination' && styles.inputBoxActive,
                  { backgroundColor: isDark ? Colors.gray900 : Colors.white },
                ]}
              >
                <Ionicons name="location" size={20} color={Colors.error} />
                <TextInput
                  style={[styles.inputField, dynamicStyles.text]}
                  placeholder="Select destination address"
                  placeholderTextColor={Colors.gray400}
                  multiline
                  value={reqDestination}
                  onFocus={() => setActiveInput('destination')}
                  onChangeText={handleInputChange}
                />
              </View>

              {/* 3. Mini Map Preview (Positioned directly UNDER Destination input) */}
              <View style={[styles.creationMapBox, { marginTop: Spacing.md }]}>
                <MapView
                  ref={mapRef}
                  style={StyleSheet.absoluteFillObject}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  initialRegion={UTEM_REGION}
                >
                  {reqPickupCoords && (
                    <Marker coordinate={reqPickupCoords} title="Pickup" pinColor={Colors.success} />
                  )}
                  {reqDestCoords && (
                    <Marker coordinate={reqDestCoords} title="Destination" pinColor={Colors.error} />
                  )}
                  {reqPickupCoords && reqDestCoords && (
                    <Polyline
                      coordinates={[reqPickupCoords, reqDestCoords]}
                      strokeColor={Colors.primary}
                      strokeWidth={4}
                    />
                  )}
                </MapView>
              </View>

              {/* Autocomplete Dropdown List */}
              {suggestions.length > 0 && (
                <View
                  style={[
                    styles.suggestionsDropdown,
                    {
                      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
                      backgroundColor: isDark ? Colors.gray900 : Colors.white,
                    },
                  ]}
                >
                  {suggestions.map((item, idx) => (
                    <TouchableOpacity
                      key={item.id || idx}
                      style={styles.suggestionRow}
                      onPress={() => handleSelectPlace(item)}
                    >
                      <Ionicons name="location-outline" size={16} color={Colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.suggestionName, dynamicStyles.text]}>{item.name}</Text>
                        <Text style={dynamicStyles.subText} numberOfLines={1}>
                          {item.address}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* 4. Scheduled Ride Time Picker (Opens Ride Request Spinner Modal) */}
              <Text style={[styles.modalLabel, dynamicStyles.text, { marginTop: Spacing.md }]}>
                Scheduled Ride Time
              </Text>
              <TouchableOpacity
                style={[styles.timeCard, dynamicStyles.card]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={Colors.primary} />
                <Text style={[styles.timeText, dynamicStyles.text]}>
                  {scheduledTimeLabel ||
                    scheduledDate.toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                </Text>
              </TouchableOpacity>

              {/* 5. Gender Matching Toggle */}
              <View
                style={[
                  styles.toggleRow,
                  { backgroundColor: isDark ? Colors.gray900 : Colors.white },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 14, fontWeight: 'bold' }, dynamicStyles.text]}>
                    Gender Matching
                  </Text>
                  <Text style={[{ fontSize: 12 }, dynamicStyles.subText]}>
                    Only match drivers of your gender ({user?.gender || 'Same Gender'})
                  </Text>
                </View>
                <Switch
                  value={reqGenderMatching}
                  onValueChange={setReqGenderMatching}
                  trackColor={{ false: Colors.gray300, true: Colors.primary }}
                />
              </View>

              <TouchableOpacity
                style={[styles.publishBtn, creatingRequest && { opacity: 0.7 }]}
                disabled={creatingRequest}
                onPress={handlePublishRequest}
              >
                {creatingRequest ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.publishBtnText}>Publish Carpool Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Date & Time Spinner Modal (Identical to set-destination.tsx) */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? Colors.darkCard : Colors.white }]}>
            <Text style={[styles.modalTitle, dynamicStyles.text]}>Schedule Ride Time</Text>
            <Text style={[styles.modalSub, dynamicStyles.subText]}>
              Select date and time (Allowed: 7:30 AM – 10:30 PM)
            </Text>

            {/* Day Selector */}
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 12 }}>
              {['Today', 'Tomorrow'].map((dayOpt, idx) => {
                const isSel = scheduledDayOffset === idx;
                return (
                  <TouchableOpacity
                    key={dayOpt}
                    style={[
                      {
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 8,
                        alignItems: 'center',
                        backgroundColor: isDark ? Colors.gray900 : Colors.gray100,
                      },
                      isSel && { backgroundColor: Colors.primary },
                    ]}
                    onPress={() => setScheduledDayOffset(idx)}
                  >
                    <Text
                      style={[
                        { fontSize: 13, fontWeight: '600', color: isDark ? Colors.gray300 : Colors.gray700 },
                        isSel && { color: Colors.white },
                      ]}
                    >
                      {dayOpt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Time Spinner Controls */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 16, gap: 12 }}>
              {/* Hour Spinner */}
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: Colors.gray400, marginBottom: 4, textTransform: 'uppercase' }}>
                  Hour
                </Text>
                <ScrollView style={{ height: 120, width: 70 }} showsVerticalScrollIndicator={false}>
                  {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map((h) => {
                    const displayHour = h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`;
                    const isSel = spinnerHour === h;
                    return (
                      <TouchableOpacity
                        key={h}
                        style={[
                          { paddingVertical: 8, borderRadius: 6, alignItems: 'center', marginVertical: 2 },
                          isSel && { backgroundColor: Colors.primary },
                        ]}
                        onPress={() => setSpinnerHour(h)}
                      >
                        <Text
                          style={[
                            { fontSize: 14, color: isDark ? Colors.white : Colors.gray900 },
                            isSel && { color: Colors.white, fontWeight: 'bold' },
                          ]}
                        >
                          {displayHour}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.primary }}>:</Text>

              {/* Minute Spinner */}
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: Colors.gray400, marginBottom: 4, textTransform: 'uppercase' }}>
                  Minute
                </Text>
                <ScrollView style={{ height: 120, width: 70 }} showsVerticalScrollIndicator={false}>
                  {[0, 15, 30, 45].map((m) => {
                    const displayMin = m < 10 ? `0${m}` : `${m}`;
                    const isSel = spinnerMinute === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[
                          { paddingVertical: 8, borderRadius: 6, alignItems: 'center', marginVertical: 2 },
                          isSel && { backgroundColor: Colors.primary },
                        ]}
                        onPress={() => setSpinnerMinute(m)}
                      >
                        <Text
                          style={[
                            { fontSize: 14, color: isDark ? Colors.white : Colors.gray900 },
                            isSel && { color: Colors.white, fontWeight: 'bold' },
                          ]}
                        >
                          {displayMin}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity
              style={{ backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 }}
              onPress={handleConfirmSpinnerTime}
            >
              <Text style={{ color: Colors.white, fontWeight: 'bold', fontSize: 14 }}>Set Scheduled Time</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Join Driver Pool Modal */}
      <Modal
        visible={!!selectedPool}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPool(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, dynamicStyles.card]}>
            <Text style={[styles.modalTitle, dynamicStyles.text]}>Request Pool Seat</Text>
            <Text style={[styles.modalSub, dynamicStyles.subText]}>
              Seat price: RM {Number(selectedPool?.price_per_seat || 0).toFixed(2)}
            </Text>

            <Text style={[styles.modalLabel, dynamicStyles.subText]}>Pickup Location</Text>
            <View
              style={[
                styles.inputBox,
                { backgroundColor: isDark ? Colors.gray900 : Colors.white },
              ]}
            >
              <Ionicons name="navigate" size={18} color={Colors.success} />
              <TextInput
                style={[styles.inputField, dynamicStyles.text]}
                placeholder="Enter your pickup address"
                placeholderTextColor={Colors.gray400}
                multiline
                value={pickupAddress}
                onChangeText={setPickupAddress}
              />
              <TouchableOpacity onPress={handleJoinLocateMe} disabled={locatingJoin}>
                {locatingJoin ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Ionicons name="locate-outline" size={22} color={Colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.publishBtn, { marginTop: Spacing.md }, joiningId && { opacity: 0.7 }]}
              disabled={!!joiningId}
              onPress={confirmJoin}
            >
              {joiningId ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.publishBtnText}>Confirm & Join Pool</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelLink}
              onPress={() => setSelectedPool(null)}
            >
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  requestBtnHeader: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requestBtnText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12 },
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
    backgroundColor: Colors.gray200,
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  segmentBtnActive: { backgroundColor: Colors.primary },
  segmentText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.gray700 },
  segmentTextActive: { color: Colors.white },
  slidingContainer: { flexDirection: 'row', width: SCREEN_WIDTH * 2, flex: 1 },
  listContent: { padding: Spacing.md },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginTop: Spacing.md, textAlign: 'center' },
  poolCard: { borderRadius: BorderRadius.lg, marginBottom: Spacing.md, overflow: 'hidden', ...Shadows.md },
  mapBox: { height: 140, backgroundColor: Colors.gray100 },
  poolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  driverInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  driverName: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  vehicleText: { fontSize: FontSize.xs, marginTop: 2 },
  priceText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.gray100, marginHorizontal: Spacing.md },
  poolDetails: { gap: Spacing.xs, padding: Spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  detailText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flex: 1 },
  joinBtn: { backgroundColor: Colors.primary, margin: Spacing.md, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' },
  joinText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgePending: { backgroundColor: '#FFF3C4' },
  statusBadgeAccepted: { backgroundColor: Colors.success + '20' },
  statusBadgeCancelled: { backgroundColor: Colors.gray200 },
  statusBadgeText: { fontSize: 11, fontWeight: FontWeight.bold },
  acceptedDriverBox: { margin: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md },
  cancelRequestBtn: {
    backgroundColor: Colors.error,
    margin: Spacing.md,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cancelRequestText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  modalFullScreen: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  creationMapBox: { height: 180, width: '100%', borderRadius: BorderRadius.md, overflow: 'hidden', backgroundColor: Colors.gray100 },
  modalLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', marginBottom: 6 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  inputBoxActive: { borderColor: Colors.primary },
  inputField: { flex: 1, minHeight: 48, fontSize: FontSize.sm, paddingVertical: 8 },
  suggestionsDropdown: { borderRadius: BorderRadius.md, borderWidth: 1, maxHeight: 160, overflow: 'hidden', marginTop: 4 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: Colors.gray200 },
  suggestionName: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  timeCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md },
  timeText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.md },
  publishBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.lg },
  publishBtnText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  modalSub: { fontSize: FontSize.xs, marginBottom: Spacing.md },
  cancelLink: { alignItems: 'center', paddingVertical: Spacing.md },
});
