import { BorderRadius, Colors, FontSize, FontWeight, Spacing, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCurrentLocationAddress, getDirections, getNearbyPlaces, getPlaceAutocomplete, getPlaceDetails } from '@/utils/location';

const BASE_FARES = {
  economy: 2.50,
  comfort: 4.50,
  premium: 8.00
};

const RATE_PER_KM = 1.20; // RM 1.20 per km

const RIDE_TYPES = [
  { id: 'economy', name: 'Economy', icon: '🚗', basePrice: BASE_FARES.economy, seats: 4 },
  { id: 'comfort', name: 'Comfort', icon: '🚙', basePrice: BASE_FARES.comfort, seats: 4 },
  { id: 'premium', name: 'Premium', icon: '✨', basePrice: BASE_FARES.premium, seats: 6 },
];

// We've removed hardcoded PLACES to prioritize map selection

export default function SetDestinationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const { initialDestination, destLat, destLng } = useLocalSearchParams<{ 
    initialDestination?: string,
    destLat?: string,
    destLng?: string
  }>();

  const [query, setQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [selectedRide, setSelectedRide] = useState('economy');
  const [pickupAddress, setPickupAddress] = useState('Fetching current location...');
  const [pickupCoords, setPickupCoords] = useState<{latitude: number, longitude: number} | null>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [recommendedPlaces, setRecommendedPlaces] = useState<any[]>([]);
  const [autocompletePlaces, setAutocompletePlaces] = useState<any[]>([]);
  const [selectedCoords, setSelectedCoords] = useState<{latitude: number, longitude: number} | null>(null);

  useEffect(() => {
    if (pickupCoords) {
      (async () => {
        const recommended = await getNearbyPlaces(pickupCoords.latitude, pickupCoords.longitude);
        setRecommendedPlaces(recommended);
      })();
    }
  }, [pickupCoords]);

  // Handle autocomplete as user types
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2 && query !== selectedPlace) {
        const suggestions = await getPlaceAutocomplete(query, pickupCoords?.latitude, pickupCoords?.longitude);
        setAutocompletePlaces(suggestions);
      } else if (query.length <= 2) {
        setAutocompletePlaces([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query, selectedPlace, pickupCoords]);

  useEffect(() => {
    (async () => {
      const loc = await getCurrentLocationAddress();
      if (loc) {
        setPickupAddress(loc.address);
        setPickupCoords(loc.coords);
      } else {
        setPickupAddress('Current Location');
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedPlace && pickupAddress) {
      (async () => {
        setIsSearching(true);
        try {
          let destination: string | { lat: number, lng: number } = selectedPlace;
          
          // Use precise coordinates if we have them
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
  }, [selectedPlace, pickupAddress, destLat, destLng, initialDestination]);

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

  const filtered = query.length > 0
    ? (autocompletePlaces.length > 0 ? autocompletePlaces : (query === initialDestination ? [{ id: 'map', name: query, address: 'Map Selection', isMap: true }] : []))
    : recommendedPlaces;

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
            <Text style={[styles.locValue, dynamicStyles.text]} numberOfLines={1}>{pickupAddress}</Text>
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
                  if (selectedPlace) setSelectedPlace(null);
                }}
                autoFocus
              />
              {query.length > 0 && (
                <TouchableOpacity 
                  onPress={() => {
                    setQuery('');
                    setSelectedPlace(null);
                    setRouteData(null);
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
          {query.length === 0 && recommendedPlaces.length > 0 && (
            <Text style={[styles.sectionTitle, dynamicStyles.text, { marginHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: 0 }]}>Recommended for you</Text>
          )}
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            style={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.resultRow, dynamicStyles.border]}
                onPress={async () => { 
                  setSelectedPlace(item.name); 
                  setQuery(item.name);
                  
                  // Fetch precise coordinates if it's an autocomplete result or recommended place
                  if (item.isAutocomplete) {
                    const details = await getPlaceDetails(item.id);
                    if (details) setSelectedCoords(details);
                  } else if (item.coords) {
                    setSelectedCoords(item.coords);
                  } else if (item.isMap && destLat && destLng) {
                    setSelectedCoords({ latitude: parseFloat(destLat), longitude: parseFloat(destLng) });
                  }
                }}
              >
                <View style={[styles.resultIcon, { backgroundColor: isDark ? Colors.primary + '30' : Colors.primary + '12' }]}>
                  <Ionicons name={item.isMap ? "pin" : (item.isAutocomplete ? "search" : "location")} size={20} color={isDark ? Colors.primaryLight : Colors.primary} />
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
        <View style={styles.rideSection}>
          <Text style={[styles.sectionTitle, dynamicStyles.text]}>Choose your ride</Text>
          {RIDE_TYPES.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[
                styles.rideCard, 
                { backgroundColor: isDark ? Colors.darkCard : Colors.white, borderColor: isDark ? Colors.darkBorder : Colors.gray200 },
                selectedRide === r.id && { borderColor: Colors.primary, backgroundColor: isDark ? Colors.primary + '20' : Colors.primary + '08' }
              ]}
              onPress={() => setSelectedRide(r.id)}
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
              const ride = RIDE_TYPES.find(r => r.id === selectedRide);
              const fare = calculateFare(ride?.basePrice || 0);
              
              router.push({
                pathname: '/(passenger)/ride-request',
                params: { 
                  destination: selectedPlace,
                  address: selectedPlace, // Use the display name
                  rideType: ride?.name,
                  price: fare,
                  pickupAddress: pickupAddress,
                  pickupLat: pickupCoords?.latitude,
                  pickupLng: pickupCoords?.longitude,
                  destLat: selectedCoords?.latitude?.toString() || destLat,
                  destLng: selectedCoords?.longitude?.toString() || destLng,
                  distance: routeData?.distance,
                  duration: routeData?.duration,
                  polyline: JSON.stringify(routeData?.polyline)
                }
              });
            }}
          >
            <Text style={styles.confirmText}>Confirm Destination</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.gray100, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gray900 },
  locationCard: { marginHorizontal: Spacing.md, backgroundColor: Colors.gray50, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.gray200 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: Spacing.md },
  locInput: { flex: 1 },
  locLabel: { fontSize: FontSize.xs, color: Colors.gray400, fontWeight: FontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  locValue: { fontSize: FontSize.md, color: Colors.gray900, fontWeight: FontWeight.semibold, marginTop: 2 },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.gray900, paddingVertical: 4 },
  clearBtn: { padding: 4 },
  divider: { height: 1, backgroundColor: Colors.gray200, marginVertical: Spacing.sm, marginLeft: 28 },
  list: { flex: 1, paddingHorizontal: Spacing.md, marginTop: Spacing.sm },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  resultIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  resultName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.gray900 },
  resultAddr: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2 },
  rideSection: { flex: 1, padding: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gray900, marginBottom: Spacing.md },
  rideCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 2, borderColor: Colors.gray200, marginBottom: Spacing.sm },
  rideSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
  rideName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray900 },
  rideEta: { fontSize: FontSize.sm, color: Colors.gray500, marginTop: 2 },
  ridePrice: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gray700 },
  fareCard: { backgroundColor: Colors.gray50, borderRadius: BorderRadius.md, padding: Spacing.md, marginVertical: Spacing.sm },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  fareLabel: { fontSize: FontSize.sm, color: Colors.gray500 },
  fareVal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  fareDetail: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray700 },
  confirmBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 16, alignItems: 'center' },
  confirmText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
});
