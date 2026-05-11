import { Colors } from '@/constants/theme';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  colors: typeof Colors;
  themeProgress: any;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const themeProgress = useSharedValue(0);

  useEffect(() => {
    themeProgress.value = withTiming(theme === 'dark' ? 1 : 0, { duration: 400 });
  }, [theme]);

  const toggleTheme = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (mode: ThemeMode) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setThemeState(mode);
  };

  // Theme-aware colors
  const themeColors = {
    ...Colors,
    background: theme === 'dark' ? Colors.darkBg : Colors.white,
    card: theme === 'dark' ? Colors.darkCard : Colors.white,
    text: theme === 'dark' ? Colors.white : Colors.gray900,
    textSecondary: theme === 'dark' ? Colors.gray400 : Colors.gray500,
    border: theme === 'dark' ? Colors.darkBorder : Colors.gray200,
    surface: theme === 'dark' ? Colors.gray900 : Colors.gray50,
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      isDark: theme === 'dark',
      toggleTheme,
      setTheme,
      colors: themeColors as any,
      themeProgress
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
