import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import axios from 'axios';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { useSuggestStore } from '../hooks/useStores';

// US center — shown before user location resolves
const FALLBACK_LAT = 39.5;
const FALLBACK_LNG = -98.35;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function StoreSuggestSheet({ visible, onClose }: Props) {
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [note, setNote] = useState('');
  const [pinLat, setPinLat] = useState(FALLBACK_LAT);
  const [pinLng, setPinLng] = useState(FALLBACK_LNG);
  const [submitterLat, setSubmitterLat] = useState<number | undefined>();
  const [submitterLng, setSubmitterLng] = useState<number | undefined>();
  const [locLoading, setLocLoading] = useState(false);

  const mapRef = useRef<MapView>(null);
  const { mutate: suggest, isPending } = useSuggestStore();

  // On open: reset form, request location, center map on user
  useEffect(() => {
    if (!visible) return;

    setName('');
    setWebsite('');
    setNote('');
    setPinLat(FALLBACK_LAT);
    setPinLng(FALLBACK_LNG);
    setSubmitterLat(undefined);
    setSubmitterLng(undefined);
    setLocLoading(true);

    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const { latitude, longitude } = pos.coords;
          setSubmitterLat(latitude);
          setSubmitterLng(longitude);
          setPinLat(latitude);
          setPinLng(longitude);
          mapRef.current?.animateToRegion(
            { latitude, longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 },
            400,
          );
        }
      } catch {
        // Keep fallback coordinates
      } finally {
        setLocLoading(false);
      }
    })();
  }, [visible]);

  function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    suggest(
      {
        name: trimmedName,
        lat: pinLat,
        lng: pinLng,
        ...(website.trim() ? { website: website.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(submitterLat != null ? { submitterLat } : {}),
        ...(submitterLng != null ? { submitterLng } : {}),
      },
      {
        onSuccess: () => {
          Alert.alert(
            'Suggested!',
            '3 players confirming it will make it live on the map.',
            [{ text: 'OK', onPress: onClose }],
          );
        },
        onError: (err) => {
          if (axios.isAxiosError(err)) {
            const status = err.response?.status;
            const data = err.response?.data as Record<string, unknown> | undefined;
            const code = data?.code;
            if (status === 429 || code === 'submission_limit_reached') {
              Alert.alert(
                'Limit reached',
                "You've submitted 3 stores this week. Come back next week.",
              );
              return;
            }
          }
          Alert.alert('Error', 'Could not submit. Please try again.');
        },
      },
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Suggest a Store</Text>
            <Pressable onPress={onClose} hitSlop={8} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Map */}
            <View style={s.mapWrapper}>
              <MapView
                ref={mapRef}
                style={s.map}
                initialRegion={{
                  latitude: FALLBACK_LAT,
                  longitude: FALLBACK_LNG,
                  latitudeDelta: 30,
                  longitudeDelta: 45,
                }}
                showsUserLocation
                showsMyLocationButton={false}
              >
                <Marker
                  coordinate={{ latitude: pinLat, longitude: pinLng }}
                  draggable
                  onDragEnd={(e) => {
                    setPinLat(e.nativeEvent.coordinate.latitude);
                    setPinLng(e.nativeEvent.coordinate.longitude);
                  }}
                  pinColor={colors.accent}
                />
              </MapView>

              {locLoading && (
                <View style={s.mapOverlay}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={s.mapOverlayText}>Getting your location…</Text>
                </View>
              )}
            </View>
            <Text style={s.mapHint}>Drag the pin to the store's exact location</Text>

            {/* Name */}
            <Text style={s.label}>Store name *</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              maxLength={128}
              placeholder="e.g. Card Kingdom"
              placeholderTextColor={colors.textTertiary}
              returnKeyType="next"
              autoCorrect={false}
            />

            {/* Website */}
            <Text style={s.label}>Website</Text>
            <TextInput
              style={s.input}
              value={website}
              onChangeText={setWebsite}
              maxLength={512}
              placeholder="https://..."
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="next"
            />

            {/* Note */}
            <Text style={s.label}>Note</Text>
            <TextInput
              style={[s.input, s.inputMultiline]}
              value={note}
              onChangeText={setNote}
              maxLength={512}
              placeholder="Anything that helps confirm this is a real MTG store"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={2}
              returnKeyType="done"
            />
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <Pressable
              style={({ pressed }) => [
                s.submitBtn,
                !name.trim() && s.submitBtnDisabled,
                (pressed || isPending) && { opacity: 0.8 },
              ]}
              onPress={handleSubmit}
              disabled={!name.trim() || isPending}
            >
              {isPending ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <>
                  <Ionicons name="storefront-outline" size={18} color={colors.textInverse} />
                  <Text style={s.submitBtnText}>Suggest Store</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: 2,
  },
  scroll: {
    padding: spacing.xl,
    gap: spacing.xs,
    paddingBottom: spacing.xxxl,
  },
  mapWrapper: {
    height: 220,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.xs,
    ...shadows.sm,
  },
  map: {
    flex: 1,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.paper + 'CC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  mapOverlayText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  mapHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: spacing.sm + 2,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.paper,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    height: 52,
    borderRadius: radii.lg,
    ...shadows.md,
  },
  submitBtnDisabled: {
    backgroundColor: colors.border,
  },
  submitBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
});
