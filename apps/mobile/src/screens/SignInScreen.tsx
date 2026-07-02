import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { colors, typography, spacing, radii, shadows } from '../theme';
import type { AuthTokens } from '@manamap/shared';
import type { RootStackParamList } from '../navigation/types';

WebBrowser.maybeCompleteAuthSession();

const DISCORD_CLIENT_ID = process.env['EXPO_PUBLIC_DISCORD_CLIENT_ID'] ?? '';
const GOOGLE_WEB_CLIENT_ID = process.env['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'] ?? '';
const GOOGLE_IOS_CLIENT_ID = process.env['EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'] ?? '';

if (GOOGLE_WEB_CLIENT_ID) {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    offlineAccess: false,
  });
}

const googleEnabled = !!GOOGLE_WEB_CLIENT_ID;

const discordDiscovery = {
  authorizationEndpoint: 'https://discord.com/api/oauth2/authorize',
  tokenEndpoint: 'https://discord.com/api/oauth2/token',
};

type LoadingState = 'apple' | 'discord' | 'google' | null;

function GoogleSignInButton({
  loading,
  onStart,
  onIdToken,
  onError,
  onDismiss,
}: {
  loading: LoadingState;
  onStart: () => void;
  onIdToken: (idToken: string) => void;
  onError: (msg: string) => void;
  onDismiss: () => void;
}) {
  async function handlePress() {
    onStart();
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        const idToken = response.data.idToken;
        if (!idToken) throw new Error('no idToken returned');
        onIdToken(idToken);
      } else {
        onDismiss();
      }
    } catch (err) {
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
        onDismiss();
      } else {
        onError('Google sign in failed. Please try again.');
        console.error('Google sign in error:', err);
      }
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.googleBtn,
        !!loading && styles.btnDisabled,
        pressed && styles.btnPressed,
      ]}
      onPress={handlePress}
      disabled={!!loading}
    >
      {loading === 'google' ? (
        <ActivityIndicator color={colors.textPrimary} />
      ) : (
        <Text style={styles.googleBtnText}>Continue with Google</Text>
      )}
    </Pressable>
  );
}

export function SignInScreen() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState<LoadingState>(null);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'manamap', path: 'auth/discord' });

  const [request, response, promptDiscord] = AuthSession.useAuthRequest(
    {
      clientId: DISCORD_CLIENT_ID,
      scopes: ['identify', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
    },
    discordDiscovery,
  );

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      handleDiscordCode(response.params['code'] ?? '', request?.codeVerifier);
    } else {
      setLoading(null);
      if (response.type === 'error') {
        Alert.alert('Discord sign in failed', response.error?.message ?? 'Unknown error');
      }
    }
  }, [response]);

  async function handleGoogleIdToken(idToken: string) {
    try {
      const { data } = await api.post<AuthTokens>('/v1/auth/google', { idToken });
      await signIn(data);
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: unknown } }).response?.data;
      Alert.alert('Sign in failed', JSON.stringify(msg ?? err));
    } finally {
      setLoading(null);
    }
  }

  async function handleDiscordCode(code: string, codeVerifier?: string) {
    if (!code) return;
    setLoading('discord');
    try {
      const { data } = await api.post<AuthTokens>('/v1/auth/discord', {
        code,
        codeVerifier,
        redirectUri,
      });
      await signIn(data);
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: unknown } }).response?.data;
      Alert.alert('Sign in failed', JSON.stringify(msg ?? err));
    } finally {
      setLoading(null);
    }
  }

  async function handleAppleSignIn() {
    setLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('no identity token');
      const { data } = await api.post<AuthTokens>('/v1/auth/apple', {
        identityToken: credential.identityToken,
      });
      await signIn(data);
    } catch (err: unknown) {
      if ((err as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign in failed', 'Please try again.');
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.logo}>ManaMap</Text>
          <Text style={styles.tagline}>Your local MTG scene, mapped.</Text>
        </View>

        <View style={styles.buttons}>
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radii.md}
              style={styles.appleBtn}
              onPress={handleAppleSignIn}
            />
          )}

          <Pressable
            style={({ pressed }) => [
              styles.discordBtn,
              (!!loading || !request) && styles.btnDisabled,
              pressed && styles.btnPressed,
            ]}
            onPress={() => promptDiscord()}
            disabled={!!loading || !request}
          >
            {loading === 'discord' ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.discordBtnText}>Continue with Discord</Text>
            )}
          </Pressable>

          {googleEnabled && (
            <GoogleSignInButton
              loading={loading}
              onStart={() => setLoading('google')}
              onIdToken={handleGoogleIdToken}
              onError={(msg) => {
                setLoading(null);
                Alert.alert('Sign in failed', msg);
              }}
              onDismiss={() => setLoading(null)}
            />
          )}

          <Text style={styles.legalText}>
            By continuing, you agree to our{' '}
            <Text
              style={styles.legalLink}
              onPress={() => navigation.navigate('Legal', { doc: 'terms' })}
            >
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text
              style={styles.legalLink}
              onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    paddingBottom: spacing.xxxl,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxxl,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  buttons: {
    gap: spacing.md,
  },
  appleBtn: {
    height: 50,
    width: '100%',
  },
  discordBtn: {
    height: 50,
    borderRadius: radii.md,
    backgroundColor: '#5865F2',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPressed: {
    opacity: 0.85,
  },
  discordBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
  googleBtn: {
    height: 50,
    borderRadius: radii.md,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  googleBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: '#1F1F1F',
  },
  legalText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  legalLink: {
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
