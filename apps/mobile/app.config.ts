import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'manamap',
  slug: 'manamap',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'manamap',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.manamap.app',
    supportsTablet: false,
    usesAppleSignIn: true,
  },
  android: {
    package: 'com.manamap.app',
    adaptiveIcon: { backgroundColor: '#F7F3EE' },
  },
  plugins: [
    'expo-dev-client',
    'expo-secure-store',
    'expo-apple-authentication',
    ['expo-build-properties', { ios: { newArchEnabled: false }, android: { newArchEnabled: false } }],
    [
      'expo-camera',
      { cameraPermission: '$(PRODUCT_NAME) needs camera access to scan player QR codes.' },
    ],
  ],
  extra: {
    eas: { projectId: '3497a3d5-7a81-4da9-89a3-5108ce4a69ee' },
  },
};

export default config;
