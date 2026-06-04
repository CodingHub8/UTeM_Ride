import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCurrentLocationAddress, getDirections, getNearbyPlaces, getPlaceAutocomplete, getPlaceDetails, getRecentDestinations } from '@/utils/location';

const BASE_FARES = {
  economy: 2.00,
  comfort: 3.00,
  premium: 5.00,
  motorcycle: 1.00,
  carpool: 1.50
};

const RATE_PER_KM = 1.00; 

const RIDE_TYPES = [
  { id: 'economy', name: 'Economy', icon: '🚗', basePrice: BASE_FARES.economy, seats: 4 },
  { id: 'comfort', name: 'Comfort', icon: '🚙', basePrice: BASE_FARES.comfort, seats: 4 },
  { id: 'premium', name: 'Premium', icon: '✨', basePrice: BASE_FARES.premium, seats: 6 },
  { id: 'motorcycle', name: 'Motorcycle', icon: '🏍️', basePrice: BASE_FARES.motorcycle, seats: 2 },
  { id: 'carpool', name: 'Car Pool', icon: '👥', basePrice: BASE_FARES.carpool, seats: 3 },
];

export default function SetDestinationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const { user } = useAuth();
  
  const { initialDestination, destLat, destLng } = useLocalSearchParams<{
    initialDestination?: string,
    destLat?: string,
    destLng?: string
  }>();

  const [activeInput, setActiveInput] = useState<'pickup' | 'destination'>('destination');
  const [query, setQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [selectedRide, setSelectedRide] = useState('economy');
  
  const [pickupAddress, setPickupAddress] = useState('Fetching current location...');
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number, longitude: number } | null>(null);
  const [pickupQuery, setPickupQuery] = useState('');
  const [selectedPickupPlace, setSelectedPickupPlace] = useState<string | null>(null);

  const [routeData, setRouteData] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [recommendedPlaces, setRecommendedPlaces] = useState<any[]>([]);
  const [autocompletePlaces, setAutocompletePlaces] = useState<any[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<any[]>([]);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number, longitude: number } | null>(null);
  const [genderFilter, setGenderFilter] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const recent = await getRecentDestinations();
      setRecentPlaces(recent);

      if (pickupCoords) {
        const recommended = await getNearbyPlaces(pickupCoords.latitude, pickupCoords.longitude);
        setRecommendedPlaces(recommended);
      }
    })();
  }, [pickupCoords]);

  // Handle autocomplete as user types
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      const activeQuery = activeInput === 'pickup' ? pickupQuery : query;
      const activeSelected = activeInput === 'pickup' ? selectedPickupPlace : selectedPlace;

      if (activeQuery.length > 2 && activeQuery !== activeSelected) {
        const suggestions = await getPlaceAutocomplete(activeQuery, pickupCoords?.latitude, pickupCoords?.longitude);
        setAutocompletePlaces(suggestions);
      } else if (activeQuery.length <= 2) {
        setAutocompletePlaces([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query, pickupQuery, selectedPlace, selectedPickupPlace, activeInput, pickupCoords]);

  useEffect(() => {
    (async () => {
      const loc = await getCurrentLocationAddress();
      if (loc) {
        setPickupAddress(loc.address);
        setPickupCoords(loc.coords);
        setPickupQuery(loc.address);
        setSelectedPickupPlace(loc.address);
      } else {
        setPickupAddress('Current Location');
        setPickupQuery('Current Location');
        setSelectedPickupPlace('Current Location');
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedPlace && pickupAddress) {
      (async () => {
        setIsSearching(true);
        try {
          let destination: string | { lat: number, lng: number } = selectedPlace;

          if (selectedCoords) {
            destination = { lat: selectedCoords.latitude, lng: selectedCoords.longitude };
          } else if (destLat && destLng && selectedPlace === initialDestination) {
            destination = { lat: parseFloat(destLat), lng: parseFloat(destLng) };
          }

          const directions = await getDirections(pickupAddress, destination);
          if (directions) {
            setRouteData(directions);
          }
        } finally {
          setIsSearching(false);
        }
      })();
    }
  }, [selectedPlace, pickupAddress, destLat, destLng, initialDestination, selectedCoords]);

  const calculateFare = (basePrice: number) => {
    if (!routeData) return 'RM --';
    const distanceKm = routeData.distanceValue / 1000;
    const total = basePrice + (distanceKm * RATE_PER_KM);
    return `RM ${total.toFixed(2)}`;
  };

  // Sync state with navigation params
  useEffect(() => {
    if (initialDestination) {
      setQuery(initialDestination);
      setSelectedPlace(initialDestination);

      if (destLat && destLng) {
        setSelectedCoords({
          latitude: parseFloat(destLat as string),
          longitude: parseFloat(destLng as string)
        });
      }
    }
  }, [initialDestination, destLat, destLng]);

  const getScheduledDateTimeString = (timeStr: string): string => {
    const match = timeStr.match(/(\d{2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return timeStr;
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
    
    if (targetDate <= now) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedAmPm = ampm.toLowerCase();
    
    const actualMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = targetDate.getDate();
    const month = actualMonths[targetDate.getMonth()];
    const year = targetDate.getFullYear();
    
    return `${formattedHours}:${formattedMinutes}${formattedAmPm} ${day} ${month} ${year}`;
  };

  const activeQuery = activeInput === 'pickup' ? pickupQuery : query;
  const filtered = activeQuery.length > 0
    ? (autocompletePlaces.length > 0 ? autocompletePlaces : (activeInput === 'destination' && query === initialDestination ? [{ id: 'map', name: query, address: 'Map Selection', isMap: true }] : []))
    : [...recentPlaces.map(p => ({ ...p, isRecent: true })), ...recommendedPlaces];

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.white },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    border: { borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 },
    inputContainer: {
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200
    }
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 }]}>
          <Ionicons name="arrow-back" size={24} color={isDark ? Colors.white : Colors.gray900} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.text]}>Set Destination</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Location inputs */}
      <View style={[styles.locationCard, dynamicStyles.inputContainer]}>
        <View style={styles.locationRow}>
          <View style={[styles.dot, { backgroundColor: Colors.success }]} />
          <View style={styles.locInput}>
            <Text style={styles.locLabel}>Pickup</Text>
            <View style={styles.searchInputWrapper}>
              <TextInput
                style={[styles.searchInput, dynamicStyles.text]}
                placeholder="Search pickup location..."
                placeholderTextColor={isDark ? Colors.gray600 : Colors.gray400}
                value={pickupQuery}
                onChangeText={(text) => {
                  setPickupQuery(text);
                  if (selectedPickupPlace) setSelectedPickupPlace(null);
                }}
                onFocus={() => {
                  setActiveInput('pickup');
                  if (selectedPickupPlace) setSelectedPickupPlace(null);
                }}
              />
              {pickupQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setPickupQuery('');
                    setSelectedPickupPlace(null);
                    setPickupAddress('');
                    setPickupCoords(null);
                  }}
                  style={styles.clearBtn}
                >
                  <Ionicons name="close-circle" size={20} color={isDark ? Colors.gray500 : Colors.gray400} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: isDark ? Colors.darkBorder : Colors.gray200 }]} />
        <View style={styles.locationRow}>
          <View style={[styles.dot, { backgroundColor: Colors.error }]} />
          <View style={styles.locInput}>
            <Text style={styles.locLabel}>Destination</Text>
            <View style={styles.searchInputWrapper}>
              <TextInput
                style={[styles.searchInput, dynamicStyles.text]}
                placeholder="Search destination..."
                placeholderTextColor={isDark ? Colors.gray600 : Colors.gray400}
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  if (selectedPlace) setSelectedPlace(null);
                }}
                onFocus={() => {
                  setActiveInput('destination');
                  if (selectedPlace) setSelectedPlace(null);
                }}
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setQuery('');
                    setSelectedPlace(null);
                    setRouteData(null);
                    setSelectedCoords(null);
                    router.setParams({ initialDestination: '', destLat: '', destLng: '' });
                  }}
                  style={styles.clearBtn}
                >
                  <Ionicons name="close-circle" size={20} color={isDark ? Colors.gray500 : Colors.gray400} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>

      {!selectedPlace ? (
        <View style={{ flex: 1 }}>
          {query.length === 0 && pickupQuery.length === 0 && (
            <Text style={[styles.sectionTitle, dynamicStyles.text, { marginHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: 0 }]}>
              {recentPlaces.length > 0 ? 'Recent & Recommended' : 'Recommended for you'}
            </Text>
          )}
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            style={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.resultRow, dynamicStyles.border]}
                onPress={async () => {
                  if (activeInput === 'pickup') {
                    setSelectedPickupPlace(item.name);
                    setPickupQuery(item.name);
                    setPickupAddress(item.name);

                    if (item.isAutocomplete) {
                      const details = await getPlaceDetails(item.id);
                      if (details) setPickupCoords(details);
                    } else if (item.coords) {
                      setPickupCoords(item.coords);
                    }
                    setActiveInput('destination');
                  } else {
                    setSelectedPlace(item.name);
                    setQuery(item.name);

                    if (item.isAutocomplete) {
                      const details = await getPlaceDetails(item.id);
                      if (details) setSelectedCoords(details);
                    } else if (item.coords) {
                      setSelectedCoords(item.coords);
                    } else if (item.isMap && destLat && destLng) {
                      setSelectedCoords({ latitude: parseFloat(destLat), longitude: parseFloat(destLng) });
                    }
                  }
                }}
              >
                <View style={[styles.resultIcon, { backgroundColor: isDark ? Colors.primary + '30' : Colors.primary + '12' }]}>
                  <Ionicons
                    name={item.isMap ? "pin" : (item.isAutocomplete ? "search" : (item.isRecent ? "time" : "location"))}
                    size={20}
                    color={isDark ? Colors.primaryLight : Colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultName, dynamicStyles.text]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.resultAddr, dynamicStyles.subText]} numberOfLines={1}>{item.address}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : (
        <>
          <ScrollView style={styles.rideSection} showsVerticalScrollIndicator={false}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, dynamicStyles.text, { marginBottom: 0 }]}>Choose your ride</Text>
              <TouchableOpacity
                style={[styles.scheduleBtn, scheduledTime && { backgroundColor: Colors.primary + '20', borderColor: Colors.primary }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="time-outline" size={18} color={scheduledTime ? Colors.primary : Colors.gray500} />
                <Text style={[styles.scheduleBtnText, { color: scheduledTime ? Colors.primary : Colors.gray500 }]}>
                  {scheduledTime || 'Now'}
                </Text>
              </TouchableOpacity>
            </View>

            {RIDE_TYPES.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[
                  styles.rideCard,
                  { backgroundColor: isDark ? Colors.darkCard : Colors.white, borderColor: isDark ? Colors.darkBorder : Colors.gray200 },
                  selectedRide === r.id && { borderColor: Colors.primary, backgroundColor: isDark ? Colors.primary + '20' : Colors.primary + '08' }
                ]}
                onPress={() => {
                  setSelectedRide(r.id);
                  if (r.id !== 'motorcycle') setGenderFilter(false);
                }}
              >
                <Text style={{ fontSize: 28, marginRight: 12 }}>{r.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rideName, dynamicStyles.text]}>{r.name}</Text>
                  <Text style={[styles.rideEta, dynamicStyles.subText]}>
                    {isSearching ? 'Calculating...' : (routeData?.duration || '--')} · {r.seats} seats
                  </Text>
                </View>
                <Text style={[styles.ridePrice, { color: isDark ? Colors.white : Colors.gray700 }, selectedRide === r.id && { color: isDark ? Colors.primaryLight : Colors.primary }]}>
                  {isSearching ? 'RM --' : calculateFare(r.basePrice)}
                </Text>
              </TouchableOpacity>
            ))}

            {selectedRide === 'motorcycle' && (
              <View style={[styles.filterCard, { backgroundColor: isDark ? Colors.darkCard : Colors.white, borderColor: isDark ? Colors.darkBorder : Colors.gray200 }]}>
                <View style={styles.filterInfo}>
                  <Ionicons name="people-outline" size={20} color={Colors.primary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.filterTitle, dynamicStyles.text]}>Gender Matching</Text>
                    <Text style={[styles.filterSub, dynamicStyles.subText]}>Match with same-gender drivers only</Text>
                  </View>
                  <Switch
                    value={genderFilter}
                    onValueChange={setGenderFilter}
                    trackColor={{ false: Colors.gray300, true: Colors.primary }}
                  />
                </View>
              </View>
            )}

            {selectedRide === 'carpool' && (
              <TouchableOpacity
                style={[styles.poolListBtn, { backgroundColor: Colors.primary }]}
                onPress={() => {
                  if (user && !user.is_2FA_verified) {
                    Alert.alert(
                      '2FA Verification Required',
                      'To view or join pools, please verify your account using the 2FA link sent to your email/SMS. You can simulate this by clicking the banner on the home screen.',
                      [{ text: 'OK' }]
                    );
                    return;
                  }
                  router.push('/(passenger)/carpool-slots');
                }}
              >
                <Text style={styles.poolListText}>View Available Pools</Text>
                <Ionicons name="chevron-forward" size={20} color={Colors.white} />
              </TouchableOpacity>
            )}

            <View style={[styles.fareCard, { backgroundColor: isDark ? Colors.gray900 : Colors.gray50 }]}>
              <View style={styles.fareRow}>
                <Text style={[styles.fareLabel, dynamicStyles.subText]}>Estimated fare</Text>
                <Text style={[styles.fareVal, { color: isDark ? Colors.primaryLight : Colors.primary }]}>
                  {calculateFare(RIDE_TYPES.find(r => r.id === selectedRide)?.basePrice || 0)}
                </Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={[styles.fareLabel, dynamicStyles.subText]}>Distance</Text>
                <Text style={[styles.fareDetail, { color: isDark ? Colors.gray300 : Colors.gray700 }]}>{routeData?.distance || '--'}</Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={[styles.fareLabel, dynamicStyles.subText]}>Duration</Text>
                <Text style={[styles.fareDetail, { color: isDark ? Colors.gray300 : Colors.gray700 }]}>{routeData?.duration || '--'}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, isSearching && { opacity: 0.7 }]}
              disabled={isSearching || !routeData}
              onPress={() => {
                if (user && !user.is_2FA_verified) {
                  Alert.alert(
                    '2FA Verification Required',
                    'To book or create rides, please verify your account using the 2FA link sent to your email/SMS. You can simulate this by clicking the banner on the home screen.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
                const ride = RIDE_TYPES.find(r => r.id === selectedRide);
                const fare = calculateFare(ride?.basePrice || 0);

                router.push({
                  pathname: '/(passenger)/ride-request',
                  params: {
                    destination: selectedPlace,
                    address: selectedPlace,
                    rideType: ride?.name,
                    price: fare,
                    pickupAddress: pickupAddress,
                    pickupLat: pickupCoords?.latitude,
                    pickupLng: pickupCoords?.longitude,
                    destLat: selectedCoords?.latitude?.toString() || destLat,
                    destLng: selectedCoords?.longitude?.toString() || destLng,
                    distance: routeData?.distance,
                    duration: routeData?.duration,
                    polyline: JSON.stringify(routeData?.polyline),
                    scheduledTime: scheduledTime || undefined,
                    genderMatch: genderFilter ? 'true' : 'false'
                  }
                });
              }}
            >
              <Text style={styles.confirmText}>
                {scheduledTime ? `Schedule Ride for ${scheduledTime}` : 'Confirm Destination'}
              </Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Mock Date Picker Modal */}
          <Modal visible={showDatePicker} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: isDark ? Colors.darkCard : Colors.white }]}>
                <Text style={[styles.modalTitle, dynamicStyles.text]}>Schedule Booking</Text>
                <Text style={[styles.modalSub, dynamicStyles.subText]}>Select a time for your ride</Text>

                <View style={styles.timeGrid}>
                  {['08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM',
                    '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
                    '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM', '09:00 PM',
                    '09:30 PM', '10:00 PM']
                    .map((time) => (
                    <TouchableOpacity
                      key={time}
                      style={[styles.timeChip, scheduledTime === getScheduledDateTimeString(time) && { backgroundColor: Colors.primary }]}
                      onPress={() => {
                        setScheduledTime(getScheduledDateTimeString(time));
                        setShowDatePicker(false);
                      }}
                    >
                      <Text style={[styles.timeText, { color: isDark ? Colors.white : Colors.gray900 }, scheduledTime === getScheduledDateTimeString(time) && { color: Colors.white }]}>{time}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.modalCloseBtn, { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 }]}
                  onPress={() => {
                    setScheduledTime(null);
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={[styles.modalCloseText, dynamicStyles.text]}>Clear / Book for Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gray900 },
  locationCard: { marginHorizontal: Spacing.md, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: Spacing.md },
  locInput: { flex: 1 },
  locLabel: { fontSize: FontSize.xs, color: Colors.gray400, fontWeight: FontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, fontSize: FontSize.md, paddingVertical: 4 },
  clearBtn: { padding: 4 },
  divider: { height: 1, marginVertical: Spacing.sm, marginLeft: 28 },
  list: { flex: 1, paddingHorizontal: Spacing.md, marginTop: Spacing.sm },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1 },
  resultIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  resultName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  resultAddr: { fontSize: FontSize.xs, marginTop: 2 },
  rideSection: { flex: 1, padding: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  scheduleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.gray200 },
  scheduleBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  rideCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 2, marginBottom: Spacing.sm },
  rideName: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  rideEta: { fontSize: FontSize.sm, marginTop: 2 },
  ridePrice: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  filterCard: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.sm },
  filterInfo: { flexDirection: 'row', alignItems: 'center' },
  filterTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  filterSub: { fontSize: FontSize.xs, marginTop: 2 },
  poolListBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  poolListText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  fareCard: { borderRadius: BorderRadius.md, padding: Spacing.md, marginVertical: Spacing.sm },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  fareLabel: { fontSize: FontSize.sm },
  fareVal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  fareDetail: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  confirmBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 16, alignItems: 'center' },
  confirmText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginBottom: 4 },
  modalSub: { fontSize: FontSize.sm, marginBottom: Spacing.lg },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.xl },
  timeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.gray200 },
  timeText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  modalCloseBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: BorderRadius.md },
  modalCloseText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
