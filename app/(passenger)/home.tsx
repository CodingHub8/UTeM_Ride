import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Platform, Dimensions } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { PROVIDER_GOOGLE, Marker, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  useSharedValue, 
  interpolate,
  interpolateColor,
  runOnJS 
} from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getRecentDestinations, saveRecentDestination } from '@/utils/location';

const { height: SCREEN_HEIGHT } = Dimensions.get('screen');
const COLLAPSED_HEIGHT = 160; 
const SNAP_TOP = 0;
const SNAP_BOTTOM = SCREEN_HEIGHT - COLLAPSED_HEIGHT - 60; // Larger safety margin
const SNAP_MID = SCREEN_HEIGHT * 0.45; 
const PANEL_HEIGHT = SCREEN_HEIGHT;

const UTEM_REGION = {
  latitude: 2.3086,
  longitude: 102.3197,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const RECENT_PLACES_LIMIT = 8;

const DARK_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3f" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b9" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
  { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#2f3948" }] },
  { "featureType": "transit.station", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
  { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
];

export default function PassengerHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { isDark, theme, themeProgress } = useTheme();
  const mapRef = useRef<MapView>(null);
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [tappedLocation, setTappedLocation] = useState<{ latitude: number, longitude: number, address?: string } | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [recentPlaces, setRecentPlaces] = useState<any[]>([]);
  
  // Refresh recent places whenever the screen is focused
  useEffect(() => {
    const loadRecent = async () => {
      const recent = await getRecentDestinations();
      setRecentPlaces(recent);
    };

    loadRecent(); // Initial load
    
    // Check permission immediately
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation(location);
          
          // Animate to user location on first load if we haven't yet
          mapRef.current?.animateToRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        } catch (error) {
          console.warn('Error getting initial location:', error);
        }
      }
    })();
  }, []);

  // Refresh recent places whenever the screen is focused
  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      getRecentDestinations().then(setRecentPlaces);
    });
    return unsubscribe;
  }, [navigation]);

  const translateY = useSharedValue(SNAP_BOTTOM); // Start at collapsed for safety on first load
  const context = useSharedValue({ y: SNAP_BOTTOM });

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      translateY.value = event.translationY + context.value.y;
      // Strict boundaries
      if (translateY.value < SNAP_TOP) translateY.value = SNAP_TOP;
      if (translateY.value > SNAP_BOTTOM) translateY.value = SNAP_BOTTOM;
    })
    .onEnd((event) => {
      if (event.velocityY > 500) {
        translateY.value = withSpring(SNAP_BOTTOM, { damping: 20, stiffness: 90 });
        runOnJS(setIsCollapsed)(true);
      } else if (event.velocityY < -500) {
        translateY.value = withSpring(SNAP_TOP, { damping: 20, stiffness: 90 });
        runOnJS(setIsCollapsed)(false);
      } else {
        // Snap to nearest
        const distTop = Math.abs(translateY.value - SNAP_TOP);
        const distMid = Math.abs(translateY.value - SNAP_MID);
        const distBottom = Math.abs(translateY.value - SNAP_BOTTOM);
        
        const minDist = Math.min(distTop, distMid, distBottom);
        
        if (minDist === distTop) {
          translateY.value = withSpring(SNAP_TOP, { damping: 20, stiffness: 90 });
          runOnJS(setIsCollapsed)(false);
        } else if (minDist === distMid) {
          translateY.value = withSpring(SNAP_MID, { damping: 20, stiffness: 90 });
          runOnJS(setIsCollapsed)(false);
        } else {
          translateY.value = withSpring(SNAP_BOTTOM, { damping: 20, stiffness: 90 });
          runOnJS(setIsCollapsed)(true);
        }
      }
    });

  const animatedPanelStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const togglePanel = () => {
    if (translateY.value < SNAP_BOTTOM - 10) {
      translateY.value = withSpring(SNAP_BOTTOM, { damping: 20, stiffness: 90 });
      setIsCollapsed(true);
    } else {
      translateY.value = withSpring(SNAP_MID, { damping: 20, stiffness: 90 });
      setIsCollapsed(false);
    }
  };

  const handleMapPress = (e: MapPressEvent) => {
    const coords = e.nativeEvent.coordinate;
    // Update marker immediately for zero-latency feel
    setTappedLocation({ ...coords, address: 'Fetching address...' });
    
    // Fetch address in background
    fetchAddress(coords);
  };

  const handlePoiClick = (e: any) => {
    const coords = e.nativeEvent.coordinate;
    const name = e.nativeEvent.name;
    // Use POI name immediately as it's faster
    setTappedLocation({ ...coords, address: name });
    
    // Optionally refine with full address
    fetchAddress(coords);
  };

  const fetchAddress = async (coords: { latitude: number, longitude: number }) => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      console.log('Fetching address for:', coords, 'with API Key present:', !!apiKey);
      
      // Try Google Maps Geocoding API first for better reliability on Android APK
      if (apiKey) {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${apiKey}`
        );
        const data = await response.json();
        console.log('Google Geocoding Response Status:', data.status);
        
        if (data.status === 'OK' && data.results.length > 0) {
          // Get the most relevant address (usually the first one)
          const address = data.results[0].formatted_address;
          setTappedLocation({ ...coords, address });
          return;
        } else if (data.error_message) {
          console.error('Google Geocoding API Error:', data.error_message);
        }
      }

      // Fallback to Expo Location (Native Geocoder)
      console.log('Falling back to native geocoder...');
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Native geocoder skipped: Location permission not granted');
        setTappedLocation({ ...coords, address: 'Permission required' });
        return;
      }

      const results = await Location.reverseGeocodeAsync(coords);
      if (results && results.length > 0) {
        const place = results[0];
        const formattedAddress = [place.name, place.street, place.district, place.city]
          .filter(Boolean)
          .join(', ');
        setTappedLocation({ ...coords, address: formattedAddress || 'Unknown Location' });
      } else {
        setTappedLocation({ ...coords, address: 'Address not found' });
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setTappedLocation({ ...coords, address: 'Address not found' });
    }
  };

  const handleLocateMe = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== 'granted') return;
        setLocationPermission(true);
      }
      
      // Get current position with higher accuracy
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      setUserLocation(location);
      
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.005, // Closer zoom
          longitudeDelta: 0.005,
        }, 800);
      }
    } catch (error) {
      console.warn('Error locating user:', error);
      // If error, try to at least go to the last known position
      const lastLoc = await Location.getLastKnownPositionAsync({});
      if (lastLoc && mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: lastLoc.coords.latitude,
          longitude: lastLoc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 800);
      } else {
        mapRef.current?.animateToRegion(UTEM_REGION, 800);
      }
    }
  };

  const animatedFabStyle = useAnimatedStyle(() => {
    const bottom = interpolate(
      translateY.value,
      [SNAP_TOP, SNAP_BOTTOM],
      [PANEL_HEIGHT + 20, COLLAPSED_HEIGHT + 20]
    );
    return { bottom };
  });

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        themeProgress.value,
        [0, 1],
        [Colors.gray100, Colors.darkBg]
      ),
    };
  });

  const animatedSheetStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        themeProgress.value,
        [0, 1],
        [Colors.white, Colors.darkCard]
      ),
    };
  });

  const dynamicStyles = {
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    searchBar: { 
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    },
    searchPlaceholder: { color: isDark ? Colors.gray500 : Colors.gray400 },
    handleBar: { backgroundColor: isDark ? Colors.darkBorder : Colors.gray200 },
    tappedPreview: {
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      borderColor: isDark ? Colors.darkBorder : Colors.gray100,
    },
    tappedTitle: { color: isDark ? Colors.gray500 : Colors.gray400 },
    tappedAddr: { color: isDark ? Colors.white : Colors.gray800 },
    placeRowBorder: { borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View style={[styles.container, animatedContainerStyle]}>
        {/* Google Map */}
        <View style={styles.mapContainer}>
          <MapView
            key={isDark ? 'dark-map' : 'light-map'}
            ref={mapRef}
            style={styles.map}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={UTEM_REGION}
            onPress={handleMapPress}
            onPoiClick={handlePoiClick}
            showsUserLocation={!!locationPermission}
            showsMyLocationButton={false}
            showsCompass={false}
            mapType="standard"
            customMapStyle={isDark ? DARK_MAP_STYLE : []}
            userInterfaceStyle={theme}
          >
            {tappedLocation && (
              <Marker 
                key={`${tappedLocation.latitude}-${tappedLocation.longitude}`}
                coordinate={tappedLocation}
                pinColor={Colors.error}
              />
            )}
          </MapView>

          {/* Current location FAB */}
          <Animated.View style={[styles.locationFab, animatedFabStyle]}>
            <TouchableOpacity onPress={handleLocateMe} style={[styles.fabTouch, { backgroundColor: isDark ? Colors.darkCard : Colors.white }]}>
              <Ionicons name="locate" size={24} color={Colors.primary} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Swipeable Bottom Sheet */}
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.bottomSheet, animatedSheetStyle, animatedPanelStyle]}>
            {/* Handle for collapsing */}
            <TouchableOpacity style={styles.panelHandle} onPress={togglePanel} activeOpacity={0.7}>
              <View style={[styles.handleBar, dynamicStyles.handleBar]} />
            </TouchableOpacity>

            {/* Content */}
            <View style={styles.panelContent}>
              {/* Tapped Location Preview */}
              {tappedLocation && (
                <View style={[styles.tappedPreview, dynamicStyles.tappedPreview]}>
                  <View style={styles.tappedIcon}>
                    <Ionicons name="pin" size={20} color={Colors.error} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tappedTitle, dynamicStyles.tappedTitle]}>Dropped Pin</Text>
                    <Text style={[styles.tappedAddr, dynamicStyles.tappedAddr]} numberOfLines={1}>{tappedLocation.address}</Text>
                  </View>
                  <TouchableOpacity 
                    style={[
                      styles.tappedGoBtn, 
                      (!tappedLocation.address || tappedLocation.address === 'Fetching address...' || tappedLocation.address === 'Address not found') && styles.tappedGoDisabled
                    ]}
                    disabled={!tappedLocation.address || tappedLocation.address === 'Fetching address...' || tappedLocation.address === 'Address not found'}
                    onPress={async () => {
                      await saveRecentDestination({
                        name: tappedLocation.address || 'Dropped Pin',
                        address: tappedLocation.address || '',
                        lat: tappedLocation.latitude,
                        lng: tappedLocation.longitude
                      });
                      router.push({
                        pathname: '/(passenger)/set-destination',
                        params: { 
                          initialDestination: tappedLocation.address,
                          destLat: String(tappedLocation.latitude),
                          destLng: String(tappedLocation.longitude)
                        }
                      });
                    }}
                  >
                    <Text style={styles.tappedGoText}>Go</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Greeting */}
              <Text style={[styles.greeting, dynamicStyles.text]}>Hello, {user?.name ?? 'there'} 👋</Text>

              {/* Search Bar */}
              <TouchableOpacity
                style={[styles.searchBar, dynamicStyles.searchBar]}
                onPress={() => router.push('/(passenger)/set-destination')}
                activeOpacity={0.8}
              >
                <View style={styles.searchDot} />
                <Text style={[styles.searchPlaceholder, dynamicStyles.searchPlaceholder]}>Where to?</Text>
                <View style={[styles.searchTimeBadge, { backgroundColor: isDark ? Colors.darkCard : Colors.white, borderColor: isDark ? Colors.darkBorder : Colors.gray200 }]}>
                  <Ionicons name="time-outline" size={16} color={isDark ? Colors.gray400 : Colors.gray600} />
                  <Text style={[styles.searchTimeText, { color: isDark ? Colors.gray300 : Colors.gray600 }]}>Now</Text>
                  <Ionicons name="chevron-down" size={14} color={isDark ? Colors.gray400 : Colors.gray600} />
                </View>
              </TouchableOpacity>

              {/* Recent Places */}
              <Text style={[styles.sectionTitle, { color: isDark ? Colors.gray500 : Colors.gray500 }]}>Recent Places</Text>
              <FlatList
                data={recentPlaces}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.placeRow, dynamicStyles.placeRowBorder]}
                    onPress={() => router.push({
                      pathname: '/(passenger)/set-destination',
                      params: { 
                        initialDestination: item.name || item.address,
                        destLat: String(item.lat),
                        destLng: String(item.lng)
                      }
                    })}
                  >
                    <View style={styles.placeIcon}>
                      <Ionicons name={item.icon} size={20} color={Colors.primary} />
                    </View>
                    <View style={styles.placeInfo}>
                      <Text style={[styles.placeName, dynamicStyles.text]}>{item.name}</Text>
                      <Text style={[styles.placeAddr, dynamicStyles.subText]}>{item.address}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={isDark ? Colors.gray600 : Colors.gray300} />
                  </TouchableOpacity>
                )}
              />
            </View>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  selectedMarker: {
    ...Shadows.md,
  },
  locationFab: {
    position: 'absolute',
    right: Spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    ...Shadows.md,
    zIndex: 10,
  },
  fabTouch: {
    flex: 1,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    height: PANEL_HEIGHT,
    ...Shadows.lg,
  },
  panelHandle: {
    width: '100%',
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  panelContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  tappedPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  tappedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.error + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  tappedTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
  },
  tappedAddr: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  tappedGoBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.sm,
  },
  tappedGoDisabled: {
    backgroundColor: Colors.gray300,
    opacity: 0.7,
  },
  tappedGoText: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },
  greeting: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 52,
    marginBottom: Spacing.lg,
  },
  searchDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginRight: Spacing.sm,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  searchTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    gap: 4,
    borderWidth: 1,
  },
  searchTimeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  placeInfo: { flex: 1 },
  placeName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  placeAddr: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
});

