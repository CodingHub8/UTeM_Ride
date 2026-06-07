import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

// Mock coordinates for navigation to pickup
const DRIVER_COORD = { latitude: 2.3165, longitude: 102.3245 };
const PICKUP_COORD = { latitude: 2.3135, longitude: 102.3211 };

const ROUTE_POINTS = [
  DRIVER_COORD,
  { latitude: 2.3155, longitude: 102.3235 },
  { latitude: 2.3145, longitude: 102.3225 },
  PICKUP_COORD,
];

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

export default function ActivePickupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark, theme } = useTheme();

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

  const handleArrived = () => {
    router.push({
      pathname: '/(driver)/trip-in-progress',
      params: { 
        rideId, 
        price, 
        pickup, 
        destination, 
        passengerName, 
        passengerUsername, 
        passengerEmail, 
        passengerPhone, 
        passengerGender 
      }
    });
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    panel: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    passengerName: { color: isDark ? Colors.white : Colors.gray900 },
    pickupAddr: { color: isDark ? Colors.gray400 : Colors.gray500 },
    divider: { backgroundColor: isDark ? Colors.darkBorder : Colors.gray200 },
    cancelBtn: { 
      backgroundColor: isDark ? Colors.darkBg : Colors.gray100, 
      borderColor: isDark ? Colors.darkBorder : Colors.gray300 
    },
    cancelText: { color: isDark ? Colors.gray400 : Colors.gray600 },
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      {/* Map area */}
      <View style={styles.mapArea}>
        <MapView
          key={isDark ? 'dark-map' : 'light-map'}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: (DRIVER_COORD.latitude + PICKUP_COORD.latitude) / 2,
            longitude: (DRIVER_COORD.longitude + PICKUP_COORD.longitude) / 2,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }}
          customMapStyle={isDark ? DARK_MAP_STYLE : []}
          userInterfaceStyle={theme}
        >
          <Polyline
            coordinates={ROUTE_POINTS}
            strokeColor={Colors.primary}
            strokeWidth={5}
          />

          {/* Pickup Marker */}
          <Marker coordinate={PICKUP_COORD}>
            <View style={[styles.markerCircle, { backgroundColor: Colors.success }]}>
              <View style={styles.markerInner} />
            </View>
          </Marker>

          {/* Driver Marker */}
          <Marker coordinate={DRIVER_COORD} flat anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarker}>
              <Ionicons name="car" size={24} color={Colors.white} />
            </View>
          </Marker>
        </MapView>

        {/* ETA badge */}
        <View style={styles.etaBadge}>
          <Ionicons name="time" size={16} color={Colors.white} />
          <Text style={styles.etaText}>3 min · 2.3 km</Text>
        </View>
      </View>

      {/* Bottom panel */}
      <View style={[styles.panel, dynamicStyles.panel]}>
        <Text style={styles.panelTitle}>Heading to pickup</Text>

        {/* Passenger info */}
        <View style={styles.passengerRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.passengerName, dynamicStyles.passengerName]}>{passengerName || 'Passenger'}</Text>
            <Text style={[styles.pickupAddr, dynamicStyles.pickupAddr]}>{pickup || 'FTMK, UTeM Main Campus'}</Text>
          </View>
          <TouchableOpacity style={styles.contactBtn}>
            <Ionicons name="call" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactBtn}>
            <Ionicons name="chatbubble" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, dynamicStyles.divider]} />

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.cancelBtn, dynamicStyles.cancelBtn]} onPress={() => router.back()}>
            <Text style={[styles.cancelText, dynamicStyles.cancelText]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.arrivedBtn}
            onPress={handleArrived}
          >
            <Ionicons name="checkmark-circle" size={22} color={Colors.white} />
            <Text style={styles.arrivedText}>{"I've Arrived"}</Text>
          </TouchableOpacity>
        </View>
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
  driverMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.white, ...Shadows.md },
  etaBadge: { position: 'absolute', top: Spacing.md, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 6 },
  etaText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  panel: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  panelTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  passengerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  passengerName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  pickupAddr: { fontSize: FontSize.sm, marginTop: 2 },
  contactBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.sm },
  divider: { height: 1, marginVertical: Spacing.lg },
  actionRow: { flexDirection: 'row', gap: Spacing.md },
  cancelBtn: { flex: 1, borderRadius: BorderRadius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  cancelText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  arrivedBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.success, borderRadius: BorderRadius.md, paddingVertical: 14 },
  arrivedText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.white },
});
