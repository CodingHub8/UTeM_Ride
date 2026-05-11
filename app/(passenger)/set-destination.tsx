import { BorderRadius, Colors, FontSize, FontWeight, Spacing, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const RIDE_TYPES = [
  { id: 'economy', name: 'Economy', icon: '🚗', price: 'RM 5.50', eta: '3 min', seats: 4 },
  { id: 'comfort', name: 'Comfort', icon: '🚙', price: 'RM 8.00', eta: '5 min', seats: 4 },
  { id: 'premium', name: 'Premium', icon: '✨', price: 'RM 12.00', eta: '8 min', seats: 6 },
];

const PLACES = [
  { id: '1', name: 'UTeM Main Campus', address: 'Jalan Hang Tuah Jaya, 76100' },
  { id: '2', name: 'UTeM City Campus', address: 'Jalan Hang Tuah, 75300' },
  { id: '3', name: 'Melaka Sentral', address: 'Jalan Tun Razak, 75400' },
  { id: '4', name: 'Dataran Pahlawan', address: 'Jalan Merdeka, 75000' },
];

export default function SetDestinationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const { initialDestination } = useLocalSearchParams<{ initialDestination?: string }>();

  const [query, setQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [selectedRide, setSelectedRide] = useState('economy');

  useEffect(() => {
    if (initialDestination) {
      setQuery(initialDestination);
      setSelectedPlace(initialDestination);
    }
  }, [initialDestination]);

  const filtered = query.length > 0
    ? PLACES.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : PLACES;

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.white },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    border: { borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 },
    inputContainer: { 
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200 
    }
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 }]}>
          <Ionicons name="arrow-back" size={24} color={isDark ? Colors.white : Colors.gray900} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.text]}>Set Destination</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Location inputs */}
      <View style={[styles.locationCard, dynamicStyles.inputContainer]}>
        <View style={styles.locationRow}>
          <View style={[styles.dot, { backgroundColor: Colors.success }]} />
          <View style={styles.locInput}>
            <Text style={styles.locLabel}>Pickup</Text>
            <Text style={[styles.locValue, dynamicStyles.text]}>Current Location</Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: isDark ? Colors.darkBorder : Colors.gray200 }]} />
        <View style={styles.locationRow}>
          <View style={[styles.dot, { backgroundColor: Colors.error }]} />
          <View style={styles.locInput}>
            <Text style={styles.locLabel}>Destination</Text>
            <TextInput
              style={[styles.searchInput, dynamicStyles.text]}
              placeholder="Search destination..."
              placeholderTextColor={isDark ? Colors.gray600 : Colors.gray400}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (selectedPlace) setSelectedPlace(null);
              }}
              onFocus={() => {
                if (selectedPlace) setSelectedPlace(null);
              }}
              autoFocus
            />
          </View>
        </View>
      </View>

      {!selectedPlace ? (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          style={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.resultRow, dynamicStyles.border]}
              onPress={() => { setSelectedPlace(item.name); setQuery(item.name); }}
            >
              <View style={[styles.resultIcon, { backgroundColor: isDark ? Colors.primary + '30' : Colors.primary + '12' }]}>
                <Ionicons name="location" size={20} color={isDark ? Colors.primaryLight : Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.resultName, dynamicStyles.text]}>{item.name}</Text>
                <Text style={[styles.resultAddr, dynamicStyles.subText]}>{item.address}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.rideSection}>
          <Text style={[styles.sectionTitle, dynamicStyles.text]}>Choose your ride</Text>
          {RIDE_TYPES.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[
                styles.rideCard, 
                { backgroundColor: isDark ? Colors.darkCard : Colors.white, borderColor: isDark ? Colors.darkBorder : Colors.gray200 },
                selectedRide === r.id && { borderColor: Colors.primary, backgroundColor: isDark ? Colors.primary + '20' : Colors.primary + '08' }
              ]}
              onPress={() => setSelectedRide(r.id)}
            >
              <Text style={{ fontSize: 28, marginRight: 12 }}>{r.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rideName, dynamicStyles.text]}>{r.name}</Text>
                <Text style={[styles.rideEta, dynamicStyles.subText]}>{r.eta} · {r.seats} seats</Text>
              </View>
              <Text style={[styles.ridePrice, { color: isDark ? Colors.white : Colors.gray700 }, selectedRide === r.id && { color: isDark ? Colors.primaryLight : Colors.primary }]}>{r.price}</Text>
            </TouchableOpacity>
          ))}
          <View style={[styles.fareCard, { backgroundColor: isDark ? Colors.gray900 : Colors.gray50 }]}>
            <View style={styles.fareRow}><Text style={[styles.fareLabel, dynamicStyles.subText]}>Estimated fare</Text><Text style={[styles.fareVal, { color: isDark ? Colors.primaryLight : Colors.primary }]}>{RIDE_TYPES.find((r) => r.id === selectedRide)?.price}</Text></View>
            <View style={styles.fareRow}><Text style={[styles.fareLabel, dynamicStyles.subText]}>Distance</Text><Text style={[styles.fareDetail, { color: isDark ? Colors.gray300 : Colors.gray700 }]}>8.2 km</Text></View>
            <View style={styles.fareRow}><Text style={[styles.fareLabel, dynamicStyles.subText]}>Duration</Text><Text style={[styles.fareDetail, { color: isDark ? Colors.gray300 : Colors.gray700 }]}>~15 min</Text></View>
          </View>
          <TouchableOpacity 
            style={styles.confirmBtn} 
            onPress={() => {
              const ride = RIDE_TYPES.find(r => r.id === selectedRide);
              const place = PLACES.find(p => p.name === selectedPlace);
              router.push({
                pathname: '/(passenger)/ride-request',
                params: { 
                  destination: selectedPlace,
                  address: place?.address || selectedPlace,
                  rideType: ride?.name,
                  price: ride?.price
                }
              });
            }}
          >
            <Text style={styles.confirmText}>Confirm Destination</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.gray100, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gray900 },
  locationCard: { marginHorizontal: Spacing.md, backgroundColor: Colors.gray50, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.gray200 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: Spacing.md },
  locInput: { flex: 1 },
  locLabel: { fontSize: FontSize.xs, color: Colors.gray400, fontWeight: FontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  locValue: { fontSize: FontSize.md, color: Colors.gray900, fontWeight: FontWeight.semibold, marginTop: 2 },
  searchInput: { fontSize: FontSize.md, color: Colors.gray900, paddingVertical: 4 },
  divider: { height: 1, backgroundColor: Colors.gray200, marginVertical: Spacing.sm, marginLeft: 28 },
  list: { flex: 1, paddingHorizontal: Spacing.md, marginTop: Spacing.sm },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  resultIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  resultName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.gray900 },
  resultAddr: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2 },
  rideSection: { flex: 1, padding: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gray900, marginBottom: Spacing.md },
  rideCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 2, borderColor: Colors.gray200, marginBottom: Spacing.sm },
  rideSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
  rideName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray900 },
  rideEta: { fontSize: FontSize.sm, color: Colors.gray500, marginTop: 2 },
  ridePrice: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gray700 },
  fareCard: { backgroundColor: Colors.gray50, borderRadius: BorderRadius.md, padding: Spacing.md, marginVertical: Spacing.sm },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  fareLabel: { fontSize: FontSize.sm, color: Colors.gray500 },
  fareVal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  fareDetail: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray700 },
  confirmBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 16, alignItems: 'center' },
  confirmText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
});
