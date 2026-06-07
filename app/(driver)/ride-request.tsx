import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function DriverRideRequestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { isDark } = useTheme();

  const handleAccept = () => {
    if (user && !user.is_2FA_verified) {
      Alert.alert(
        '2FA Required',
        'Please complete your 2FA verification first to accept ride requests.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.push({
      pathname: '/(driver)/active-pickup',
      params: {
        rideId: 'mock_ride_id_' + Math.random().toString(36).substring(2, 7),
        price: '12.50',
        pickup: 'FTMK, UTeM Main Campus',
        destination: 'Melaka Sentral Bus Terminal',
        passengerName: 'Muhammad Haziq',
        passengerUsername: 'haziq_utem',
        passengerEmail: 'b032110123@student.utem.edu.my',
        passengerPhone: '+6011-2345 6789',
        passengerGender: 'Male'
      }
    });
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    headerTitle: { color: isDark ? Colors.white : Colors.gray900 },
    backBtn: { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 },
    requestCard: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    passengerName: { color: isDark ? Colors.white : Colors.gray900 },
    ratingText: { color: isDark ? Colors.gray300 : Colors.gray600 },
    routeCard: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    routeValue: { color: isDark ? Colors.white : Colors.gray900 },
    detailValue: { color: isDark ? Colors.white : Colors.gray900 },
    detailDivider: { backgroundColor: isDark ? Colors.darkBorder : Colors.gray200 },
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, dynamicStyles.backBtn]}>
          <Ionicons name="arrow-back" size={24} color={isDark ? Colors.white : Colors.gray900} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>Incoming Request</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Request card */}
      <View style={[styles.requestCard, dynamicStyles.requestCard]}>
        {/* Passenger info */}
        <View style={styles.passengerRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.passengerName, dynamicStyles.passengerName]}>Passenger</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={Colors.primary} />
              <Text style={[styles.ratingText, dynamicStyles.ratingText]}>--</Text>
            </View>
          </View>
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>RM --</Text>
          </View>
        </View>

        {/* Route */}
        <View style={[styles.routeCard, dynamicStyles.routeCard]}>
          <View style={styles.routeRow}>
            <View style={styles.routeMarkers}>
              <View style={[styles.dot, { backgroundColor: Colors.success }]} />
              <View style={styles.dotLine} />
              <View style={[styles.dot, { backgroundColor: Colors.error }]} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={styles.routeLabel}>Pickup</Text>
                <Text style={[styles.routeValue, dynamicStyles.routeValue]}>--</Text>
              </View>
              <View>
                <Text style={styles.routeLabel}>Destination</Text>
                <Text style={[styles.routeValue, dynamicStyles.routeValue]}>--</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Details */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="navigate" size={18} color={Colors.primary} />
            <Text style={[styles.detailValue, dynamicStyles.detailValue]}>--</Text>
            <Text style={styles.detailLabel}>To pickup</Text>
          </View>
          <View style={[styles.detailDivider, dynamicStyles.detailDivider]} />
          <View style={styles.detailItem}>
            <Ionicons name="car" size={18} color={Colors.primary} />
            <Text style={[styles.detailValue, dynamicStyles.detailValue]}>--</Text>
            <Text style={styles.detailLabel}>Trip distance</Text>
          </View>
          <View style={[styles.detailDivider, dynamicStyles.detailDivider]} />
          <View style={styles.detailItem}>
            <Ionicons name="time" size={18} color={Colors.primary} />
            <Text style={[styles.detailValue, dynamicStyles.detailValue]}>--</Text>
            <Text style={styles.detailLabel}>Est. time</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.declineBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={Colors.error} />
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
            <Ionicons name="checkmark" size={24} color={Colors.white} />
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  requestCard: { flex: 1, margin: Spacing.md, borderRadius: BorderRadius.xl, padding: Spacing.lg, justifyContent: 'center', ...Shadows.md },
  passengerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  passengerName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  priceBadge: { backgroundColor: Colors.primary + '20', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  priceText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },
  routeCard: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.lg },
  routeRow: { flexDirection: 'row' },
  routeMarkers: { alignItems: 'center', marginRight: Spacing.md, paddingTop: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotLine: { width: 2, height: 24, backgroundColor: Colors.gray600, marginVertical: 4 },
  routeLabel: { fontSize: FontSize.xs, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5 },
  routeValue: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginTop: 2 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.xl },
  detailItem: { alignItems: 'center', gap: 4 },
  detailValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  detailLabel: { fontSize: FontSize.xs, color: Colors.gray400 },
  detailDivider: { width: 1 },
  actionRow: { flexDirection: 'row', gap: Spacing.md },
  declineBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.error + '15', borderRadius: BorderRadius.lg, paddingVertical: 16, borderWidth: 1, borderColor: Colors.error + '30' },
  declineText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.error },
  acceptBtn: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.success, borderRadius: BorderRadius.lg, paddingVertical: 16 },
  acceptText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.white },
});
