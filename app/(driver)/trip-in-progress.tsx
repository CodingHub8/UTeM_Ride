import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

// Mock coordinates for trip navigation
const PICKUP_COORD = { latitude: 2.3135, longitude: 102.3211 };
const DEST_COORD = { latitude: 2.2274, longitude: 102.2492 }; // Melaka Sentral

const ROUTE_POINTS = [
  PICKUP_COORD,
  { latitude: 2.3000, longitude: 102.3000 },
  { latitude: 2.2500, longitude: 102.2800 },
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

export default function TripInProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark, theme } = useTheme();

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
      {/* Map area */}
      <View style={styles.mapArea}>
        <MapView
          key={isDark ? 'dark-map' : 'light-map'}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: (PICKUP_COORD.latitude + DEST_COORD.latitude) / 2,
            longitude: (PICKUP_COORD.longitude + DEST_COORD.longitude) / 2,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
          customMapStyle={isDark ? DARK_MAP_STYLE : []}
          userInterfaceStyle={theme}
        >
          <Polyline
            coordinates={ROUTE_POINTS}
            strokeColor={accentColor}
            strokeWidth={5}
          />

          <Marker coordinate={PICKUP_COORD}>
            <View style={[styles.markerCircle, { backgroundColor: Colors.success }]}>
              <View style={styles.markerInner} />
            </View>
          </Marker>

          <Marker coordinate={DEST_COORD}>
            <View style={[styles.markerCircle, { backgroundColor: Colors.error }]}>
              <Ionicons name="location" size={12} color={Colors.white} />
            </View>
          </Marker>

          {/* Current Position Marker (Driver) */}
          <Marker coordinate={ROUTE_POINTS[1]} flat anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.driverMarker, { backgroundColor: accentColor }]}>
              <Ionicons name="car" size={24} color={Colors.white} />
            </View>
          </Marker>
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
              <Text style={[styles.routeValue, dynamicStyles.routeValue]}>--</Text>
            </View>
            <View>
              <Text style={styles.routeLabel}>Heading to</Text>
              <Text style={[styles.routeValue, dynamicStyles.routeValue]}>--</Text>
            </View>
          </View>
        </View>

        <View style={[styles.divider, dynamicStyles.divider]} />

        {/* Earnings & distance */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Earnings</Text>
            <Text style={[styles.statValueAccent, { color: accentColor }]}>RM --</Text>
          </View>
          <View style={[styles.statDivider, dynamicStyles.statDivider]} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={[styles.statValue, dynamicStyles.statValue]}>--</Text>
          </View>
          <View style={[styles.statDivider, dynamicStyles.statDivider]} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>ETA</Text>
            <Text style={[styles.statValue, dynamicStyles.statValue]}>--</Text>
          </View>
        </View>

        <View style={[styles.divider, dynamicStyles.divider]} />

        {/* Complete button */}
        <TouchableOpacity
          style={[styles.completeBtn, { backgroundColor: Colors.primary }]}
          onPress={() => router.replace('/(driver)/home')}
        >
          <Ionicons name="checkmark-done" size={22} color={Colors.white} />
          <Text style={styles.completeText}>Complete Trip</Text>
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
