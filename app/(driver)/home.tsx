import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';

// Default region: UTeM Main Campus, Melaka
const UTEM_REGION = {
  latitude: 2.3086,
  longitude: 102.3197,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function DriverHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const mapRef = useRef<MapView>(null);

  const handleLocateMe = () => {
    mapRef.current?.animateToRegion(UTEM_REGION, 800);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Google Map */}
      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={UTEM_REGION}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          mapType="standard"
        />

        {/* Status bar */}
        <View style={[styles.statusBar, isOnline && styles.statusBarOnline]}>
          <View style={[styles.statusDot, isOnline && styles.statusDotOnline]} />
          <Text style={styles.statusLabel}>{isOnline ? 'You are online' : 'You are offline'}</Text>
          <Switch
            value={isOnline}
            onValueChange={setIsOnline}
            trackColor={{ false: Colors.gray600, true: Colors.success }}
            thumbColor={Colors.white}
          />
        </View>

        {/* Current location FAB */}
        <TouchableOpacity style={styles.locationFab} onPress={handleLocateMe}>
          <Ionicons name="locate" size={24} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Bottom panel */}
      <View style={styles.panel}>
        {/* Earnings */}
        <View style={styles.earningsCard}>
          <View>
            <Text style={styles.earningsLabel}>Today's Earnings</Text>
            <Text style={styles.earningsValue}>RM 45.50</Text>
          </View>
          <View style={styles.earningsRight}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>6</Text>
              <Text style={styles.statLabel}>Trips</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>4.2h</Text>
              <Text style={styles.statLabel}>Online</Text>
            </View>
          </View>
        </View>

        {/* Quick actions */}
        {isOnline && (
          <TouchableOpacity
            style={styles.requestCard}
            onPress={() => router.push('/(driver)/ride-request')}
          >
            <View style={styles.requestPulse}>
              <Ionicons name="notifications" size={24} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.requestTitle}>New ride requests</Text>
              <Text style={styles.requestSub}>Tap to view incoming requests</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray500} />
          </TouchableOpacity>
        )}

        {!isOnline && (
          <View style={styles.offlineCard}>
            <Ionicons name="car-sport" size={32} color={Colors.gray500} />
            <Text style={styles.offlineText}>Go online to start receiving ride requests</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  mapArea: { flex: 1, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  locationFab: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.darkCard,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  statusBar: { position: 'absolute', top: Spacing.md, left: Spacing.md, right: Spacing.md, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.darkCard, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.md },
  statusBarOnline: { backgroundColor: Colors.success + '20', borderWidth: 1, borderColor: Colors.success + '40' },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.gray500, marginRight: Spacing.sm },
  statusDotOnline: { backgroundColor: Colors.success },
  statusLabel: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.white },
  panel: { backgroundColor: Colors.darkCard, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  earningsCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.darkBg, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  earningsLabel: { fontSize: FontSize.sm, color: Colors.gray400 },
  earningsValue: { fontSize: FontSize.hero, fontWeight: FontWeight.bold, color: Colors.accent, marginTop: 4 },
  earningsRight: { flexDirection: 'row', gap: Spacing.lg },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
  statLabel: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2 },
  requestCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.accent + '15', borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.accent + '30' },
  requestPulse: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.accent + '20', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  requestTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.white },
  requestSub: { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 2 },
  offlineCard: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  offlineText: { fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center' },
});
