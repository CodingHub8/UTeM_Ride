import { BorderRadius, Colors, FontSize, FontWeight, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Linking } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, doc, onSnapshot, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { cancelAndRefundRide, completeTrip, createRideTransactions, parseFare } from '@/utils/rides';
import * as Location from 'expo-location';
import ChatModal from '@/components/ChatModal';

const ACTIVE_STATUSES = ['requested', 'accepted', 'arrived', 'in_progress'];

const DEFAULT_PICKUP = { latitude: 2.3135, longitude: 102.3211 };
const DEFAULT_DEST = { latitude: 2.3086, longitude: 102.3197 };

const DARK_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
];

export default function ActiveRideScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);
  const {
    rideId,
    destination,
    pickupAddress,
    pickupLat,
    pickupLng,
    distance,
    duration,
    polyline
  } = useLocalSearchParams<{
    rideId?: string;
    destination: string;
    pickupAddress?: string;
    pickupLat?: string;
    pickupLng?: string;
    distance?: string;
    duration?: string;
    polyline?: string;
  }>();

  const pickupCoord = pickupLat && pickupLng
    ? { latitude: parseFloat(pickupLat), longitude: parseFloat(pickupLng) }
    : DEFAULT_PICKUP;

  const destCoord = polyline
    ? JSON.parse(polyline)[JSON.parse(polyline).length - 1]
    : DEFAULT_DEST;

  const routePoints = polyline ? JSON.parse(polyline) : [
    pickupCoord,
    { latitude: (pickupCoord.latitude + destCoord.latitude) / 2 + 0.001, longitude: (pickupCoord.longitude + destCoord.longitude) / 2 + 0.001 },
    destCoord,
  ];

  const destinationName = destination || 'UTeM Main Campus';

  const [ride, setRide] = useState<any>(null);
  const [completed, setCompleted] = useState(false);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    if (rideId) {
      const unsub = onSnapshot(doc(db, 'rides', rideId), (snap) => {
        if (snap.exists()) {
          setRide({ id: snap.id, ...snap.data() });
        }
      });
      return unsub;
    }

    if (user?.id) {
      const q = query(collection(db, 'rides'), where('passenger_id', '==', user.id));
      const unsub = onSnapshot(q, (snap) => {
        const active: any[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (ACTIVE_STATUSES.includes(data.status)) active.push({ id: d.id, ...data });
        });
        active.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setRide(active[0] || null);
      });
      return unsub;
    }
  }, [rideId, user?.id]);

  useEffect(() => {
    if (!ride) return;
    if (ride.status === 'arrived') {
      Alert.alert('Driver Arrived', 'Your driver is at the pickup point.');
    }
    if (ride.status === 'completed' && !completed) {
      setCompleted(true);
      Alert.alert('Trip Completed', `Total: ${ride.fare}`, [
        { text: 'OK', onPress: () => router.replace('/(passenger)/home') }
      ]);
    }
    if (ride.status === 'cancelled') {
      Alert.alert('Ride Cancelled', 'This ride was cancelled.', [
        { text: 'OK', onPress: () => router.replace('/(passenger)/home') }
      ]);
    }
  }, [ride?.status, completed]);

  const driverLoc = ride?.driver_location;
  const driverCoord = driverLoc
    ? { latitude: driverLoc.latitude, longitude: driverLoc.longitude }
    : pickupCoord;

  useEffect(() => {
    if (driverLoc && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: driverLoc.latitude,
        longitude: driverLoc.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 600);
    }
  }, [driverLoc?.latitude, driverLoc?.longitude]);

  // GPS Location Sharing when status is 'in_progress'
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let mounted = true;

    if (ride?.id && ride?.status === 'in_progress') {
      (async () => {
        const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
        if (permStatus !== 'granted') return;

        try {
          sub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 4000,
              distanceInterval: 5,
            },
            async (loc) => {
              if (!mounted) return;
              const coords = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              };
              const rideRef = doc(db, 'rides', ride.id);
              await updateDoc(rideRef, {
                passenger_location: coords,
              });
            }
          );
        } catch (err) {
          console.warn('[ActiveRide] GPS Watch error:', err);
        }
      })();
    }

    return () => {
      mounted = false;
      if (sub) {
        sub.remove();
      }
    };
  }, [ride?.id, ride?.status]);

  // Timeout logic (10 mins)
  useEffect(() => {
    if (!ride || ride.status !== 'requested') return;

    const checkTimeout = async () => {
      const createdTime = ride.timestamp || Date.now();
      const elapsed = Date.now() - createdTime;
      const TEN_MINUTES_MS = 10 * 60 * 1000;

      if (elapsed >= TEN_MINUTES_MS) {
        clearInterval(timer);
        try {
          const fareAmt = parseFare(ride.fare);
          await cancelAndRefundRide(
            ride.id,
            ride.passenger_id,
            fareAmt,
            ride.payment_method || 'cash',
            ride.payment_label || ''
          );
          Alert.alert(
            'Request Timeout',
            'No driver accepted your request within 10 minutes. Your ride has been cancelled and any payment has been refunded.',
            [{ text: 'OK', onPress: () => router.replace('/(passenger)/home') }]
          );
        } catch (err) {
          console.error('[Timeout] Failed to auto-cancel ride:', err);
          router.replace('/(passenger)/home');
        }
      }
    };

    checkTimeout();
    const timer = setInterval(checkTimeout, 5000);
    return () => clearInterval(timer);
  }, [ride?.id, ride?.status]);

  const handleManualComplete = async () => {
    if (!ride) return;
    Alert.alert(
      'Confirm Arrival',
      'Are you sure you want to manually confirm that you have arrived at your destination?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const fareAmt = parseFare(ride.fare);
              await completeTrip(ride.id);
              if (ride.driver_id && fareAmt > 0) {
                await createRideTransactions({
                  rideId: ride.id,
                  fare: fareAmt,
                  driver_id: ride.driver_id,
                  passenger_id: ride.passenger_id,
                  passenger_name: ride.passenger_name || 'Passenger',
                  pickup: ride.pickup_address || 'Pickup',
                  destination: ride.destination_address || 'Destination',
                  payment_method: ride.payment_method || 'cash',
                });
              }
              Alert.alert('Trip Completed', 'You have manually confirmed arrival.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to complete trip.');
            }
          }
        }
      ]
    );
  };

  const status: string = ride?.status || 'requested';
  const driverAssigned = !!ride?.driver_id;

  const statusLabel = (() => {
    switch (status) {
      case 'requested': return 'Looking for a driver...';
      case 'accepted': return 'Driver is on the way';
      case 'arrived': return 'Driver has arrived';
      case 'in_progress': return 'Trip in progress';
      case 'completed': return 'Trip completed';
      case 'cancelled': return 'Ride cancelled';
      default: return 'Active ride';
    }
  })();

  const handleCancel = async () => {
    const activeId = ride?.id || rideId;
    if (!activeId) {
      router.back();
      return;
    }
    Alert.alert('Cancel Ride', 'Are you sure you want to cancel?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            const fareAmt = parseFare(ride?.fare);
            await cancelAndRefundRide(
              activeId,
              ride?.passenger_id || user?.id || 'anonymous',
              fareAmt,
              ride?.payment_method || 'cash',
              ride?.payment_label || ''
            );
            router.replace('/(passenger)/home');
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to cancel ride.');
          }
        }
      }
    ]);
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray100 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    divider: { backgroundColor: isDark ? Colors.darkBorder : Colors.gray100 },
    vehicleRow: { backgroundColor: isDark ? Colors.gray900 : Colors.gray50 },
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      {/* Map area */}
      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          key={isDark ? 'dark-map' : 'light-map'}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: (pickupCoord.latitude + destCoord.latitude) / 2,
            longitude: (pickupCoord.longitude + destCoord.longitude) / 2,
            latitudeDelta: Math.abs(pickupCoord.latitude - destCoord.latitude) * 2 || 0.015,
            longitudeDelta: Math.abs(pickupCoord.longitude - destCoord.longitude) * 2 || 0.015,
          }}
          customMapStyle={isDark ? DARK_MAP_STYLE : []}
          userInterfaceStyle={theme}
        >
          <Polyline
            coordinates={routePoints}
            strokeColor={Colors.primary}
            strokeWidth={4}
          />

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

          {driverAssigned && (
            <Marker coordinate={driverCoord} flat anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.driverMarker}>
                <Ionicons name="car" size={24} color={Colors.white} />
              </View>
            </Marker>
          )}
        </MapView>

        <View style={styles.etaBadge}>
          {status === 'requested' ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Ionicons name="time" size={18} color={Colors.white} />
          )}
          <Text style={styles.etaText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={[styles.card, dynamicStyles.card]}>
        <View style={styles.driverRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={Colors.white} />
          </View>
          <View style={styles.driverInfo}>
            <Text style={[styles.driverName, dynamicStyles.text]}>
              {ride?.driver_name || (driverAssigned ? 'Your Driver' : 'Searching...')}
            </Text>
            <View style={styles.ratingRow}>
              {driverAssigned ? (
                <>
                  <Ionicons name="call" size={14} color={Colors.accent} />
                  <Text style={[styles.ratingText, dynamicStyles.text]}>{ride?.driver_phone || '—'}</Text>
                </>
              ) : (
                <Text style={styles.tripCount}>Waiting for a driver to accept</Text>
              )}
            </View>
          </View>
          <View style={styles.actionBtns}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => ride?.driver_phone && Linking.openURL(`tel:${ride.driver_phone}`)}
            >
              <Ionicons name="call" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => (ride?.id || rideId) && setShowChat(true)}>
              <Ionicons name="chatbubble" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.vehicleRow, dynamicStyles.vehicleRow]}>
          <View style={styles.vehicleBadge}>
            <Text style={styles.vehicleIcon}>🚗</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.vehicleName, dynamicStyles.text]}>{ride?.driver_vehicle || 'Vehicle pending'}</Text>
            <Text style={[styles.vehiclePlate, dynamicStyles.subText]}>{ride?.driver_plate || '—'}</Text>
          </View>
        </View>

        <View style={[styles.divider, dynamicStyles.divider]} />

        <View style={styles.routeRow}>
          <View style={[styles.routeMarkers, { paddingTop: 4 }]}>
            <View style={[styles.dot, { backgroundColor: Colors.success }]} />
            <View style={[styles.dotLine, { height: 36, marginVertical: 4 }, dynamicStyles.divider]} />
            <View style={[styles.dot, { backgroundColor: Colors.error }]} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ marginBottom: Spacing.sm }}>
              <Text style={{ fontSize: FontSize.xs, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pickup</Text>
              <Text style={[styles.routeLabel, dynamicStyles.text, { marginTop: 2 }]}>{pickupAddress || 'Current Location'}</Text>
            </View>
            <View>
              <Text style={{ fontSize: FontSize.xs, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5 }}>Destination</Text>
              <Text style={[styles.routeLabel, dynamicStyles.text, { marginTop: 2 }]}>{destinationName}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.divider, dynamicStyles.divider]} />

        {status === 'in_progress' && (
          <TouchableOpacity
            style={[styles.completeBtn, { backgroundColor: Colors.success }]}
            onPress={handleManualComplete}
          >
            <Ionicons name="checkmark-done-circle" size={20} color={Colors.white} />
            <Text style={styles.completeText}>Manually Confirm Arrival</Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={[styles.cancelBtn, isDark && { backgroundColor: Colors.gray900 }]}
            onPress={handleCancel}
            disabled={status === 'in_progress' || status === 'completed'}
          >
            <Text style={[styles.cancelText, dynamicStyles.subText]}>Cancel Ride</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sosBtn}>
            <Ionicons name="alert-circle" size={20} color={Colors.white} />
            <Text style={styles.sosText}>SOS</Text>
          </TouchableOpacity>
        </View>
      </View>
      {(ride?.id || rideId) && user && (
        <ChatModal
          visible={showChat}
          onClose={() => setShowChat(false)}
          rideId={ride?.id || rideId || ''}
          userId={user.id}
          userName={user.name}
          userRole="passenger"
          isDark={isDark}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray100 },
  mapArea: { flex: 1, position: 'relative', backgroundColor: Colors.gray200 },
  map: { ...StyleSheet.absoluteFillObject },
  markerCircle: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.white, ...Shadows.sm },
  markerInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.white },
  driverMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.white, ...Shadows.md },
  etaBadge: { position: 'absolute', top: Spacing.md, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 6, ...Shadows.md },
  etaText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  card: { backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadows.lg },
  driverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  driverInfo: { flex: 1 },
  driverName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gray900 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gray700 },
  tripCount: { fontSize: FontSize.sm, color: Colors.gray400 },
  actionBtns: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center' },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.gray50, borderRadius: BorderRadius.md, padding: Spacing.md },
  vehicleBadge: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.accent + '20', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  vehicleIcon: { fontSize: 20 },
  vehicleName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.gray900 },
  vehiclePlate: { fontSize: FontSize.sm, color: Colors.gray500, fontWeight: FontWeight.bold, letterSpacing: 1 },
  colorDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.gray300, marginRight: 6 },
  vehicleColor: { fontSize: FontSize.sm, color: Colors.gray500 },
  divider: { height: 1, backgroundColor: Colors.gray100, marginVertical: Spacing.md },
  routeRow: { flexDirection: 'row' },
  routeMarkers: { alignItems: 'center', marginRight: Spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotLine: { width: 2, height: 20, backgroundColor: Colors.gray300, marginVertical: 2 },
  routeLabel: { fontSize: FontSize.sm, color: Colors.gray700, fontWeight: FontWeight.medium },
  bottomRow: { flexDirection: 'row', gap: Spacing.md },
  cancelBtn: { flex: 1, borderRadius: BorderRadius.md, paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.gray100 },
  cancelText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray700 },
  sosBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.error, borderRadius: BorderRadius.md, paddingVertical: 14, paddingHorizontal: Spacing.lg },
  sosText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: BorderRadius.md, paddingVertical: 12, marginBottom: Spacing.sm },
  completeText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
