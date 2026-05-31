import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { queryClient } from './src/lib/queryClient';
import { navigationRef } from './src/lib/navigationRef';
import { AuthProvider } from './src/context/AuthContext';
import { ActiveStoreProvider } from './src/context/ActiveStoreContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';

SplashScreen.preventAutoHideAsync();

const navTheme = {
  dark: false,
  colors: {
    primary: colors.accent,
    background: colors.paper,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.borderLight,
    notification: colors.accent,
  },
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ActiveStoreProvider>
              <NavigationContainer ref={navigationRef} theme={navTheme}>
                <RootNavigator />
              </NavigationContainer>
            </ActiveStoreProvider>
          </AuthProvider>
        </QueryClientProvider>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
