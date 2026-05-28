import { BorderRadius, Colors, FontSize, FontWeight, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Default fallback coordinates
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
  const { 
    destination, 
    pickupAddress, 
    pickupLat, 
    pickupLng,
    distance,
    duration,
    polyline
  } = useLocalSearchParams<{
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

  const driverCoord = DEFAULT_PICKUP;

  const routePoints = polyline ? JSON.parse(polyline) : [
    pickupCoord,
    { latitude: (pickupCoord.latitude + destCoord.latitude) / 2 + 0.001, longitude: (pickupCoord.longitude + destCoord.longitude) / 2 + 0.001 },
    destCoord,
  ];

  const destinationName = destination || 'UTeM Main Campus';

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

          {/* Driver Marker */}
          <Marker coordinate={driverCoord} flat anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarker}>
              <Ionicons name="car" size={24} color={Colors.white} />
            </View>
          </Marker>
        </MapView>

        {/* ETA badge */}
        <View style={styles.etaBadge}>
          <Ionicons name="time" size={18} color={Colors.white} />
          <Text style={styles.etaText}>{duration || '3 min'} away</Text>
        </View>
      </View>

      {/* Driver card */}
      <View style={[styles.card, dynamicStyles.card]}>
        <View style={styles.driverRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={Colors.white} />
          </View>
          <View style={styles.driverInfo}>
            <Text style={[styles.driverName, dynamicStyles.text]}>Your Driver</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={Colors.accent} />
              <Text style={[styles.ratingText, dynamicStyles.text]}>--</Text>
              <Text style={styles.tripCount}>· -- trips</Text>
            </View>
          </View>
          <View style={styles.actionBtns}>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="call" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="chatbubble" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Vehicle info */}
        <View style={[styles.vehicleRow, dynamicStyles.vehicleRow]}>
          <View style={styles.vehicleBadge}>
            <Text style={styles.vehicleIcon}>🚗</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.vehicleName, dynamicStyles.text]}>--</Text>
            <Text style={[styles.vehiclePlate, dynamicStyles.subText]}>--</Text>
          </View>
          <View style={[styles.colorDot, isDark && { borderColor: Colors.darkBorder }]} />
          <Text style={[styles.vehicleColor, dynamicStyles.subText]}>--</Text>
        </View>

        <View style={[styles.divider, dynamicStyles.divider]} />

        {/* Route */}
        <View style={styles.routeRow}>
          <View style={styles.routeMarkers}>
            <View style={[styles.dot, { backgroundColor: Colors.success }]} />
            <View style={[styles.dotLine, dynamicStyles.divider]} />
            <View style={[styles.dot, { backgroundColor: Colors.error }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.routeLabel, dynamicStyles.text]} numberOfLines={1}>{pickupAddress || 'Current Location'}</Text>
            <Text style={[styles.routeLabel, dynamicStyles.text, { marginTop: 20 }]} numberOfLines={1}>{destinationName}</Text>
          </View>
        </View>

        <View style={[styles.divider, dynamicStyles.divider]} />

        {/* Actions */}
        <View style={styles.bottomRow}>
          <TouchableOpacity style={[styles.cancelBtn, isDark && { backgroundColor: Colors.gray900 }]} onPress={() => router.back()}>
            <Text style={[styles.cancelText, dynamicStyles.subText]}>Cancel Ride</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sosBtn}>
            <Ionicons name="alert-circle" size={20} color={Colors.white} />
            <Text style={styles.sosText}>SOS</Text>
          </TouchableOpacity>
        </View>
      </View>
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
});
