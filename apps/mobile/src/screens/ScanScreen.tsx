import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import type { ExchangeToken, PublicProfile } from '@manamap/shared';
import { api } from '../api/client';
import { useProfile } from '../hooks/useMe';
import { colors, radii, shadows, spacing, typography } from '../theme';
import type { ScanScreenProps } from '../navigation/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QR_SIZE = 240;
const REFRESH_BEFORE_EXPIRY_MS = 10_000;

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function mintToken(): Promise<ExchangeToken> {
  return api.post<ExchangeToken>('/v1/exchange/token').then((r) => r.data);
}

function resolveToken(token: string): Promise<PublicProfile> {
  return api.post<PublicProfile>('/v1/exchange/resolve', { token }).then((r) => r.data);
}

// ---------------------------------------------------------------------------
// MyCodePane
// ---------------------------------------------------------------------------

function MyCodePane({ displayName }: { displayName: string }) {
  const [secondsLeft, setSecondsLeft] = useState(60);

  const {
    data: tokenData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['exchange-token'],
    queryFn: mintToken,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Auto-refresh 10s before expiry
  useEffect(() => {
    if (!tokenData?.expiresAt) return;
    const expiresMs = new Date(tokenData.expiresAt).getTime();
    const delay = expiresMs - REFRESH_BEFORE_EXPIRY_MS - Date.now();
    if (delay <= 0) {
      void refetch();
      return;
    }
    const t = setTimeout(() => void refetch(), delay);
    return () => clearTimeout(t);
  }, [tokenData?.expiresAt, refetch]);

  // Countdown ticker
  useEffect(() => {
    if (!tokenData?.expiresAt) return;
    const tick = setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((new Date(tokenData.expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(left);
      if (left === 0) void refetch();
    }, 500);
    return () => clearInterval(tick);
  }, [tokenData?.expiresAt, refetch]);

  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View style={pane.root}>
      <Text style={pane.heading}>Your code</Text>
      <Text style={pane.sub}>Let another player scan this to connect</Text>

      {isLoading || !tokenData ? (
        <View style={pane.qrPlaceholder}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <View style={pane.qrWrap}>
          <QRCode
            value={tokenData.token}
            size={QR_SIZE}
            color={colors.textPrimary}
            backgroundColor={colors.surface}
            quietZone={16}
          />
          <View style={pane.avatarOverlay} pointerEvents="none">
            <Text style={pane.avatarText}>{initial}</Text>
          </View>
        </View>
      )}

      <View style={pane.timerRow}>
        <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
        <Text style={pane.timerText}>
          {secondsLeft > 0 ? `Refreshes in ${secondsLeft}s` : 'Refreshing…'}
        </Text>
        <Pressable
          onPress={() => void refetch()}
          style={({ pressed }) => [pane.refreshBtn, pressed && { opacity: 0.5 }]}
          hitSlop={8}
        >
          <Ionicons name="refresh-outline" size={16} color={colors.accent} />
        </Pressable>
      </View>
    </View>
  );
}

const pane = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  heading: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  qrPlaceholder: {
    width: QR_SIZE + 32,
    height: QR_SIZE + 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    ...shadows.md,
  },
  qrWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 16,
    ...shadows.md,
  },
  avatarOverlay: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.accent,
  },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  timerText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  refreshBtn: { padding: 4 },
});

// ---------------------------------------------------------------------------
// ScanPane
// ---------------------------------------------------------------------------

function ScanPane({ onScanned }: { onScanned: (profile: PublicProfile) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const scanningRef = useRef(false);
  const [resolving, setResolving] = useState(false);

  const { mutate: resolve } = useMutation({
    mutationFn: resolveToken,
    onSuccess: (profile) => {
      setResolving(false);
      onScanned(profile);
    },
    onError: (err: unknown) => {
      scanningRef.current = false;
      setResolving(false);
      const status =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status;
      if (status === 410) {
        Alert.alert('Code expired', 'Ask the other player to refresh their code.');
      } else {
        Alert.alert('Scan failed', 'Could not read that code. Try again.');
      }
    },
  });

  const handleBarcode = useCallback(
    ({ data }: { data: string }) => {
      if (scanningRef.current) return;
      scanningRef.current = true;
      setResolving(true);
      resolve(data);
    },
    [resolve],
  );

  if (!permission) {
    return (
      <View style={scanPane.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={scanPane.center}>
        <Ionicons name="camera-outline" size={48} color={colors.textTertiary} />
        <Text style={scanPane.permTitle}>Camera access needed</Text>
        <Text style={scanPane.permSub}>Grant camera permission to scan player codes.</Text>
        <Pressable
          style={({ pressed }) => [scanPane.permBtn, pressed && { opacity: 0.7 }]}
          onPress={requestPermission}
        >
          <Text style={scanPane.permBtnText}>Grant permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={scanPane.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={resolving ? undefined : handleBarcode}
      />

      {/* Dark overlay with finder cutout */}
      <View style={scanPane.overlay} pointerEvents="none">
        <View style={scanPane.finder} />
      </View>

      {resolving && (
        <View style={scanPane.resolving} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.surface} />
          <Text style={scanPane.resolvingText}>Looking up player…</Text>
        </View>
      )}

      <View style={scanPane.hint} pointerEvents="none">
        <Text style={scanPane.hintText}>Point at a player's QR code</Text>
      </View>
    </View>
  );
}

const scanPane = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  permTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  permSub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  permBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  permBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
  overlay: {
    ...(StyleSheet.absoluteFill as object),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  finder: {
    width: 220,
    height: 220,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: 'transparent',
  },
  resolving: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  resolvingText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.surface,
  },
  hint: {
    position: 'absolute',
    bottom: spacing.xxxl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.surface,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
});

// ---------------------------------------------------------------------------
// ScanScreen
// ---------------------------------------------------------------------------

type Mode = 'mycode' | 'scan';

export function ScanScreen({ navigation }: ScanScreenProps) {
  const [mode, setMode] = useState<Mode>('mycode');
  const { data: profile } = useProfile();

  function handleScanned(p: PublicProfile) {
    navigation.navigate('PlayerPreview', { profile: p });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan</Text>
        <Pressable
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.5 }]}
          onPress={() => navigation.navigate('Discover')}
          hitSlop={8}
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {(['mycode', 'scan'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[styles.segTab, mode === m && styles.segTabActive]}
            >
              <Text style={[styles.segLabel, mode === m && styles.segLabelActive]}>
                {m === 'mycode' ? 'My code' : 'Scan'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.content}>
        {mode === 'mycode' ? (
          <MyCodePane displayName={profile?.displayName ?? '?'} />
        ) : (
          <ScanPane onScanned={handleScanned} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
    color: colors.textPrimary,
  },
  closeBtn: { padding: 4 },
  segmentWrap: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.borderLight,
    borderRadius: radii.md,
    padding: 3,
  },
  segTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  segTabActive: { backgroundColor: colors.surface, ...shadows.sm },
  segLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  segLabelActive: { color: colors.textPrimary },
  content: { flex: 1 },
});
