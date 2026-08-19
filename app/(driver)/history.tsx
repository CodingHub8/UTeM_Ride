import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/utils/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { parseFare } from '@/utils/rides';

const DEFAULT_PICKUP = { latitude: 2.3135, longitude: 102.3211 };
const DEFAULT_DEST = { latitude: 2.3086, longitude: 102.3197 };

const DARK_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
];

export default function DriverHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const { user } = useAuth();
  
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    try {
      if (user?.id) {
        setLoading(true);
      }
    } finally {
      setTimeout(() => {
        setRefreshing(false);
        setLoading(false);
      }, 1000);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setRides([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'rides'),
      where('driver_id', '==', user.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRides: any[] = [];
      snapshot.forEach((doc) => {
        fetchedRides.push({ id: doc.id, ...doc.data() });
      });

      fetchedRides.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setRides(fetchedRides);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching driver ride history:', error);
      setRides([]);
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
    } catch {
      return 'Recent';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return { label: 'Completed', bg: Colors.success + '20', text: Colors.success, icon: 'checkmark-circle' };
      case 'cancelled':
        return { label: 'Cancelled', bg: Colors.error + '20', text: Colors.error, icon: 'close-circle' };
      case 'in_progress':
        return { label: 'In Progress', bg: Colors.info + '20', text: Colors.info, icon: 'navigate-circle' };
      default:
        return { label: status, bg: Colors.gray500 + '20', text: Colors.gray500, icon: 'time' };
    }
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    headerTitle: { color: isDark ? Colors.white : Colors.gray900 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white, borderColor: isDark ? Colors.darkBorder : Colors.gray100 },
    title: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray600 },
    modalContent: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
  };

  const renderRideItem = ({ item }: { item: any }) => {
    const badge = getStatusBadge(item.status);
    return (
      <TouchableOpacity 
        style={[styles.rideCard, dynamicStyles.card]} 
        activeOpacity={0.7}
        onPress={() => setSelectedRide(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.rideTypeContainer}>
            <Ionicons name="car-sport" size={20} color={Colors.primary} />
            <Text style={[styles.rideType, dynamicStyles.title]}>{item.rideType || 'Standard Ride'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Ionicons name={badge.icon as any} size={14} color={badge.text} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.timelineDots}>
            <View style={[styles.dot, { backgroundColor: Colors.success }]} />
            <View style={styles.timelineLine} />
            <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
          </View>
          
          <View style={styles.addresses}>
            <Text style={[styles.addressText, dynamicStyles.title]} numberOfLines={1}>
              {item.pickup_address || 'Pickup Point'}
            </Text>
            <Text style={[styles.addressText, dynamicStyles.title, { marginTop: Spacing.sm }]} numberOfLines={1}>
              {item.destination_address || 'Destination'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View>
            <Text style={[styles.dateText, dynamicStyles.subText]}>{formatDate(item.timestamp)}</Text>
            <Text style={[styles.passengerText, dynamicStyles.subText]}>Passenger: {item.passenger_name || 'Passenger'}</Text>
          </View>
          <Text style={[styles.priceText, { color: isDark ? Colors.primaryLight : Colors.primary }]}>
            RM {parseFare(item.fare).toFixed(2)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 }]}>
          <Ionicons name="arrow-back" size={24} color={isDark ? Colors.white : Colors.gray900} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>Driver Ride History</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : rides.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={64} color={isDark ? Colors.gray600 : Colors.gray300} />
          <Text style={[styles.emptyTitle, dynamicStyles.title]}>No Driver Rides Yet</Text>
          <Text style={[styles.emptySub, dynamicStyles.subText]}>
            Completed and cancelled rides that you drive will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          renderItem={renderRideItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        />
      )}

      {/* Ride Details Modal */}
      <Modal
        visible={!!selectedRide}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedRide(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, dynamicStyles.modalContent]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.title]}>Driver Trip Details</Text>
              <TouchableOpacity onPress={() => setSelectedRide(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={isDark ? Colors.gray400 : Colors.gray600} />
              </TouchableOpacity>
            </View>

            {selectedRide && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Map Preview */}
                <View style={styles.mapContainer}>
                  <MapView
                    provider={PROVIDER_GOOGLE}
                    style={StyleSheet.absoluteFillObject}
                    customMapStyle={isDark ? DARK_MAP_STYLE : []}
                    initialRegion={{
                      latitude: selectedRide.pickup_coords?.latitude || DEFAULT_PICKUP.latitude,
                      longitude: selectedRide.pickup_coords?.longitude || DEFAULT_PICKUP.longitude,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                  >
                    <Marker 
                      coordinate={selectedRide.pickup_coords || DEFAULT_PICKUP} 
                      title="Pickup"
                      pinColor="green" 
                    />
                    <Marker 
                      coordinate={selectedRide.destination_coords || DEFAULT_DEST} 
                      title="Destination"
                      pinColor="red" 
                    />
                    {selectedRide.pickup_coords && selectedRide.destination_coords && (
                      <Polyline
                        coordinates={[selectedRide.pickup_coords, selectedRide.destination_coords]}
                        strokeColor={Colors.primary}
                        strokeWidth={3}
                      />
                    )}
                  </MapView>
                </View>

                {/* Details Card */}
                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, dynamicStyles.subText]}>Passenger Name</Text>
                    <Text style={[styles.detailValue, dynamicStyles.title]}>{selectedRide.passenger_name || 'Passenger'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, dynamicStyles.subText]}>Passenger Phone</Text>
                    <Text style={[styles.detailValue, dynamicStyles.title]}>{selectedRide.passenger_phone || 'N/A'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, dynamicStyles.subText]}>Date & Time</Text>
                    <Text style={[styles.detailValue, dynamicStyles.title]}>{formatDate(selectedRide.timestamp)}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, dynamicStyles.subText]}>Payment Method</Text>
                    <Text style={[styles.detailValue, dynamicStyles.title]}>
                      {selectedRide.payment_method === 'cash' ? 'Cash' : (selectedRide.payment_label || 'Online Payment')}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, dynamicStyles.subText]}>Total Fare</Text>
                    <Text style={[styles.detailValue, { color: isDark ? Colors.primaryLight : Colors.primary, fontWeight: FontWeight.bold }]}>
                      RM {parseFare(selectedRide.fare).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.addressBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs }}>
                      <Ionicons name="navigate-circle" size={18} color={Colors.success} style={{ marginRight: 8 }} />
                      <Text style={[styles.addressLabel, dynamicStyles.title]} numberOfLines={2}>
                        {selectedRide.pickup_address}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="location-sharp" size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                      <Text style={[styles.addressLabel, dynamicStyles.title]} numberOfLines={2}>
                        {selectedRide.destination_address}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.md,
  },
  rideCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  rideTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rideType: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    marginLeft: Spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  routeContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  timelineDots: {
    alignItems: 'center',
    marginRight: Spacing.sm,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.gray300,
    marginVertical: 4,
  },
  addresses: {
    flex: 1,
    justifyContent: 'space-between',
  },
  addressText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  dateText: {
    fontSize: FontSize.xs,
  },
  passengerText: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  priceText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.md,
  },
  emptySub: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.md,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  closeBtn: {
    padding: 4,
  },
  mapContainer: {
    height: 160,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  detailSection: {
    paddingVertical: Spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  detailLabel: {
    fontSize: FontSize.sm,
  },
  detailValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  addressBox: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Colors.gray100 + '40',
    borderRadius: BorderRadius.md,
  },
  addressLabel: {
    fontSize: FontSize.sm,
    flex: 1,
  },
});
