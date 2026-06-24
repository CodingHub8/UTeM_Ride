import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  publishDriverLocation,
  startTrip,
  completeTrip,
  createRideTransactions,
  parseFare,
  COMMISSION_RATE,
} from '@/utils/rides';

const DEFAULT_PICKUP = { latitude: 2.3135, longitude: 102.3211 };
const DEFAULT_DEST = { latitude: 2.2274, longitude: 102.2492 };

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

export default function TripInProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);

  const {
    rideId,
    price,
    pickup,
    destination,
    passengerName,
    passengerUsername,
    passengerEmail,
    passengerPhone,
    passengerGender
  } = useLocalSearchParams<{
    rideId: string;
    price: string;
    pickup: string;
    destination: string;
    passengerName: string;
    passengerUsername: string;
    passengerEmail: string;
    passengerPhone: string;
    passengerGender: string;
  }>();

  const fareValue = parseFare(price) || 0;
  const commissionFee = +(fareValue * COMMISSION_RATE).toFixed(2);
  const netEarnings = +(fareValue - commissionFee).toFixed(2);

  const [pickupCoord, setPickupCoord] = useState(DEFAULT_PICKUP);
  const [destCoord, setDestCoord] = useState(DEFAULT_DEST);
  const [driverCoord, setDriverCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routePoly, setRoutePoly] = useState<{ latitude: number; longitude: number }[]>([]);
  const [completing, setCompleting] = useState(false);
  const [coordsReady, setCoordsReady] = useState(false);
  const [hasFit, setHasFit] = useState(false);
  const [passengerInfo, setPassengerInfo] = useState({
    name: passengerName || 'Passenger',
    username: passengerUsername || 'passenger',
    email: passengerEmail || '',
    phone: passengerPhone || '',
    gender: passengerGender || '',
  });
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [passengerId, setPassengerId] = useState('');
  const [passengerCoord, setPassengerCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const autoCompletedRef = useRef(false);

  useEffect(() => {
    if (!rideId) return;
    const unsub = onSnapshot(doc(db, 'rides', rideId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        let gotCoords = false;
        if (data.pickup_coords) {
          setPickupCoord({ latitude: data.pickup_coords.latitude, longitude: data.pickup_coords.longitude });
          gotCoords = true;
        }
        if (data.destination_coords) {
          setDestCoord({ latitude: data.destination_coords.latitude, longitude: data.destination_coords.longitude });
          gotCoords = true;
        }
        if (data.passenger_location) {
          setPassengerCoord({
            latitude: data.passenger_location.latitude,
            longitude: data.passenger_location.longitude,
          });
        }
        if (Array.isArray(data.route_polyline)) {
          setRoutePoly(data.route_polyline);
        }
        if (data.payment_method) setPaymentMethod(data.payment_method);
        if (data.passenger_id) setPassengerId(data.passenger_id);
        setPassengerInfo((prev) => ({
          ...prev,
          name: data.passenger_name || prev.name,
          phone: data.passenger_phone || prev.phone,
        }));
        if (gotCoords) setCoordsReady(true);
      }
    });
    return unsub;
  }, [rideId]);

  useEffect(() => {
    if (hasFit) return;
    if (driverCoord && coordsReady && mapRef.current) {
      const points = [driverCoord, pickupCoord, destCoord];
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 80, right: 60, bottom: 240, left: 60 },
        animated: true,
      });
      setHasFit(true);
    }
  }, [driverCoord, coordsReady, pickupCoord, destCoord, hasFit]);

  useEffect(() => {
    if (rideId) startTrip(rideId).catch((e) => console.warn('startTrip error:', e));
  }, [rideId]);

  // Automated arrival detection at destination (<100m proximity check)
  useEffect(() => {
    if (!driverCoord || !passengerCoord || !destCoord || completing || autoCompletedRef.current) return;

    const dDist = getDistanceInMeters(
      driverCoord.latitude,
      driverCoord.longitude,
      destCoord.latitude,
      destCoord.longitude
    );

    const pDist = getDistanceInMeters(
      passengerCoord.latitude,
      passengerCoord.longitude,
      destCoord.latitude,
      destCoord.longitude
    );

    if (dDist < 100 && pDist < 100) {
      autoCompletedRef.current = true;
      console.log(`[AutoArrival] Proximity detected! Driver distance: ${dDist.toFixed(1)}m, Passenger distance: ${pDist.toFixed(1)}m. Automatically completing...`);
      Alert.alert(
        'Arrival Detected',
        'Both driver and passenger are within 100 meters of the destination. Auto-completing trip...',
        [{ text: 'OK', onPress: () => handleCompleteTrip() }]
      );
    }
  }, [driverCoord, passengerCoord, destCoord, completing]);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let mounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      try {
        const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!mounted) return;
        const c = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
        setDriverCoord(c);
        if (rideId) await publishDriverLocation(rideId, c, initial.coords.heading);
      } catch (e) {
        console.warn('Initial location error:', e);
      }

      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        async (loc) => {
          if (!mounted) return;
          const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setDriverCoord(c);
          if (rideId) {
            try {
              await publishDriverLocation(rideId, c, loc.coords.heading);
            } catch (err) {
              console.warn('publishDriverLocation error:', err);
            }
          }
        }
      );
    })();

    return () => {
      mounted = false;
      if (sub) sub.remove();
    };
  }, [rideId]);

  const handleCompleteTrip = async () => {
    if (!user) {
      router.replace('/(driver)/home');
      return;
    }
    setCompleting(true);
    try {
      if (rideId) await completeTrip(rideId);
      if (rideId && passengerId && fareValue > 0) {
        await createRideTransactions({
          rideId,
          fare: fareValue,
          driver_id: user.id,
          passenger_id: passengerId,
          passenger_name: passengerInfo.name,
          passenger_username: passengerInfo.username,
          passenger_email: passengerInfo.email,
          passenger_phone: passengerInfo.phone,
          passenger_gender: passengerInfo.gender,
          pickup: pickup || 'Pickup',
          destination: destination || 'Destination',
          payment_method: paymentMethod,
        });
      }

      Alert.alert(
        'Trip Completed',
        `Fare: RM ${fareValue.toFixed(2)}\nCommission (10%): -RM ${commissionFee.toFixed(2)}\nNet Earnings: RM ${netEarnings.toFixed(2)}`,
        [{ text: 'OK', onPress: () => router.replace('/(driver)/home') }]
      );
    } catch (e: any) {
      Alert.alert('Completion Error', e.message || 'Failed to complete trip.');
      router.replace('/(driver)/home');
    } finally {
      setCompleting(false);
    }
  };

  const polylinePoints = routePoly.length > 1
    ? routePoly
    : (driverCoord ? [pickupCoord, driverCoord, destCoord] : [pickupCoord, destCoord]);

  const accentColor = isDark ? Colors.primaryLight : Colors.primary;

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    panel: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    routeValue: { color: isDark ? Colors.white : Colors.gray900 },
    divider: { backgroundColor: isDark ? Colors.darkBorder : Colors.gray200 },
    statValue: { color: isDark ? Colors.white : Colors.gray900 },
    statDivider: { backgroundColor: isDark ? Colors.darkBorder : Colors.gray200 },
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          key={isDark ? 'dark-map' : 'light-map'}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: (pickupCoord.latitude + destCoord.latitude) / 2,
            longitude: (pickupCoord.longitude + destCoord.longitude) / 2,
            latitudeDelta: Math.abs(pickupCoord.latitude - destCoord.latitude) * 2 || 0.1,
            longitudeDelta: Math.abs(pickupCoord.longitude - destCoord.longitude) * 2 || 0.1,
          }}
          customMapStyle={isDark ? DARK_MAP_STYLE : []}
          userInterfaceStyle={theme}
          showsUserLocation
        >
          {polylinePoints.length >= 2 && (
            <Polyline
              coordinates={polylinePoints}
              strokeColor={accentColor}
              strokeWidth={5}
            />
          )}

          <Marker coordinate={pickupCoord}>
            <View style={[styles.markerCircle, { backgroundColor: Colors.success }]}>
              <View style={styles.markerInner} />
            </View>
          </Marker>

          <Marker coordinate={destCoord}>
            <View style={[styles.markerCircle, { backgroundColor: Colors.error }]}>
              <Ionicons name="location" size={12} color={Colors.white} />
            </View>
          </Marker>

          {driverCoord && (
            <Marker coordinate={driverCoord} flat anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[styles.driverMarker, { backgroundColor: accentColor }]}>
                <Ionicons name="car" size={24} color={Colors.white} />
              </View>
            </Marker>
          )}
        </MapView>

        {/* Trip info badge */}
        <View style={[styles.tripBadge, { backgroundColor: accentColor + '20', borderColor: accentColor + '40' }]}>
          <Ionicons name="car-sport" size={18} color={accentColor} />
          <Text style={[styles.tripBadgeText, { color: accentColor }]}>Trip in progress</Text>
        </View>
      </View>

      {/* Bottom panel */}
      <View style={[styles.panel, dynamicStyles.panel]}>
        {/* Route */}
        <View style={styles.routeRow}>
          <View style={styles.routeMarkers}>
            <View style={[styles.dot, { backgroundColor: Colors.success }]} />
            <View style={styles.dotLine} />
            <View style={[styles.dot, { backgroundColor: Colors.error }]} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ marginBottom: Spacing.md }}>
              <Text style={styles.routeLabel}>Picked up from</Text>
              <Text style={[styles.routeValue, dynamicStyles.routeValue]} numberOfLines={1}>{pickup || 'FTMK, UTeM Main Campus'}</Text>
            </View>
            <View>
              <Text style={styles.routeLabel}>Heading to</Text>
              <Text style={[styles.routeValue, dynamicStyles.routeValue]} numberOfLines={1}>{destination || 'Melaka Sentral Bus Terminal'}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.divider, dynamicStyles.divider]} />

        {/* Earnings & distance */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Earnings (Gross)</Text>
            <Text style={[styles.statValueAccent, { color: accentColor }]}>RM {fareValue.toFixed(2)}</Text>
          </View>
          <View style={[styles.statDivider, dynamicStyles.statDivider]} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Commission (10%)</Text>
            <Text style={[styles.statValue, { color: Colors.error, fontWeight: 'bold' }]}>-RM {commissionFee.toFixed(2)}</Text>
          </View>
          <View style={[styles.statDivider, dynamicStyles.statDivider]} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Net Earning</Text>
            <Text style={[styles.statValue, dynamicStyles.statValue]}>RM {netEarnings.toFixed(2)}</Text>
          </View>
        </View>

        <View style={[styles.divider, dynamicStyles.divider]} />

        <TouchableOpacity
          style={[styles.completeBtn, { backgroundColor: Colors.primary }, completing && { opacity: 0.7 }]}
          onPress={handleCompleteTrip}
          disabled={completing}
        >
          {completing ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={22} color={Colors.white} />
              <Text style={styles.completeText}>Complete Trip</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapArea: { flex: 1, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  markerCircle: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.white, ...Shadows.sm },
  markerInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.white },
  driverMarker: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.white, ...Shadows.md },
  tripBadge: { position: 'absolute', top: Spacing.md, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 6, borderWidth: 1 },
  tripBadgeText: { fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  panel: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  routeRow: { flexDirection: 'row' },
  routeMarkers: { alignItems: 'center', marginRight: Spacing.md, paddingTop: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotLine: { width: 2, height: 24, backgroundColor: Colors.gray600, marginVertical: 4 },
  routeLabel: { fontSize: FontSize.xs, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5 },
  routeValue: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginTop: 2 },
  divider: { height: 1, marginVertical: Spacing.md },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: FontSize.xs, color: Colors.gray400, marginBottom: 4 },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  statValueAccent: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  statDivider: { width: 1 },
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: BorderRadius.md, paddingVertical: 16 },
  completeText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.white },
});
