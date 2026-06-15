import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

// Default region: UTeM Main Campus, Melaka
const UTEM_REGION = {
  latitude: 2.3086,
  longitude: 102.3197,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

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

export default function DriverHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, verify2FA } = useAuth();
  const { isDark, theme } = useTheme();
  const [isOnline, setIsOnline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeRide, setActiveRide] = useState<any | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(collection(db, 'rides'), where('driver_id', '==', user.id));
    const unsub = onSnapshot(q, (snap) => {
      const active: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (['accepted', 'arrived', 'in_progress'].includes(data.status)) {
          active.push({ id: d.id, ...data });
        }
      });
      active.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setActiveRide(active[0] || null);
    }, (err) => console.warn('Driver active ride listener error:', err));
    return unsub;
  }, [user?.id]);

  const resumeActiveRide = () => {
    if (!activeRide) return;
    const params = {
      rideId: activeRide.id,
      price: activeRide.fare || '',
      pickup: activeRide.pickup_address || '',
      destination: activeRide.destination_address || '',
      passengerName: activeRide.passenger_name || 'Passenger',
      passengerUsername: (activeRide.passenger_name || 'passenger').toLowerCase().replace(/\s+/g, '_'),
      passengerEmail: '',
      passengerPhone: activeRide.passenger_phone || '',
      passengerGender: '',
    };
    if (activeRide.status === 'in_progress') {
      router.push({ pathname: '/(driver)/trip-in-progress', params });
    } else {
      router.push({ pathname: '/(driver)/active-pickup', params });
    }
  };

  useEffect(() => {
    if (!isOnline) {
      setPendingCount(0);
      return;
    }
    const q = query(
      collection(db, 'rides'),
      where('status', '==', 'requested'),
      where('driver_id', '==', null)
    );
    const unsub = onSnapshot(q, (snap) => {
      setPendingCount(snap.size);
    }, (err) => {
      console.error('Driver home pending listener error:', err);
    });
    return unsub;
  }, [isOnline]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(c);
        mapRef.current?.animateToRegion({
          latitude: c.latitude,
          longitude: c.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 800);
      } catch (e) {
        console.warn('Driver home location error:', e);
      }
    })();
  }, []);

  const handleLocateMe = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== 'granted') {
          Alert.alert('Location Required', 'Enable location access to use this feature.');
          return;
        }
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(c);
      mapRef.current?.animateToRegion({
        latitude: c.latitude,
        longitude: c.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 800);
    } catch (e) {
      console.warn('Locate me error:', e);
      const last = await Location.getLastKnownPositionAsync({});
      if (last) {
        mapRef.current?.animateToRegion({
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 800);
      } else {
        mapRef.current?.animateToRegion(UTEM_REGION, 800);
      }
    }
  };

  const handleToggleOnline = (value: boolean) => {
    if (value && user && !user.is_2FA_verified) {
      Alert.alert(
        '2FA Required',
        'Please complete your 2FA verification first to go online and receive requests.',
        [{ text: 'OK' }]
      );
      return;
    }
    setIsOnline(value);
  };

  const handleSchedulePool = () => {
    if (user && !user.is_2FA_verified) {
      Alert.alert(
        '2FA Required',
        'Please complete your 2FA verification first to schedule/pool rides.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.push('/(driver)/create-pool');
  };

  const handleViewRequests = () => {
    if (user && !user.is_2FA_verified) {
      Alert.alert(
        '2FA Required',
        'Please complete your 2FA verification first to view ride requests.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.push('/(driver)/ride-request');
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray100 },
    statusBar: { 
      backgroundColor: isDark ? Colors.darkCard : Colors.white,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
      borderWidth: isDark ? 1 : 0,
    },
    statusLabel: { color: isDark ? Colors.white : Colors.gray900 },
    panel: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    earningsCard: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    earningsLabel: { color: isDark ? Colors.gray400 : Colors.gray500 },
    earningsValue: { color: Colors.primary },
    statValue: { color: isDark ? Colors.white : Colors.gray900 },
    statLabel: { color: isDark ? Colors.gray400 : Colors.gray500 },
    actionBtnText: { color: isDark ? Colors.white : Colors.gray800 },
    offlineText: { color: isDark ? Colors.gray500 : Colors.gray400 },
    locationFab: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      {activeRide && (
        <TouchableOpacity
          style={[styles.verificationBanner, { backgroundColor: Colors.primary, top: insets.top + 10, zIndex: 101 }]}
          onPress={resumeActiveRide}
          activeOpacity={0.9}
        >
          <View style={styles.verificationBannerLeft}>
            <Ionicons name="car-sport" size={18} color={Colors.white} />
            <Text style={styles.verificationBannerText}>
              {activeRide.status === 'in_progress' ? 'Trip in progress — tap to resume' :
               activeRide.status === 'arrived' ? 'You marked arrived — tap to resume' :
               'Active pickup — tap to resume'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.white} />
        </TouchableOpacity>
      )}
      {/* 2FA Banner */}
      {user && !user.is_2FA_verified && (
        <TouchableOpacity 
          style={[styles.verificationBanner, { backgroundColor: Colors.warning, top: insets.top + 10 + (activeRide ? 56 : 0) }]}
          onPress={async () => {
            Alert.alert(
              'Simulate 2FA Verification',
              'Do you want to simulate clicking the email/SMS link to complete 2FA verification?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Verify 2FA Now',
                  onPress: async () => {
                    try {
                      await verify2FA();
                      Alert.alert('2FA Verified', 'Account has been successfully verified.');
                    } catch (err) {
                      Alert.alert('Error', 'Verification failed.');
                    }
                  }
                }
              ]
            );
          }}
        >
          <View style={styles.verificationBannerLeft}>
            <Ionicons name="warning-outline" size={18} color={Colors.white} />
            <Text style={styles.verificationBannerText}>
              2FA Pending: Tap to simulate link verification.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.white} />
        </TouchableOpacity>
      )}

      {/* Google Map */}
      <View style={styles.mapArea}>
        <MapView
          key={isDark ? 'dark-map' : 'light-map'}
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={UTEM_REGION}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          mapType="standard"
          customMapStyle={isDark ? DARK_MAP_STYLE : []}
          userInterfaceStyle={theme}
        />

        {/* Status bar */}
        <View style={[styles.statusBar, dynamicStyles.statusBar, isOnline && styles.statusBarOnline]}>
          <View style={[styles.statusDot, isOnline && styles.statusDotOnline]} />
          <Text style={[styles.statusLabel, dynamicStyles.statusLabel]}>{isOnline ? 'You are online' : 'You are offline'}</Text>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            trackColor={{ false: Colors.gray600, true: Colors.success }}
            thumbColor={Colors.white}
          />
        </View>

        {/* Current location FAB */}
        <TouchableOpacity style={[styles.locationFab, dynamicStyles.locationFab]} onPress={handleLocateMe}>
          <Ionicons name="locate" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Bottom panel */}
      <View style={[styles.panel, dynamicStyles.panel]}>
        {/* Earnings */}
        <View style={[styles.earningsCard, dynamicStyles.earningsCard]}>
          <View>
            <Text style={[styles.earningsLabel, dynamicStyles.earningsLabel]}>{"Today's Earnings"}</Text>
            <Text style={[styles.earningsValue, dynamicStyles.earningsValue]}>RM 0.00</Text>
          </View>
          <View style={styles.earningsRight}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, dynamicStyles.statValue]}>0</Text>
              <Text style={[styles.statLabel, dynamicStyles.statLabel]}>Trips</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, dynamicStyles.statValue]}>0h</Text>
              <Text style={[styles.statLabel, dynamicStyles.statLabel]}>Online</Text>
            </View>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '30' }]}
            onPress={handleSchedulePool}
          >
            <Ionicons name="calendar" size={24} color={Colors.primary} />
            <Text style={[styles.actionBtnText, dynamicStyles.actionBtnText]}>Schedule / Pool</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '30' }]}
            onPress={() => router.push('/(driver)/wallet')}
          >
            <Ionicons name="wallet" size={24} color={Colors.primary} />
            <Text style={[styles.actionBtnText, dynamicStyles.actionBtnText]}>Earnings</Text>
          </TouchableOpacity>
        </View>

        {isOnline && (
          <TouchableOpacity
            style={styles.requestCard}
            onPress={handleViewRequests}
          >
            <View style={styles.requestPulse}>
              <Ionicons name="notifications" size={24} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.requestTitle}>
                {pendingCount > 0 ? `${pendingCount} new ride request${pendingCount > 1 ? 's' : ''}` : 'Waiting for requests'}
              </Text>
              <Text style={styles.requestSub}>
                {pendingCount > 0 ? 'Tap to view and accept' : 'Live ride feed enabled'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray500} />
          </TouchableOpacity>
        )}

        {!isOnline && (
          <View style={styles.offlineCard}>
            <Ionicons name="car-sport" size={32} color={Colors.gray500} />
            <Text style={[styles.offlineText, dynamicStyles.offlineText]}>Go online to start receiving ride requests</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapArea: { flex: 1, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  locationFab: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  statusBar: { position: 'absolute', top: Spacing.md, left: Spacing.md, right: Spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.md },
  statusBarOnline: { backgroundColor: Colors.success + '20', borderWidth: 1, borderColor: Colors.success + '40' },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.gray500, marginRight: Spacing.sm },
  statusDotOnline: { backgroundColor: Colors.success },
  statusLabel: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  panel: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  earningsCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  earningsLabel: { fontSize: FontSize.sm },
  earningsValue: { fontSize: FontSize.hero, fontWeight: FontWeight.bold, marginTop: 4 },
  earningsRight: { flexDirection: 'row', gap: Spacing.lg },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  statLabel: { fontSize: FontSize.xs, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1 },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  requestCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary + '15', borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '30' },
  requestPulse: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  requestTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.white },
  requestSub: { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 2 },
  offlineCard: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  offlineText: { fontSize: FontSize.md, textAlign: 'center' },
  verificationBanner: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    zIndex: 100,
    ...Shadows.md,
  },
  verificationBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  verificationBannerText: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.xs,
  },
});

