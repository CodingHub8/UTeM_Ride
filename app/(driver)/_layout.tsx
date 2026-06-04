import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

export default function DriverLayout() {
  const { isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? Colors.primaryLight : Colors.primary,
        tabBarInactiveTintColor: isDark ? Colors.gray600 : Colors.gray400,
        tabBarStyle: {
          backgroundColor: isDark ? Colors.darkCard : Colors.white,
          borderTopColor: isDark ? Colors.darkBorder : Colors.gray200,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="car-sport" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create-pool"
        options={{
          title: 'Create Pool',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
      {/* Hide non-tab screens */}
      <Tabs.Screen name="ride-request" options={{ href: null }} />
      <Tabs.Screen name="active-pickup" options={{ href: null }} />
      <Tabs.Screen name="trip-in-progress" options={{ href: null }} />
    </Tabs>
  );
}
