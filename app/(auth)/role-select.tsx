import { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function RoleSelectScreen() {
  const router = useRouter();
  const { setRole } = useAuth();
  const { isDark } = useTheme();

  const handleSelect = (role: 'passenger' | 'driver') => {
    setRole(role);
    router.replace(role === 'driver' ? '/(driver)/home' : '/(passenger)/home');
  };

  return (
    <LinearGradient colors={[Colors.primary, Colors.primaryDark, '#001A3D']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>How would you{'\n'}like to use UTeM Ride?</Text>
        <Text style={styles.subtitle}>You can switch roles anytime from your profile</Text>
      </View>

      <View style={styles.cardsContainer}>
        <RoleCard
          icon="person"
          emoji="🧑‍🎓"
          title="I want to ride"
          description="Find affordable rides around campus and beyond"
          color={Colors.primaryLight}
          onPress={() => handleSelect('passenger')}
          isDark={isDark}
        />
        <RoleCard
          icon="car-sport"
          emoji="🚗"
          title="I want to drive"
          description="Earn money by giving rides to fellow students"
          color={Colors.accent}
          onPress={() => handleSelect('driver')}
          isDark={isDark}
        />
      </View>
    </LinearGradient>
  );
}

function RoleCard({
  emoji,
  title,
  description,
  color,
  onPress,
  isDark,
}: {
  icon: string;
  emoji: string;
  title: string;
  description: string;
  color: string;
  onPress: () => void;
  isDark: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const dynamicStyles = {
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    title: { color: isDark ? Colors.white : Colors.gray900 },
    desc: { color: isDark ? Colors.gray400 : Colors.gray500 },
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.card, dynamicStyles.card]}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
        activeOpacity={0.95}
      >
        <View style={[styles.cardIconBg, { backgroundColor: color + '20' }]}>
          <Text style={styles.cardEmoji}>{emoji}</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, dynamicStyles.title]}>{title}</Text>
          <Text style={[styles.cardDesc, dynamicStyles.desc]}>{description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={color} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xxl,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.white,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    marginTop: Spacing.sm,
  },
  cardsContainer: {
    gap: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  cardIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  cardEmoji: { fontSize: 28 },
  cardContent: { flex: 1 },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  cardDesc: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
});
