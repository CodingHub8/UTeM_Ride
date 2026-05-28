import { BorderRadius, Colors, FontSize, FontWeight, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { encryptData } from '@/utils/encryption';
import { saveRecentDestination } from '@/utils/location';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Default fallback coordinates
const DEFAULT_PICKUP = { latitude: 2.3135, longitude: 102.3211 };
const DEFAULT_DEST = { latitude: 2.3086, longitude: 102.3197 };

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

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'fpx' | 'duitnow_qr' | 'card'>('cash');
  const [paymentLabel, setPaymentLabel] = useState('Cash');

  // FPX states
  const [selectedBank, setSelectedBank] = useState('');

  // Card states
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Encrypted transaction metadata
  const [encryptedPaymentDetails, setEncryptedPaymentDetails] = useState('');

  // Modal subviews: 'options', 'fpx', 'duitnow_qr', 'card'
  const [paymentStep, setPaymentStep] = useState<'options' | 'fpx' | 'duitnow_qr' | 'card'>('options');

  const selectMethod = (method: 'cash' | 'fpx' | 'duitnow_qr' | 'card') => {
    if (method === 'cash') {
      setPaymentMethod('cash');
      setPaymentLabel('Cash');
      setEncryptedPaymentDetails('');
      setShowPaymentModal(false);
    } else {
      setPaymentStep(method);
    }
  };

  const confirmFPX = (bank: string) => {
    setSelectedBank(bank);
    setPaymentMethod('fpx');
    setPaymentLabel(`FPX (${bank})`);

    // Encrypt the payment token/bank metadata client-side
    const encrypted = encryptData(JSON.stringify({ bank, timestamp: Date.now() }));
    setEncryptedPaymentDetails(encrypted);

    setShowPaymentModal(false);
  };

  const confirmDuitNowQR = () => {
    setPaymentMethod('duitnow_qr');
    setPaymentLabel('DuitNow QR');

    const encrypted = encryptData(JSON.stringify({ type: 'duitnow_qr', scanTime: Date.now() }));
    setEncryptedPaymentDetails(encrypted);

    setShowPaymentModal(false);
  };

  const confirmCard = () => {
    if (!cardNumber || !cardExpiry || !cardCvv || !cardName) {
      Alert.alert('Incomplete Details', 'Please fill in all card details.');
      return;
    }

    // Client-side encryption of credit card details to secure the transaction
    const cardData = {
      cardNumber: cardNumber.replace(/\s+/g, ''),
      cardName,
      cardExpiry,
      cardCvv,
      timestamp: Date.now()
    };

    const encrypted = encryptData(JSON.stringify(cardData));
    setEncryptedPaymentDetails(encrypted);

    setPaymentMethod('card');
    setPaymentLabel(`Card (*${cardNumber.slice(-4)})`);
    setShowPaymentModal(false);
  };
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
    : DEFAULT_PICKUP;

  const destCoord = polyline
    ? JSON.parse(polyline)[JSON.parse(polyline).length - 1]
    : DEFAULT_DEST;

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
    input: {
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      color: isDark ? Colors.white : Colors.gray900,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    },
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
        <TouchableOpacity
          style={styles.paymentRow}
          onPress={() => { setPaymentStep('options'); setShowPaymentModal(true); }}
        >
          <Ionicons name="wallet" size={22} color={Colors.primary} />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={styles.paymentLabel}>Payment Method</Text>
            <Text style={[styles.paymentValue, dynamicStyles.text]}>{paymentLabel}</Text>
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
                  polyline,
                  paymentMethod,
                  paymentLabel,
                  encryptedDetails: encryptedPaymentDetails || undefined
                }
              });
            }}
          >
            <Text style={styles.requestText}>Request Ride</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Payment Selection Modal */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? Colors.darkCard : Colors.white }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>
                {paymentStep === 'options' && 'Select Payment Option'}
                {paymentStep === 'fpx' && 'Select Your Bank'}
                {paymentStep === 'duitnow_qr' && 'DuitNow QR Payment'}
                {paymentStep === 'card' && 'Enter Card Details'}
              </Text>
              <TouchableOpacity onPress={() => {
                if (paymentStep === 'options') setShowPaymentModal(false);
                else setPaymentStep('options');
              }}>
                <Ionicons
                  name={paymentStep === 'options' ? 'close' : 'arrow-back'}
                  size={24}
                  color={isDark ? Colors.white : Colors.gray900}
                />
              </TouchableOpacity>
            </View>

            {/* Step: Main Payment Options */}
            {paymentStep === 'options' && (
              <View>
                <TouchableOpacity style={[styles.methodItem, paymentMethod === 'cash' && { borderColor: Colors.primary }]} onPress={() => selectMethod('cash')}>
                  <Ionicons name="cash-outline" size={24} color={Colors.primary} />
                  <Text style={[styles.methodItemText, dynamicStyles.text]}>Cash</Text>
                  {paymentMethod === 'cash' && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                </TouchableOpacity>

                <TouchableOpacity style={[styles.methodItem, paymentMethod === 'fpx' && { borderColor: Colors.primary }]} onPress={() => selectMethod('fpx')}>
                  <Ionicons name="business-outline" size={24} color={Colors.accent} />
                  <Text style={[styles.methodItemText, dynamicStyles.text]}>FPX Online Banking</Text>
                  {paymentMethod === 'fpx' && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                </TouchableOpacity>

                <TouchableOpacity style={[styles.methodItem, paymentMethod === 'duitnow_qr' && { borderColor: Colors.primary }]} onPress={() => selectMethod('duitnow_qr')}>
                  <Ionicons name="qr-code-outline" size={24} color={Colors.success} />
                  <Text style={[styles.methodItemText, dynamicStyles.text]}>DuitNow QR</Text>
                  {paymentMethod === 'duitnow_qr' && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                </TouchableOpacity>

                <TouchableOpacity style={[styles.methodItem, paymentMethod === 'card' && { borderColor: Colors.primary }]} onPress={() => selectMethod('card')}>
                  <Ionicons name="card-outline" size={24} color={Colors.primary} />
                  <Text style={[styles.methodItemText, dynamicStyles.text]}>Credit / Debit Card</Text>
                  {paymentMethod === 'card' && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                </TouchableOpacity>
              </View>
            )}

            {/* Step: FPX Selection */}
            {paymentStep === 'fpx' && (
              <ScrollView style={{ maxHeight: 250 }}>
                {['Maybank2u', 'CIMB Clicks', 'Bank Islam', 'RHB Now', 'Public Bank'].map((bank) => (
                  <TouchableOpacity
                    key={bank}
                    style={[styles.bankItem, { borderColor: isDark ? Colors.darkBorder : Colors.gray200 }]}
                    onPress={() => confirmFPX(bank)}
                  >
                    <Text style={[styles.bankItemText, dynamicStyles.text]}>{bank}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Step: DuitNow QR */}
            {paymentStep === 'duitnow_qr' && (
              <View style={styles.qrContainer}>
                <View style={styles.qrMock}>
                  <Ionicons name="qr-code" size={100} color={Colors.primary} />
                </View>
                <Text style={[styles.qrLabel, dynamicStyles.text]}>Scan UTeM Ride DuitNow QR merchant code to pay</Text>
                <TouchableOpacity style={styles.qrBtn} onPress={confirmDuitNowQR}>
                  <Text style={styles.qrBtnText}>I Have Scanned & Paid</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step: Card Details Entry */}
            {paymentStep === 'card' && (
              <View style={styles.cardForm}>
                <View style={styles.cardInputGroup}>
                  <Text style={styles.cardLabel}>Cardholder Name</Text>
                  <TextInput
                    style={[styles.cardInput, dynamicStyles.input]}
                    value={cardName}
                    onChangeText={setCardName}
                    placeholder="E.g., Muhammad Hazim"
                    placeholderTextColor={Colors.gray400}
                  />
                </View>
                <View style={styles.cardInputGroup}>
                  <Text style={styles.cardLabel}>Card Number</Text>
                  <TextInput
                    style={[styles.cardInput, dynamicStyles.input]}
                    value={cardNumber}
                    onChangeText={setCardNumber}
                    keyboardType="numeric"
                    placeholder="E.g., 4000 1234 5678 9010"
                    placeholderTextColor={Colors.gray400}
                    maxLength={19}
                  />
                </View>
                <View style={styles.cardRow}>
                  <View style={[styles.cardInputGroup, { flex: 1 }]}>
                    <Text style={styles.cardLabel}>Expiry (MM/YY)</Text>
                    <TextInput
                      style={[styles.cardInput, dynamicStyles.input]}
                      value={cardExpiry}
                      onChangeText={setCardExpiry}
                      placeholder="MM/YY"
                      placeholderTextColor={Colors.gray400}
                      maxLength={5}
                    />
                  </View>
                  <View style={[styles.cardInputGroup, { flex: 1 }]}>
                    <Text style={styles.cardLabel}>CVV</Text>
                    <TextInput
                      style={[styles.cardInput, dynamicStyles.input]}
                      value={cardCvv}
                      onChangeText={setCardCvv}
                      keyboardType="numeric"
                      placeholder="E.g., 123"
                      placeholderTextColor={Colors.gray400}
                      maxLength={3}
                      secureTextEntry
                    />
                  </View>
                </View>

                {/* Secure Card notice */}
                <View style={styles.secureAlert}>
                  <Ionicons name="lock-closed" size={14} color={Colors.success} />
                  <Text style={{ fontSize: 10, color: Colors.success, fontWeight: '600' }}>
                    Secured: Card details are client-side encrypted before transmission.
                  </Text>
                </View>

                <TouchableOpacity style={styles.cardSaveBtn} onPress={confirmCard}>
                  <Text style={styles.cardSaveText}>Save Secure Card</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  methodItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.gray200, marginBottom: Spacing.sm },
  methodItemText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginLeft: Spacing.md, flex: 1 },
  bankItem: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.gray200, marginBottom: Spacing.sm, alignItems: 'center' },
  bankItemText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  qrContainer: { alignItems: 'center', padding: Spacing.lg },
  qrMock: { width: 160, height: 160, borderRadius: BorderRadius.md, backgroundColor: Colors.white, borderWidth: 4, borderColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md, ...Shadows.sm },
  qrLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, textAlign: 'center', marginBottom: Spacing.md },
  qrBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 12, paddingHorizontal: Spacing.xl, ...Shadows.sm },
  qrBtnText: { color: Colors.white, fontWeight: FontWeight.bold },
  cardForm: { gap: Spacing.md },
  cardInputGroup: { gap: 6 },
  cardLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray500 },
  cardInput: { height: 48, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.gray200, paddingHorizontal: Spacing.md, fontSize: FontSize.md },
  cardRow: { flexDirection: 'row', gap: Spacing.md },
  cardSaveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.md, ...Shadows.sm },
  cardSaveText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  secureAlert: { flexDirection: 'row', padding: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: Colors.success + '10', borderWidth: 1, borderColor: Colors.success + '30', alignItems: 'center', gap: 6, marginTop: Spacing.xs }
});
