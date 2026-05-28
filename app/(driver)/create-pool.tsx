import { View, Text, TouchableOpacity, StyleSheet, TextInput, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useState } from 'react';

export default function CreatePoolScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('Select date');
  const [time, setTime] = useState('Select time');
  const [seats, setSeats] = useState(3);
  const [genderMatching, setGenderMatching] = useState(false);

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    input: { 
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      color: isDark ? Colors.white : Colors.gray900,
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
        <Text style={[styles.headerTitle, dynamicStyles.text]}>Create Pool Slot</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Route Information</Text>
        <View style={[styles.card, dynamicStyles.card]}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Destination</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder="Where are you heading?"
              placeholderTextColor={Colors.gray500}
              value={destination}
              onChangeText={setDestination}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Schedule</Text>
        <View style={[styles.card, dynamicStyles.card]}>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.md }]}>
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity style={[styles.input, dynamicStyles.input, styles.picker]}>
                <Text style={dynamicStyles.text}>{date}</Text>
                <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Time</Text>
              <TouchableOpacity style={[styles.input, dynamicStyles.input, styles.picker]}>
                <Text style={dynamicStyles.text}>{time}</Text>
                <Ionicons name="time-outline" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={[styles.card, dynamicStyles.card]}>
          <View style={styles.rowItem}>
            <View>
              <Text style={[styles.rowLabel, dynamicStyles.text]}>Available Seats</Text>
              <Text style={[styles.rowSub, dynamicStyles.subText]}>How many passengers can join?</Text>
            </View>
            <View style={styles.counter}>
              <TouchableOpacity onPress={() => setSeats(Math.max(1, seats - 1))} style={styles.counterBtn}>
                <Ionicons name="remove" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.counterVal, dynamicStyles.text]}>{seats}</Text>
              <TouchableOpacity onPress={() => setSeats(Math.min(6, seats + 1))} style={styles.counterBtn}>
                <Ionicons name="add" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.divider} />

          <View style={styles.rowItem}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, dynamicStyles.text]}>Gender Matching</Text>
              <Text style={[styles.rowSub, dynamicStyles.subText]}>Only allow passengers of your gender</Text>
            </View>
            <Switch
              value={genderMatching}
              onValueChange={setGenderMatching}
              trackColor={{ false: Colors.gray300, true: Colors.primary }}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={styles.submitBtn}
          onPress={() => {
            alert('Pool slot created successfully!');
            router.back();
          }}
        >
          <Text style={styles.submitText}>Publish Pool Slot</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.lg, marginBottom: Spacing.sm, marginLeft: 4 },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.sm },
  inputGroup: { marginBottom: Spacing.sm },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.gray500, marginBottom: 8, textTransform: 'uppercase' },
  input: { height: 50, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: FontSize.md, justifyContent: 'center' },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row' },
  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  rowLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  rowSub: { fontSize: FontSize.xs, marginTop: 2 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  counterBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  counterVal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, minWidth: 20, textAlign: 'center' },
  divider: { height: 1, backgroundColor: Colors.gray100, marginVertical: Spacing.md },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.xl, ...Shadows.md },
  submitText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
});
