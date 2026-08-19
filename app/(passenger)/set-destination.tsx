import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCurrentLocationAddress, getDirections, getNearbyPlaces, getPlaceAutocomplete, getPlaceDetails, getRecentDestinations, getRecentPickups } from '@/utils/location';

const BASE_FARES = {
  standard: { base: 1.50, rateKm: 0.45, minFloor: 2.00 },
  premium: { base: 2.50, rateKm: 0.70, minFloor: 3.50 },
  motorcycle: { base: 1.00, rateKm: 0.35, minFloor: 1.50 },
  carpool: { base: 1.00, rateKm: 0.25, minFloor: 1.20 }
};

const DEFAULT_PICKUP_COORDS = { latitude: 2.3135, longitude: 102.3211 };
const DEFAULT_PICKUP_ADDRESS = 'UTeM Kampus Induk, Durian Tunggal';

const RIDE_TYPES = [
  { id: 'standard', name: 'Standard', icon: '🚗', basePrice: BASE_FARES.standard.base, rateKm: BASE_FARES.standard.rateKm, minFloor: BASE_FARES.standard.minFloor, seats: '3-4' },
  { id: 'premium', name: 'Premium', icon: '✨', basePrice: BASE_FARES.premium.base, rateKm: BASE_FARES.premium.rateKm, minFloor: BASE_FARES.premium.minFloor, seats: '5-6' },
  { id: 'motorcycle', name: 'Motorcycle', icon: '🏍️', basePrice: BASE_FARES.motorcycle.base, rateKm: BASE_FARES.motorcycle.rateKm, minFloor: BASE_FARES.motorcycle.minFloor, seats: '1' },
  { id: 'carpool', name: 'Car Pool', icon: '👥', basePrice: BASE_FARES.carpool.base, rateKm: BASE_FARES.carpool.rateKm, minFloor: BASE_FARES.carpool.minFloor, seats: '3-6' },
];

export default function SetDestinationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const destinationInputRef = useRef<TextInput>(null);
  
  const { initialDestination, destLat, destLng } = useLocalSearchParams<{
    initialDestination?: string,
    destLat?: string,
    destLng?: string
  }>();

  const [activeInput, setActiveInput] = useState<'pickup' | 'destination'>('destination');
  const [query, setQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [selectedRide, setSelectedRide] = useState('standard');
  
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
  const [scheduledDayOffset, setScheduledDayOffset] = useState<number>(0);
  const [spinnerHour, setSpinnerHour] = useState<number>(8);
  const [spinnerMinute, setSpinnerMinute] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const recentD = await getRecentDestinations();
      const recentP = await getRecentPickups();
      
      const combined: any[] = [];
      const seen = new Set<string>();
      
      recentP.forEach((p: any) => {
        if (p.name && !seen.has(p.name)) {
          combined.push({ ...p, isRecent: true });
          seen.add(p.name);
        }
      });
      
      recentD.forEach((d: any) => {
        if (d.name && !seen.has(d.name)) {
          combined.push({ ...d, isRecent: true });
          seen.add(d.name);
        }
      });
      
      setRecentPlaces(combined.slice(0, 8));

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
        setPickupAddress(DEFAULT_PICKUP_ADDRESS);
        setPickupCoords(DEFAULT_PICKUP_COORDS);
        setPickupQuery(DEFAULT_PICKUP_ADDRESS);
        setSelectedPickupPlace(DEFAULT_PICKUP_ADDRESS);
      }
    })();
  }, []);

  const [fetchingLoc, setFetchingLoc] = useState(false);

  const fetchCurrentLocation = async () => {
    setFetchingLoc(true);
    setPickupQuery('Fetching location...');
    const loc = await getCurrentLocationAddress();
    if (loc) {
      setPickupAddress(loc.address);
      setPickupCoords(loc.coords);
      setPickupQuery(loc.address);
      setSelectedPickupPlace(loc.address);
    } else {
      setPickupAddress(DEFAULT_PICKUP_ADDRESS);
      setPickupCoords(DEFAULT_PICKUP_COORDS);
      setPickupQuery(DEFAULT_PICKUP_ADDRESS);
      setSelectedPickupPlace(DEFAULT_PICKUP_ADDRESS);
      Alert.alert('Location Access Failed', 'Could not retrieve current location. Defaulting to UTeM Kampus Induk.');
    }
    setFetchingLoc(false);
  };

  useEffect(() => {
    if (selectedPlace && pickupAddress && pickupAddress !== 'Fetching current location...') {
      (async () => {
        setIsSearching(true);
        try {
          let destination: string | { lat: number, lng: number } = selectedPlace;

          if (selectedCoords) {
            destination = { lat: selectedCoords.latitude, lng: selectedCoords.longitude };
          } else if (destLat && destLng && selectedPlace === initialDestination) {
            destination = { lat: parseFloat(destLat), lng: parseFloat(destLng) };
          }

          let origin: string | { lat: number, lng: number } = pickupCoords 
            ? { lat: pickupCoords.latitude, lng: pickupCoords.longitude } 
            : pickupAddress;

          if (origin === 'Current Location' || !origin) {
            origin = { lat: DEFAULT_PICKUP_COORDS.latitude, lng: DEFAULT_PICKUP_COORDS.longitude };
          }

          const directions = await getDirections(origin, destination);
          if (directions) {
            setRouteData(directions);
          }
        } finally {
          setIsSearching(false);
        }
      })();
    }
  }, [selectedPlace, pickupAddress, pickupCoords, destLat, destLng, initialDestination, selectedCoords]);

  const calculateFare = (rideItem: any) => {
    if (!routeData) return 'RM --';
    const ride = typeof rideItem === 'string' ? (RIDE_TYPES.find(r => r.id === rideItem) || RIDE_TYPES[0]) : (rideItem || RIDE_TYPES[0]);
    const distanceKm = (routeData.distanceValue || 0) / 1000;
    const rawTotal = (ride.basePrice || 4.00) + (distanceKm * (ride.rateKm || 0.90));
    const finalFare = Math.max(rawTotal, ride.minFloor || 3.00);
    return `RM ${finalFare.toFixed(2)}`;
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
                onSubmitEditing={() => destinationInputRef.current?.focus()}
                blurOnSubmit={false}
                multiline={true}
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
              <TouchableOpacity
                onPress={fetchCurrentLocation}
                style={styles.locateBtn}
                disabled={fetchingLoc}
              >
                {fetchingLoc ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Ionicons name="locate-outline" size={20} color={Colors.primary} />
                )}
              </TouchableOpacity>
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
                ref={destinationInputRef}
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
                multiline={true}
                blurOnSubmit={true}
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

      {!selectedPlace || !pickupQuery.trim() ? (
        <View style={{ flex: 1 }}>
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            style={styles.list}
            ListHeaderComponent={() => {
              const showDestinationTitle = query.length === 0 && pickupQuery.length === 0;

              return (
                <View>
                  {showDestinationTitle && (
                    <Text style={[styles.sectionTitle, dynamicStyles.text, { marginTop: Spacing.xs, marginBottom: Spacing.sm }]}>
                      {recentPlaces.length > 0 ? 'Recent & Recommended' : 'Recommended for you'}
                    </Text>
                  )}
                </View>
              );
            }}
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
                  {isSearching ? 'RM --' : calculateFare(r)}
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
                  {calculateFare(selectedRide)}
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
                const ride = RIDE_TYPES.find(r => r.id === selectedRide);
                const fare = calculateFare(ride);

                router.push({
                  pathname: '/(passenger)/ride-request',
                  params: {
                    destination: selectedPlace,
                    address: selectedPlace,
                    rideType: ride?.name,
                    price: fare,
                    pickupAddress: pickupQuery || pickupAddress,
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

          {/* Date & Time Spinner Modal */}
          <Modal visible={showDatePicker} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: isDark ? Colors.darkCard : Colors.white }]}>
                <Text style={[styles.modalTitle, dynamicStyles.text]}>Schedule Ride Time</Text>
                <Text style={[styles.modalSub, dynamicStyles.subText]}>Select date and time (Allowed: 7:30 AM – 10:30 PM)</Text>

                {/* Day selector */}
                <View style={{ flexDirection: 'row', gap: 8, marginVertical: 12 }}>
                  {['Today', 'Tomorrow'].map((dayOpt, idx) => {
                    const isSel = (scheduledDayOffset === idx);
                    return (
                      <TouchableOpacity
                        key={dayOpt}
                        style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: isDark ? Colors.gray900 : Colors.gray100 }, isSel && { backgroundColor: Colors.primary }]}
                        onPress={() => setScheduledDayOffset(idx)}
                      >
                        <Text style={[{ fontSize: 13, fontWeight: '600', color: isDark ? Colors.gray300 : Colors.gray700 }, isSel && { color: Colors.white }]}>{dayOpt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Time Spinner Controls */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 16, gap: 12 }}>
                  {/* Hour Spinner */}
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: Colors.gray400, marginBottom: 4, textTransform: 'uppercase' }}>Hour</Text>
                    <ScrollView style={{ height: 120, width: 70 }} showsVerticalScrollIndicator={false}>
                      {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map((h) => {
                        const displayHour = h > 12 ? `${h - 12} PM` : (h === 12 ? '12 PM' : `${h} AM`);
                        const isSel = (spinnerHour === h);
                        return (
                          <TouchableOpacity
                            key={h}
                            style={[{ paddingVertical: 8, borderRadius: 6, alignItems: 'center', marginVertical: 2 }, isSel && { backgroundColor: Colors.primary }]}
                            onPress={() => setSpinnerHour(h)}
                          >
                            <Text style={[{ fontSize: 14, color: isDark ? Colors.white : Colors.gray900 }, isSel && { color: Colors.white, fontWeight: 'bold' }]}>{displayHour}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.primary }}>:</Text>

                  {/* Minute Spinner */}
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: Colors.gray400, marginBottom: 4, textTransform: 'uppercase' }}>Minute</Text>
                    <ScrollView style={{ height: 120, width: 70 }} showsVerticalScrollIndicator={false}>
                      {[0, 15, 30, 45].map((m) => {
                        const displayMin = m < 10 ? `0${m}` : `${m}`;
                        const isSel = (spinnerMinute === m);
                        return (
                          <TouchableOpacity
                            key={m}
                            style={[{ paddingVertical: 8, borderRadius: 6, alignItems: 'center', marginVertical: 2 }, isSel && { backgroundColor: Colors.primary }]}
                            onPress={() => setSpinnerMinute(m)}
                          >
                            <Text style={[{ fontSize: 14, color: isDark ? Colors.white : Colors.gray900 }, isSel && { color: Colors.white, fontWeight: 'bold' }]}>{displayMin}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>

                {/* Confirm Time Selection */}
                <TouchableOpacity
                  style={{ backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 }}
                  onPress={() => {
                    // Restrict 7:30 AM to 10:30 PM
                    const totalMin = spinnerHour * 60 + spinnerMinute;
                    const minAllowed = 7 * 60 + 30;  // 7:30 AM = 450 min
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
                          `You cannot schedule a ride for a past time. Please select a future time after current time.`
                        );
                        return;
                      }
                    }

                    const targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() + scheduledDayOffset);
                    targetDate.setHours(spinnerHour, spinnerMinute, 0, 0);

                    setScheduledTime(targetDate.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }));
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={{ color: Colors.white, fontWeight: 'bold', fontSize: 14 }}>Set Scheduled Time</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalCloseBtn, { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 }, { marginTop: 8 }]}
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
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: Spacing.md, marginTop: 8 },
  locInput: { flex: 1 },
  locLabel: { fontSize: FontSize.xs, color: Colors.gray400, fontWeight: FontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'flex-start' },
  searchInput: { flex: 1, fontSize: FontSize.md, paddingVertical: 4 },
  clearBtn: { padding: 4 },
  locateBtn: { padding: 4, marginLeft: 4 },
  seeMoreBtn: { paddingVertical: Spacing.sm, alignItems: 'center', justifyContent: 'center' },
  seeMoreText: { color: Colors.primary, fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
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
