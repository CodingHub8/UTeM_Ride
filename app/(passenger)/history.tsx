import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/utils/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

const DEFAULT_PICKUP = { latitude: 2.3135, longitude: 102.3211 };
const DEFAULT_DEST = { latitude: 2.3086, longitude: 102.3197 };

const DARK_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { isDark, theme } = useTheme();
  const { user } = useAuth();
  
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState<any | null>(null);

  // Load simulated/mock entries for fallback or immediate preview
  const getMockRides = () => {
    return [
      {
        id: 'mock_trip_01',
        passenger_id: user?.id || 'passenger_1',
        passenger_name: user?.name || 'Muhammad Hazim',
        pickup_address: 'Kolej Kediaman Lestari, UTeM Main Campus',
        pickup_coords: { latitude: 2.3135, longitude: 102.3211 },
        destination_address: 'Fakulti Teknologi Maklumat dan Komunikasi (FTMK), UTeM',
        destination_coords: { latitude: 2.3086, longitude: 102.3197 },
        fare: 'RM 6.50',
        payment_method: 'fpx',
        payment_label: 'FPX (Maybank2u)',
        timestamp: Date.now() - 3600000 * 2, // 2 hours ago
        status: 'completed',
        route_polyline: [
          { latitude: 2.3135, longitude: 102.3211 },
          { latitude: 2.3110, longitude: 102.3204 },
          { latitude: 2.3086, longitude: 102.3197 }
        ],
        distance: '2.4 km',
        duration: '6 min',
        driver_name: 'Ahmad Fauzi',
        driver_vehicle: 'Perodua Myvi (Silver)',
        driver_plate: 'MAB 1234'
      },
      {
        id: 'mock_trip_02',
        passenger_id: user?.id || 'passenger_1',
        passenger_name: user?.name || 'Muhammad Hazim',
        pickup_address: 'Kolej Kediaman Lestari, UTeM Main Campus',
        pickup_coords: { latitude: 2.3135, longitude: 102.3211 },
        destination_address: 'Mydin MITC, Ayer Keroh, Melaka',
        destination_coords: { latitude: 2.2714, longitude: 102.2858 },
        fare: 'RM 14.80',
        payment_method: 'card',
        payment_label: 'Card (*5678)',
        timestamp: Date.now() - 3600000 * 24, // 1 day ago
        status: 'pending_payment',
        route_polyline: [
          { latitude: 2.3135, longitude: 102.3211 },
          { latitude: 2.2925, longitude: 102.3035 },
          { latitude: 2.2714, longitude: 102.2858 }
        ],
        distance: '8.2 km',
        duration: '15 min',
        driver_name: 'Siti Aminah',
        driver_vehicle: 'Proton Saga (Grey)',
        driver_plate: 'KCX 4321'
      },
      {
        id: 'mock_trip_03',
        passenger_id: user?.id || 'passenger_1',
        passenger_name: user?.name || 'Muhammad Hazim',
        pickup_address: 'Fakulti Kejuruteraan Elektrik (FKE), UTeM',
        pickup_coords: { latitude: 2.3105, longitude: 102.3242 },
        destination_address: 'Kolej Kediaman Satria, UTeM',
        destination_coords: { latitude: 2.3164, longitude: 102.3235 },
        fare: 'RM 5.00',
        payment_method: 'cash',
        payment_label: 'Cash',
        timestamp: Date.now() - 3600000 * 48, // 2 days ago
        status: 'cancelled',
        route_polyline: [
          { latitude: 2.3105, longitude: 102.3242 },
          { latitude: 2.3164, longitude: 102.3235 }
        ],
        distance: '1.2 km',
        duration: '4 min',
        driver_name: 'Mohd Rizal',
        driver_vehicle: 'Toyota Vios (Black)',
        driver_plate: 'WXX 9988'
      }
    ];
  };

  useEffect(() => {
    if (!user?.id) {
      setRides(getMockRides());
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'rides'),
      where('passenger_id', '==', user.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRides: any[] = [];
      snapshot.forEach((doc) => {
        fetchedRides.push({ id: doc.id, ...doc.data() });
      });

      // Sort client-side by timestamp descending to avoid composite index requirements
      fetchedRides.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      if (fetchedRides.length === 0) {
        // Fallback to simulated entries if empty
        setRides(getMockRides());
      } else {
        setRides(fetchedRides);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching ride history:', error);
      setRides(getMockRides());
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id]);

  const formatDate = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleString('en-MY', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch (e) {
      return 'Unknown Date';
    }
  };

  const getRoutePoints = (ride: any) => {
    if (ride.route_polyline && Array.isArray(ride.route_polyline)) {
      return ride.route_polyline;
    }
    return [
      ride.pickup_coords || DEFAULT_PICKUP,
      ride.destination_coords || DEFAULT_DEST
    ];
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    border: { borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 },
    divider: { backgroundColor: isDark ? Colors.darkBorder : Colors.gray100 },
    modalContent: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          badge: { backgroundColor: Colors.success + '15' },
          text: { color: Colors.success, label: 'Completed' }
        };
      case 'pending_payment':
        return {
          badge: { backgroundColor: Colors.accent + '15' },
          text: { color: Colors.accent, label: 'Pending Payment' }
        };
      case 'cancelled':
      default:
        return {
          badge: { backgroundColor: Colors.error + '15' },
          text: { color: Colors.error, label: 'Cancelled' }
        };
    }
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, dynamicStyles.text]}>Ride History</Text>
        <Text style={styles.headerSub}>{loading ? 'Loading...' : `${rides.length} rides`}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="car-outline" size={64} color={isDark ? Colors.gray700 : Colors.gray300} />
              <Text style={[styles.emptyText, dynamicStyles.text]}>You haven't booked any rides.</Text>
              <Text style={[styles.emptySub, dynamicStyles.subText]}>Rides you request and complete will appear here.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusConfig = getStatusStyle(item.status);
            return (
              <TouchableOpacity 
                style={[styles.card, dynamicStyles.card]}
                activeOpacity={0.8}
                onPress={() => setSelectedRide(item)}
              >
                <View style={styles.cardTop}>
                  <Text style={[styles.date, dynamicStyles.subText]}>{formatDate(item.timestamp)}</Text>
                  <View style={[styles.statusBadge, statusConfig.badge]}>
                    <Text style={[styles.statusText, { color: statusConfig.text.color }]}>
                      {statusConfig.text.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.routeRow}>
                  <View style={styles.routeMarkers}>
                    <View style={[styles.dot, { backgroundColor: Colors.success }]} />
                    <View style={[styles.dotLine, dynamicStyles.divider]} />
                    <View style={[styles.dot, { backgroundColor: Colors.error }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.routeText, dynamicStyles.text]} numberOfLines={1}>{item.pickup_address}</Text>
                    <Text style={[styles.routeText, dynamicStyles.text, { marginTop: 14 }]} numberOfLines={1}>{item.destination_address}</Text>
                  </View>
                </View>

                <View style={[styles.cardBottom, { borderTopColor: isDark ? Colors.darkBorder : Colors.gray100 }]}>
                  <View style={styles.driverChip}>
                    <Ionicons name="person-circle" size={20} color={isDark ? Colors.gray500 : Colors.gray400} />
                    <Text style={[styles.driverName, dynamicStyles.subText]}>{item.driver_name || 'Finding Driver...'}</Text>
                  </View>
                  <Text style={[styles.price, { color: isDark ? Colors.primaryLight : Colors.primary }]}>{item.fare}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Inspection Modal Detail Overlay */}
      <Modal
        visible={!!selectedRide}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRide(null)}
      >
        <View style={styles.modalOverlay}>
          {selectedRide && (
            <View style={[styles.modalContent, dynamicStyles.modalContent]}>
              {/* Modal Drag Handle/Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, dynamicStyles.text]}>Trip Details</Text>
                  <Text style={styles.modalSub}>ID: {selectedRide.id}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setSelectedRide(null)} 
                  style={[styles.closeBtn, { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 }]}
                >
                  <Ionicons name="close" size={20} color={isDark ? Colors.white : Colors.gray900} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
                {/* Mini Non-interactive Map */}
                <View style={styles.miniMapContainer}>
                  <MapView
                    key={isDark ? 'dark-map-mini' : 'light-map-mini'}
                    style={styles.miniMap}
                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                    liteMode={Platform.OS === 'android'}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    initialRegion={{
                      latitude: ((selectedRide.pickup_coords?.latitude || DEFAULT_PICKUP.latitude) + (selectedRide.destination_coords?.latitude || DEFAULT_DEST.latitude)) / 2,
                      longitude: ((selectedRide.pickup_coords?.longitude || DEFAULT_PICKUP.longitude) + (selectedRide.destination_coords?.longitude || DEFAULT_DEST.longitude)) / 2,
                      latitudeDelta: Math.abs((selectedRide.pickup_coords?.latitude || DEFAULT_PICKUP.latitude) - (selectedRide.destination_coords?.latitude || DEFAULT_DEST.latitude)) * 2.5 || 0.015,
                      longitudeDelta: Math.abs((selectedRide.pickup_coords?.longitude || DEFAULT_PICKUP.longitude) - (selectedRide.destination_coords?.longitude || DEFAULT_DEST.longitude)) * 2.5 || 0.015,
                    }}
                    customMapStyle={isDark ? DARK_MAP_STYLE : []}
                    userInterfaceStyle={theme}
                  >
                    <Polyline
                      coordinates={getRoutePoints(selectedRide)}
                      strokeColor={Colors.primary}
                      strokeWidth={3}
                    />
                    <Marker coordinate={selectedRide.pickup_coords || DEFAULT_PICKUP}>
                      <View style={[styles.mapDot, { backgroundColor: Colors.success }]} />
                    </Marker>
                    <Marker coordinate={selectedRide.destination_coords || DEFAULT_DEST}>
                      <View style={[styles.mapDot, { backgroundColor: Colors.error }]} />
                    </Marker>
                  </MapView>
                </View>

                {/* Locations list (no line limit, wraps addresses) */}
                <View style={styles.detailLocations}>
                  <View style={styles.detailLocationRow}>
                    <View style={[styles.dot, { backgroundColor: Colors.success }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailLocationLabel}>Pickup Location</Text>
                      <Text style={[styles.detailLocationText, dynamicStyles.text]}>{selectedRide.pickup_address}</Text>
                    </View>
                  </View>
                  <View style={[styles.dotLineLong, dynamicStyles.divider]} />
                  <View style={styles.detailLocationRow}>
                    <View style={[styles.dot, { backgroundColor: Colors.error }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailLocationLabel}>Destination Location</Text>
                      <Text style={[styles.detailLocationText, dynamicStyles.text]}>{selectedRide.destination_address}</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.modalDivider, dynamicStyles.divider]} />

                {/* Driver Profile Section */}
                <View style={styles.driverSection}>
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={24} color={Colors.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.driverTitle, dynamicStyles.subText]}>Your Driver</Text>
                    <Text style={[styles.driverNameText, dynamicStyles.text]}>{selectedRide.driver_name || 'N/A'}</Text>
                    <Text style={[styles.driverCarText, dynamicStyles.subText]}>
                      {selectedRide.driver_vehicle || 'Vehicle details unavailable'} · <Text style={{ fontWeight: 'bold' }}>{selectedRide.driver_plate || ''}</Text>
                    </Text>
                  </View>
                </View>

                <View style={[styles.modalDivider, dynamicStyles.divider]} />

                {/* Trip stats grid */}
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Ionicons name="navigate-circle-outline" size={20} color={Colors.primary} />
                    <Text style={[styles.statValue, dynamicStyles.text]}>{selectedRide.distance || '--'}</Text>
                    <Text style={styles.statLabel}>Distance</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Ionicons name="time-outline" size={20} color={Colors.accent} />
                    <Text style={[styles.statValue, dynamicStyles.text]}>{selectedRide.duration || '--'}</Text>
                    <Text style={styles.statLabel}>Duration</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Ionicons name="calendar-outline" size={20} color={Colors.success} />
                    <Text style={[styles.statValue, dynamicStyles.text, { fontSize: 11 }]}>
                      {new Date(selectedRide.timestamp).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                    </Text>
                    <Text style={styles.statLabel}>Date</Text>
                  </View>
                </View>

                <View style={[styles.modalDivider, dynamicStyles.divider]} />

                {/* Fare & Billing Summary */}
                <View style={styles.billingCard}>
                  <View style={styles.billingRow}>
                    <Text style={styles.billingLabel}>Payment Method</Text>
                    <Text style={[styles.billingValue, dynamicStyles.text]}>{selectedRide.payment_label || 'Cash'}</Text>
                  </View>
                  <View style={styles.billingRow}>
                    <Text style={styles.billingLabel}>Status</Text>
                    <View style={[styles.statusBadge, getStatusStyle(selectedRide.status).badge]}>
                      <Text style={[styles.statusText, { color: getStatusStyle(selectedRide.status).text.color, fontSize: 11 }]}>
                        {getStatusStyle(selectedRide.status).text.label}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.billingRow, { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: isDark ? Colors.gray800 : Colors.gray100 }]}>
                    <Text style={[styles.billingLabel, { fontWeight: FontWeight.bold }]}>Total Paid</Text>
                    <Text style={[styles.billingPrice, { color: isDark ? Colors.primaryLight : Colors.primary }]}>{selectedRide.fare}</Text>
                  </View>
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  headerSub: { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, flexGrow: 1 },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadows.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  date: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  statusBadge: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  routeRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  routeMarkers: { alignItems: 'center', marginRight: Spacing.md, paddingTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotLine: { width: 2, height: 22, backgroundColor: Colors.gray300, marginVertical: 4 },
  routeText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flex: 1 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: Spacing.sm },
  driverChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  driverName: { fontSize: FontSize.sm },
  price: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, marginTop: 100 },
  emptyText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginTop: Spacing.md, textAlign: 'center' },
  emptySub: { fontSize: FontSize.sm, marginTop: 4, textAlign: 'center' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, height: '80%', padding: Spacing.lg, ...Shadows.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  modalSub: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modalScroll: { paddingBottom: Spacing.xl },
  miniMapContainer: { height: 160, borderRadius: BorderRadius.md, overflow: 'hidden', marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray200 },
  miniMap: { ...StyleSheet.absoluteFillObject },
  mapDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.white },
  detailLocations: { paddingHorizontal: 4 },
  detailLocationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  detailLocationLabel: { fontSize: FontSize.xs, color: Colors.gray400, fontWeight: FontWeight.medium, textTransform: 'uppercase' },
  detailLocationText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginTop: 2 },
  dotLineLong: { width: 2, height: 20, marginVertical: 4, marginLeft: 4, backgroundColor: Colors.gray200 },
  modalDivider: { height: 1, marginVertical: Spacing.md },
  driverSection: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  driverTitle: { fontSize: FontSize.xs, textTransform: 'uppercase' },
  driverNameText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginTop: 2 },
  driverCarText: { fontSize: FontSize.xs, marginTop: 2 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.sm },
  statBox: { alignItems: 'center', gap: 4, flex: 1 },
  statValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  statLabel: { fontSize: FontSize.xs, color: Colors.gray400 },
  billingCard: { borderRadius: BorderRadius.md, padding: Spacing.md, backgroundColor: Colors.gray100 + '30', borderWidth: 1, borderColor: Colors.gray200 + '50' },
  billingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  billingLabel: { fontSize: FontSize.sm, color: Colors.gray500 },
  billingValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  billingPrice: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
});
