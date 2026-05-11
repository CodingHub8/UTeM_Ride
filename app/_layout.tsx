import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { useAnimatedStyle, interpolateColor } from 'react-native-reanimated';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/theme';

function MainLayout() {
  const { isDark, themeProgress } = useTheme();

  const animatedStyle = useAnimatedStyle(() => {
    return {
      flex: 1,
      backgroundColor: interpolateColor(
        themeProgress.value,
        [0, 1],
        [Colors.white, Colors.darkBg]
      ),
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(passenger)" />
        <Stack.Screen name="(driver)" />
      </Stack>
    </Animated.View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}
