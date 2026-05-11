import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';

// Mock coordinates for trip navigation
const PICKUP_COORD = { latitude: 2.3135, longitude: 102.3211 };
const DEST_COORD = { latitude: 2.2274, longitude: 102.2492 }; // Melaka Sentral

const ROUTE_POINTS = [
  PICKUP_COORD,
  { latitude: 2.3000, longitude: 102.3000 },
  { latitude: 2.2500, longitude: 102.2800 },
  DEST_COORD,
];

export default function TripInProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Map area */}
      <View style={styles.mapArea}>
        <MapView
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: (PICKUP_COORD.latitude + DEST_COORD.latitude) / 2,
            longitude: (PICKUP_COORD.longitude + DEST_COORD.longitude) / 2,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
        >
          <Polyline
            coordinates={ROUTE_POINTS}
            strokeColor={Colors.accent}
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
            <View style={styles.driverMarker}>
              <Ionicons name="car" size={24} color={Colors.white} />
            </View>
          </Marker>
        </MapView>

        {/* Trip info badge */}
        <View style={styles.tripBadge}>
          <Ionicons name="car-sport" size={18} color={Colors.accent} />
          <Text style={styles.tripBadgeText}>Trip in progress</Text>
        </View>
      </View>

      {/* Bottom panel */}
      <View style={styles.panel}>
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
              <Text style={styles.routeValue}>Kolej Kediaman 3, UTeM</Text>
            </View>
            <View>
              <Text style={styles.routeLabel}>Heading to</Text>
              <Text style={styles.routeValue}>Melaka Sentral</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Earnings & distance */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Earnings</Text>
            <Text style={styles.statValueAccent}>RM 5.50</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>8.2 km</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>ETA</Text>
            <Text style={styles.statValue}>12 min</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Complete button */}
        <TouchableOpacity
          style={styles.completeBtn}
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
  container: { flex: 1, backgroundColor: Colors.darkBg },
  mapArea: { flex: 1, position: 'relative', backgroundColor: Colors.gray800 },
  map: { ...StyleSheet.absoluteFillObject },
  markerCircle: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.white, ...Shadows.sm },
  markerInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.white },
  driverMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.white, ...Shadows.md },
  tripBadge: { position: 'absolute', top: Spacing.md, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.accent + '20', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 6, borderWidth: 1, borderColor: Colors.accent + '40' },
  tripBadgeText: { color: Colors.accent, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  panel: { backgroundColor: Colors.darkCard, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  routeRow: { flexDirection: 'row' },
  routeMarkers: { alignItems: 'center', marginRight: Spacing.md, paddingTop: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotLine: { width: 2, height: 24, backgroundColor: Colors.gray600, marginVertical: 4 },
  routeLabel: { fontSize: FontSize.xs, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5 },
  routeValue: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.white, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.darkBorder, marginVertical: Spacing.md },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: FontSize.xs, color: Colors.gray400, marginBottom: 4 },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.white },
  statValueAccent: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.accent },
  statDivider: { width: 1, backgroundColor: Colors.darkBorder },
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.accent, borderRadius: BorderRadius.md, paddingVertical: 16 },
  completeText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.white },
});
