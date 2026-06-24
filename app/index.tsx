import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, role } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Trigger sandbox database seeding asynchronously
    import('@/utils/seedData')
      .then(({ seedDatabaseIfEmpty }) => {
        seedDatabaseIfEmpty();
      })
      .catch((err) => {
        console.warn('[SplashScreen] Failed to run database seeding:', err);
      });
  }, []);

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(subtitleFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    });

    // Navigate after a delay
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.replace(role === 'driver' ? '/(driver)/home' : '/(passenger)/home');
      } else {
        router.replace('/(auth)/login');
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, role]);

  return (
    <LinearGradient
      colors={[Colors.primary, Colors.primaryDark, '#001A3D']}
      style={styles.container}
    >
      <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>🚗</Text>
        </View>
        <Text style={styles.title}>UTeM Ride</Text>
      </Animated.View>

      <Animated.View style={[styles.subtitleContainer, { opacity: subtitleFade }]}>
        <Text style={styles.subtitle}>Your campus ride, simplified</Text>
      </Animated.View>

      <View style={styles.loadingContainer}>
        <View style={styles.loadingBar}>
          <Animated.View style={[styles.loadingFill, { opacity: fadeAnim }]} />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 48,
  },
  title: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    color: Colors.white,
    letterSpacing: 1,
  },
  subtitleContainer: {
    marginTop: 12,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: FontWeight.medium,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 80,
    width: '60%',
  },
  loadingBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingFill: {
    height: '100%',
    width: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
});
