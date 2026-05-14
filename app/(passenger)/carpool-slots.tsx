import { View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useState } from 'react';

const MOCK_POOLS = [
  { id: '1', driver: 'Ahmad', rating: 4.8, destination: 'UTeM Main Campus', time: '08:30 AM', date: '15 May', seats: 2, price: 'RM 1.50' },
  { id: '2', driver: 'Siti', rating: 4.9, destination: 'UTeM Technology Campus', time: '09:00 AM', date: '15 May', seats: 1, price: 'RM 2.00' },
  { id: '3', driver: 'Kumar', rating: 4.7, destination: 'Melaka Sentral', time: '10:15 AM', date: '15 May', seats: 3, price: 'RM 3.50' },
];

export default function CarpoolSlotsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    border: { borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 }
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: isDark ? Colors.gray800 : Colors.gray100 }]}>
          <Ionicons name="arrow-back" size={24} color={isDark ? Colors.white : Colors.gray900} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.text]}>Available Pools</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={MOCK_POOLS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.poolCard, dynamicStyles.card]}>
            <View style={styles.poolHeader}>
              <View style={styles.driverInfo}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={20} color={Colors.white} />
                </View>
                <View>
                  <Text style={[styles.driverName, dynamicStyles.text]}>{item.driver}</Text>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color={Colors.accent} />
                    <Text style={styles.ratingText}>{item.rating}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.priceText}>{item.price}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.poolDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="location" size={16} color={Colors.error} />
                <Text style={[styles.detailText, dynamicStyles.text]} numberOfLines={1}>{item.destination}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="time" size={16} color={Colors.primary} />
                <Text style={[styles.detailText, dynamicStyles.text]}>{item.date} · {item.time}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="people" size={16} color={Colors.success} />
                <Text style={[styles.detailText, dynamicStyles.text]}>{item.seats} seats available</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.joinBtn}
              onPress={() => {
                alert(`Requested to join ${item.driver}'s pool!`);
                router.back();
              }}
            >
              <Text style={styles.joinText}>Join Pool</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  listContent: { padding: Spacing.md },
  poolCard: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, ...Shadows.md },
  poolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  driverInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  driverName: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: FontSize.xs, color: Colors.gray500 },
  priceText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.gray100, marginVertical: Spacing.md },
  poolDetails: { gap: Spacing.sm, marginBottom: Spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  detailText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  joinBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' },
  joinText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
