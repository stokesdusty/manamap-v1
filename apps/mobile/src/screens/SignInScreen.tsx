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
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { colors, typography, spacing, radii, shadows } from '../theme';
import type { AuthTokens } from '@manamap/shared';

WebBrowser.maybeCompleteAuthSession();

const DISCORD_CLIENT_ID = process.env['EXPO_PUBLIC_DISCORD_CLIENT_ID'] ?? '';
const GOOGLE_WEB_CLIENT_ID = process.env['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'] ?? '';
const API_BASE = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';
const GOOGLE_CALLBACK_URL = `${API_BASE}/api/v1/auth/google/callback`;
const GOOGLE_RETURN_SCHEME = 'manamap://auth/google';

const googleEnabled = !!GOOGLE_WEB_CLIENT_ID;

const discordDiscovery = {
  authorizationEndpoint: 'https://discord.com/api/oauth2/authorize',
  tokenEndpoint: 'https://discord.com/api/oauth2/token',
};

type LoadingState = 'apple' | 'discord' | 'google' | null;

async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  const codeVerifier = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  let b64 = '';
  new Uint8Array(digest).forEach((b) => { b64 += String.fromCharCode(b); });
  const codeChallenge = btoa(b64).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return { codeVerifier, codeChallenge };
}

function GoogleSignInButton({
  loading,
  onStart,
  onTokens,
  onError,
  onDismiss,
}: {
  loading: LoadingState;
  onStart: () => void;
  onTokens: (tokens: AuthTokens) => void;
  onError: (msg: string) => void;
  onDismiss: () => void;
}) {
  async function handlePress() {
    onStart();
    const { codeVerifier, codeChallenge } = await generatePKCE();
    // Pass the verifier to the API via state so it can complete the code exchange
    const state = btoa(JSON.stringify({ cv: codeVerifier }));

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${encodeURIComponent(GOOGLE_WEB_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(GOOGLE_CALLBACK_URL)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('openid email profile')}` +
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=S256` +
      `&state=${encodeURIComponent(state)}` +
      `&access_type=offline`;

    // openAuthSessionAsync monitors for the manamap:// redirect and closes the tab
    const result = await WebBrowser.openAuthSessionAsync(authUrl, GOOGLE_RETURN_SCHEME);

    if (result.type !== 'success') {
      onDismiss();
      return;
    }

    const parsed = Linking.parse(result.url);
    const params = parsed.queryParams as Record<string, string | undefined>;

    if (params['error']) {
      onError(decodeURIComponent(params['error']));
      return;
    }

    const { accessToken, refreshToken, expiresIn } = params;
    if (accessToken && refreshToken) {
      onTokens({ accessToken, refreshToken, expiresIn: Number(expiresIn ?? 900) });
    } else {
      onDismiss();
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

  async function handleGoogleTokens(tokens: AuthTokens) {
    try {
      await signIn(tokens);
    } catch {
      Alert.alert('Sign in failed', 'Please try again.');
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
              onTokens={handleGoogleTokens}
              onError={(msg) => {
                setLoading(null);
                Alert.alert('Sign in failed', msg);
              }}
              onDismiss={() => setLoading(null)}
            />
          )}
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
});
