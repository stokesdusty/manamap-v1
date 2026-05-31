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
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { colors, typography, spacing, radii, shadows } from '../theme';
import type { AuthTokens } from '@manamap/shared';

WebBrowser.maybeCompleteAuthSession();

const DISCORD_CLIENT_ID = process.env['EXPO_PUBLIC_DISCORD_CLIENT_ID'] ?? '';

const discordDiscovery = {
  authorizationEndpoint: 'https://discord.com/api/oauth2/authorize',
  tokenEndpoint: 'https://discord.com/api/oauth2/token',
};

export function SignInScreen() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState<'apple' | 'discord' | null>(null);

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

  async function handleDiscordCode(code: string, codeVerifier?: string) {
    if (!code) return;
    setLoading('discord');
    try {
      const { data } = await api.post<AuthTokens>('/v1/auth/discord', { code, codeVerifier });
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.logo}>manamap</Text>
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
});
