import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { saveRecentDestination } from '@/utils/location';

// Mock coordinates for preview
const PICKUP_COORD = { latitude: 2.3135, longitude: 102.3211 };
const DEST_COORD = { latitude: 2.3086, longitude: 102.3197 };

// Mock route points for a "track" feel
const ROUTE_POINTS = [
  PICKUP_COORD,
  { latitude: 2.3125, longitude: 102.3215 },
  { latitude: 2.3115, longitude: 102.3205 },
  { latitude: 2.3105, longitude: 102.3195 },
  DEST_COORD,
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

export default function RideRequestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const { 
    destination, 
    address, 
    rideType, 
    price, 
    pickupAddress, 
    pickupLat, 
    pickupLng,
    distance,
    duration,
    polyline
  } = useLocalSearchParams<{ 
    destination: string, 
    address: string,
    rideType: string, 
    price: string,
    pickupAddress?: string,
    pickupLat?: string,
    pickupLng?: string,
    distance?: string,
    duration?: string,
    polyline?: string
  }>();

  const pickupCoord = pickupLat && pickupLng 
    ? { latitude: parseFloat(pickupLat), longitude: parseFloat(pickupLng) }
    : PICKUP_COORD;

  const destCoord = polyline 
    ? JSON.parse(polyline)[JSON.parse(polyline).length - 1]
    : DEST_COORD;

  const routePoints = polyline ? JSON.parse(polyline) : [
    pickupCoord,
    { latitude: (pickupCoord.latitude + destCoord.latitude) / 2 + 0.001, longitude: (pickupCoord.longitude + destCoord.longitude) / 2 + 0.001 },
    destCoord,
  ];

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    border: { borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 },
    divider: { backgroundColor: isDark ? Colors.darkBorder : Colors.gray100 },
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? Colors.darkCard : Colors.white, borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 }]}>
          <Ionicons name="arrow-back" size={24} color={isDark ? Colors.white : Colors.gray900} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.text]}>Confirm Ride</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Map View with Route Preview */}
      <View style={styles.mapContainer}>
        <MapView
          key={isDark ? 'dark-map' : 'light-map'}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: (pickupCoord.latitude + destCoord.latitude) / 2,
            longitude: (pickupCoord.longitude + destCoord.longitude) / 2,
            latitudeDelta: Math.abs(pickupCoord.latitude - destCoord.latitude) * 2 || 0.015,
            longitudeDelta: Math.abs(pickupCoord.longitude - destCoord.longitude) * 2 || 0.015,
          }}
          scrollEnabled={true}
          zoomEnabled={true}
          mapType="standard"
          customMapStyle={isDark ? DARK_MAP_STYLE : []}
          userInterfaceStyle={theme}
        >
          {/* Track / Route Polyline */}
          <Polyline
            coordinates={routePoints}
            strokeColor={Colors.primary}
            strokeWidth={4}
          />

          {/* Pickup Marker */}
          <Marker coordinate={pickupCoord} title="Pickup">
            <View style={[styles.markerCircle, { backgroundColor: Colors.success }]}>
              <View style={styles.markerInner} />
            </View>
          </Marker>

          {/* Destination Marker */}
          <Marker coordinate={destCoord} title="Destination">
            <View style={[styles.markerCircle, { backgroundColor: Colors.error }]}>
              <Ionicons name="location" size={12} color={Colors.white} />
            </View>
          </Marker>
        </MapView>
      </View>

      {/* Bottom card */}
      <View style={[styles.card, dynamicStyles.card]}>
        {/* Route summary */}
        <View style={styles.routeRow}>
          <View style={styles.routeDots}>
            <View style={[styles.dot, { backgroundColor: Colors.success }]} />
            <View style={[styles.dotLine, { backgroundColor: isDark ? Colors.darkBorder : Colors.gray300 }]} />
            <View style={[styles.dot, { backgroundColor: Colors.error }]} />
          </View>
          <View style={styles.routeInfo}>
            <View style={styles.routeStop}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={[styles.routeValue, dynamicStyles.text]} numberOfLines={1}>{pickupAddress || 'Current Location'}</Text>
            </View>
            <View style={styles.routeStop}>
              <Text style={styles.routeLabel}>Destination</Text>
              <Text style={[styles.routeValue, dynamicStyles.text]} numberOfLines={1}>{address || destination || 'UTeM Main Campus'}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.divider, dynamicStyles.divider]} />

        {/* Ride details */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Ionicons name="car" size={20} color={Colors.primary} />
            <Text style={[styles.detailLabel, { color: isDark ? Colors.gray300 : Colors.gray700 }]}>{rideType || 'Economy'}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="time" size={20} color={Colors.accent} />
            <Text style={[styles.detailLabel, { color: isDark ? Colors.gray300 : Colors.gray700 }]}>{duration || '~15 min'}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="navigate-circle" size={20} color={Colors.success} />
            <Text style={[styles.detailLabel, { color: isDark ? Colors.gray300 : Colors.gray700 }]}>{distance || '8.2 km'}</Text>
          </View>
        </View>

        <View style={[styles.divider, dynamicStyles.divider]} />

        {/* Payment */}
        <TouchableOpacity style={styles.paymentRow}>
          <Ionicons name="wallet" size={22} color={Colors.primary} />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={styles.paymentLabel}>Payment Method</Text>
            <Text style={[styles.paymentValue, dynamicStyles.text]}>Cash</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
        </TouchableOpacity>

        <View style={[styles.divider, dynamicStyles.divider]} />

        {/* Price & CTA */}
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>Total fare</Text>
            <Text style={[styles.priceValue, isDark && { color: Colors.primaryLight }]}>{price || 'RM 5.50'}</Text>
          </View>
          <TouchableOpacity
            style={styles.requestBtn}
            onPress={async () => {
              // Save to recent destinations
              await saveRecentDestination({
                name: address || destination || 'UTeM Main Campus',
                address: address || destination || '',
                lat: destCoord.latitude,
                lng: destCoord.longitude,
                icon: 'time'
              });

              router.push({
                pathname: '/(passenger)/active-ride',
                params: { 
                  destination: address || destination || 'UTeM Main Campus',
                  pickupAddress,
                  pickupLat,
                  pickupLng,
                  distance,
                  duration,
                  polyline
                }
              });
            }}
          >
            <Text style={styles.requestText}>Request Ride</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray100 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.gray100, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gray900 },
  mapContainer: { flex: 1, backgroundColor: Colors.gray200 },
  map: { ...StyleSheet.absoluteFillObject },
  markerCircle: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.white, ...Shadows.sm },
  markerInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.white },
  card: { backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadows.lg },
  routeRow: { flexDirection: 'row' },
  routeDots: { alignItems: 'center', marginRight: Spacing.md, paddingTop: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotLine: { width: 2, height: 32, backgroundColor: Colors.gray300, marginVertical: 4 },
  routeInfo: { flex: 1, justifyContent: 'space-between' },
  routeStop: { marginBottom: Spacing.sm },
  routeLabel: { fontSize: FontSize.xs, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5 },
  routeValue: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.gray900, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.gray100, marginVertical: Spacing.md },
  detailsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  detailItem: { alignItems: 'center', gap: 4 },
  detailLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.gray700 },
  paymentRow: { flexDirection: 'row', alignItems: 'center' },
  paymentLabel: { fontSize: FontSize.xs, color: Colors.gray400 },
  paymentValue: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.gray900 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLabel: { fontSize: FontSize.sm, color: Colors.gray500 },
  priceValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.primary },
  requestBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 14, paddingHorizontal: Spacing.xl },
  requestText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
});
