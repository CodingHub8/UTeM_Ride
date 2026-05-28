import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

const RIDES: {
  id: string;
  date: string;
  from: string;
  to: string;
  price: string;
  driver: string;
  status: 'completed' | 'cancelled';
}[] = [];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    border: { borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 },
    divider: { backgroundColor: isDark ? Colors.darkBorder : Colors.gray100 },
  };

  return (
    <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, dynamicStyles.text]}>Ride History</Text>
        <Text style={styles.headerSub}>{RIDES.length} rides</Text>
      </View>

      <FlatList
        data={RIDES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, dynamicStyles.card]}>
            <View style={styles.cardTop}>
              <Text style={[styles.date, dynamicStyles.subText]}>{item.date}</Text>
              <View style={[styles.statusBadge, item.status === 'cancelled' && styles.statusCancelled]}>
                <Text style={[styles.statusText, item.status === 'cancelled' && styles.statusTextCancelled]}>
                  {item.status === 'completed' ? 'Completed' : 'Cancelled'}
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
                <Text style={[styles.routeText, dynamicStyles.text]}>{item.from}</Text>
                <Text style={[styles.routeText, dynamicStyles.text, { marginTop: 14 }]}>{item.to}</Text>
              </View>
            </View>

            <View style={[styles.cardBottom, { borderTopColor: isDark ? Colors.darkBorder : Colors.gray100 }]}>
              <View style={styles.driverChip}>
                <Ionicons name="person-circle" size={20} color={isDark ? Colors.gray500 : Colors.gray400} />
                <Text style={[styles.driverName, dynamicStyles.subText]}>{item.driver}</Text>
              </View>
              <Text style={[styles.price, { color: isDark ? Colors.primaryLight : Colors.primary }]}>{item.price}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  headerSub: { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 4 },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadows.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  date: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  statusBadge: { backgroundColor: Colors.success + '15', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statusCancelled: { backgroundColor: Colors.error + '15' },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.success },
  statusTextCancelled: { color: Colors.error },
  routeRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  routeMarkers: { alignItems: 'center', marginRight: Spacing.md, paddingTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotLine: { width: 2, height: 14, marginVertical: 2 },
  routeText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: Spacing.sm },
  driverChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  driverName: { fontSize: FontSize.sm },
  price: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
});
