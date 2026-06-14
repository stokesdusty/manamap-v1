import {
  ActivityIndicator,
  Alert,
  Clipboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { SocialLink, SocialPlatform, SocialVisibility } from '@manamap/shared';
import { colors, radii, shadows, spacing, typography } from '../theme';
import {
  useAddSocial,
  useDeleteSocial,
  useSocials,
  useUpdateSocial,
} from '../hooks/useSocials';

// ---------------------------------------------------------------------------
// Platform metadata
// ---------------------------------------------------------------------------

type PlatformMeta = {
  label: string;
  color: string;
  iconName: string;
  placeholder: string;
  isUrl: boolean;
  isPhone: boolean;
};

export const SOCIAL_META: Record<SocialPlatform, PlatformMeta> = {
  DISCORD: {
    label: 'Discord',
    color: '#5865F2',
    iconName: 'logo-discord',
    placeholder: 'Username#0000',
    isUrl: false,
    isPhone: false,
  },
  INSTAGRAM: {
    label: 'Instagram',
    color: '#E1306C',
    iconName: 'logo-instagram',
    placeholder: '@handle',
    isUrl: false,
    isPhone: false,
  },
  TWITCH: {
    label: 'Twitch',
    color: '#9146FF',
    iconName: 'logo-twitch',
    placeholder: '@channel',
    isUrl: false,
    isPhone: false,
  },
  YOUTUBE: {
    label: 'YouTube',
    color: '#FF3B30',
    iconName: 'logo-youtube',
    placeholder: '@channel',
    isUrl: false,
    isPhone: false,
  },
  X: {
    label: 'X',
    color: '#52525B',
    iconName: 'logo-twitter',
    placeholder: '@handle',
    isUrl: false,
    isPhone: false,
  },
  TIKTOK: {
    label: 'TikTok',
    color: '#FE2C55',
    iconName: 'musical-notes',
    placeholder: '@handle',
    isUrl: false,
    isPhone: false,
  },
  FACEBOOK: {
    label: 'Facebook',
    color: '#1877F2',
    iconName: 'logo-facebook',
    placeholder: 'Profile URL or name',
    isUrl: false,
    isPhone: false,
  },
  WEBSITE: {
    label: 'Website',
    color: '#14B8A6',
    iconName: 'globe-outline',
    placeholder: 'https://example.com',
    isUrl: true,
    isPhone: false,
  },
  PHONE: {
    label: 'Phone',
    color: '#34C759',
    iconName: 'call-outline',
    placeholder: '+1 555-123-4567',
    isUrl: false,
    isPhone: true,
  },
  EMAIL: {
    label: 'Email',
    color: '#0EA5E9',
    iconName: 'mail-outline',
    placeholder: 'your@email.com',
    isUrl: false,
    isPhone: false,
  },
};

const ALL_PLATFORMS = Object.keys(SOCIAL_META) as SocialPlatform[];

const VISIBILITY_OPTIONS: Array<{ value: SocialVisibility; label: string }> = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'FRIENDS', label: 'Friends' },
  { value: 'HIDDEN', label: 'Hidden' },
];

// ---------------------------------------------------------------------------
// PlatformTile — brand-colored icon chip in the rail
// ---------------------------------------------------------------------------

function PlatformTile({ platform, size = 36, dim }: { platform: SocialPlatform; size?: number; dim?: boolean }) {
  const meta = SOCIAL_META[platform];
  return (
    <View
      style={[
        tile.root,
        { width: size, height: size, borderRadius: size * 0.3, backgroundColor: meta.color },
        dim && tile.dim,
      ]}
    >
      <Ionicons
        name={meta.iconName as never}
        size={size * 0.5}
        color="#fff"
      />
    </View>
  );
}

const tile = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dim: { opacity: 0.4 },
});

// ---------------------------------------------------------------------------
// SocialRow — single link row with copy/open action
// ---------------------------------------------------------------------------

// Returns a URL to open for the platform/value, or null for Discord (no public
// profile URL). Universal links let iOS/Android redirect to the native app
// automatically when installed.
function getProfileUrl(platform: SocialPlatform, value: string): string | null {
  const handle = value.startsWith('@') ? value.slice(1) : value;
  switch (platform) {
    case 'INSTAGRAM': return `https://www.instagram.com/${handle}`;
    case 'TWITCH':    return `https://www.twitch.tv/${handle}`;
    case 'YOUTUBE':   return `https://www.youtube.com/@${handle}`;
    case 'X':         return `https://x.com/${handle}`;
    case 'TIKTOK':    return `https://www.tiktok.com/@${handle}`;
    case 'FACEBOOK':  return value.startsWith('http') ? value : `https://www.facebook.com/${handle}`;
    case 'WEBSITE':   return value;
    case 'PHONE':     return `tel:${value}`;
    case 'EMAIL':     return `mailto:${value}`;
    case 'DISCORD':   return null;
    default:          return null;
  }
}

function SocialRow({ link }: { link: SocialLink }) {
  const meta = SOCIAL_META[link.platform];
  const profileUrl = getProfileUrl(link.platform, link.value);

  function handleAction() {
    if (profileUrl) {
      void Linking.openURL(profileUrl);
    } else {
      Clipboard.setString(link.value);
      Alert.alert('Copied', `${meta.label} handle copied to clipboard`);
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [row.root, pressed && { opacity: 0.7 }]}
      onPress={handleAction}
    >
      <PlatformTile platform={link.platform} size={30} />
      <View style={row.body}>
        <Text style={row.label}>{meta.label.toUpperCase()}</Text>
        <Text style={row.value} numberOfLines={1}>{link.value}</Text>
      </View>
      {link.visibility === 'FRIENDS' && (
        <Ionicons name="people-outline" size={14} color="#D9952E" />
      )}
      <View style={row.actionBtn}>
        <Ionicons
          name={profileUrl ? 'chevron-forward' : 'copy-outline'}
          size={15}
          color={colors.textSecondary}
        />
      </View>
    </Pressable>
  );
}

const row = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  body: { flex: 1, gap: 1 },
  label: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 10.5,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.44,
  },
  value: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

// ---------------------------------------------------------------------------
// ManageSocialsSheet — owner manage modal
// ---------------------------------------------------------------------------

type ManageSheetProps = {
  visible: boolean;
  onClose: () => void;
};

function ManageSocialsSheet({ visible, onClose }: ManageSheetProps) {
  const { data: links = [], isLoading } = useSocials();
  const { mutate: addSocial, isPending: isAdding } = useAddSocial();
  const { mutate: updateSocial } = useUpdateSocial();
  const { mutate: deleteSocial } = useDeleteSocial();

  const [addingPlatform, setAddingPlatform] = useState<SocialPlatform | null>(null);
  const [addValue, setAddValue] = useState('');

  const existingPlatforms = new Set(links.map((l) => l.platform));
  const availablePlatforms = ALL_PLATFORMS.filter((p) => !existingPlatforms.has(p));

  function handleAdd() {
    if (!addingPlatform || !addValue.trim()) return;
    addSocial(
      { platform: addingPlatform, value: addValue.trim(), visibility: 'PUBLIC' },
      {
        onSuccess: () => {
          setAddingPlatform(null);
          setAddValue('');
        },
        onError: (e: unknown) => {
          const msg =
            e &&
            typeof e === 'object' &&
            'response' in e &&
            (e as { response?: { data?: { message?: string } } }).response?.data?.message;
          Alert.alert('Error', typeof msg === 'string' ? msg : 'Could not add link');
        },
      },
    );
  }

  function confirmDelete(link: SocialLink) {
    Alert.alert('Remove link', `Remove ${SOCIAL_META[link.platform].label}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteSocial(link.id) },
    ]);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={ms.safe}>
        <View style={ms.topBar}>
          <Text style={ms.title}>Your socials</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={ms.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {isLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.xl }} />
            ) : (
              <>
                {links.length > 0 && (
                  <View style={ms.section}>
                    <Text style={ms.sectionLabel}>Your links</Text>
                    {links.map((link) => (
                      <ManageLinkRow
                        key={link.id}
                        link={link}
                        onVisibilityChange={(v) =>
                          updateSocial({ id: link.id, visibility: v })
                        }
                        onDelete={() => confirmDelete(link)}
                      />
                    ))}
                  </View>
                )}

                {availablePlatforms.length > 0 && (
                  <View style={ms.section}>
                    <Text style={ms.sectionLabel}>Add platform</Text>

                    {addingPlatform ? (
                      <View style={ms.addForm}>
                        <View style={ms.addFormHeader}>
                          <PlatformTile platform={addingPlatform} size={28} />
                          <Text style={ms.addFormTitle}>
                            {SOCIAL_META[addingPlatform].label}
                          </Text>
                          <Pressable
                            onPress={() => { setAddingPlatform(null); setAddValue(''); }}
                            hitSlop={8}
                          >
                            <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                          </Pressable>
                        </View>
                        <TextInput
                          style={ms.input}
                          value={addValue}
                          onChangeText={setAddValue}
                          placeholder={SOCIAL_META[addingPlatform].placeholder}
                          placeholderTextColor={colors.textTertiary}
                          autoFocus
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType={
                            addingPlatform === 'EMAIL'
                              ? 'email-address'
                              : SOCIAL_META[addingPlatform].isUrl
                              ? 'url'
                              : SOCIAL_META[addingPlatform].isPhone
                              ? 'phone-pad'
                              : 'default'
                          }
                        />
                        <Pressable
                          style={({ pressed }) => [
                            ms.addBtn,
                            (!addValue.trim() || isAdding) && { opacity: 0.5 },
                            pressed && { opacity: 0.7 },
                          ]}
                          onPress={handleAdd}
                          disabled={!addValue.trim() || isAdding}
                        >
                          {isAdding ? (
                            <ActivityIndicator size="small" color={colors.textInverse} />
                          ) : (
                            <Text style={ms.addBtnText}>Add</Text>
                          )}
                        </Pressable>
                      </View>
                    ) : (
                      <View style={ms.platformGrid}>
                        {availablePlatforms.map((p) => (
                          <Pressable
                            key={p}
                            style={({ pressed }) => [ms.platformBtn, pressed && { opacity: 0.7 }]}
                            onPress={() => { setAddingPlatform(p); setAddValue(''); }}
                          >
                            <PlatformTile platform={p} size={32} />
                            <Text style={ms.platformBtnLabel}>{SOCIAL_META[p].label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function ManageLinkRow({
  link,
  onVisibilityChange,
  onDelete,
}: {
  link: SocialLink;
  onVisibilityChange: (v: SocialVisibility) => void;
  onDelete: () => void;
}) {
  const meta = SOCIAL_META[link.platform];

  return (
    <View style={ml.root}>
      <View style={ml.topRow}>
        <PlatformTile platform={link.platform} size={28} />
        <Text style={ml.platformLabel}>{meta.label}</Text>
        <Text style={ml.value} numberOfLines={1}>{link.value}</Text>
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => pressed && { opacity: 0.5 }}
        >
          <Ionicons name="trash-outline" size={16} color={colors.error} />
        </Pressable>
      </View>
      <View style={ml.visRow}>
        {VISIBILITY_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={({ pressed }) => [
              ml.visSeg,
              link.visibility === opt.value && ml.visSegActive,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => onVisibilityChange(opt.value)}
          >
            <Text
              style={[
                ml.visSegText,
                link.visibility === opt.value && ml.visSegTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const ml = StyleSheet.create({
  root: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  platformLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  value: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  visRow: { flexDirection: 'row', gap: spacing.xs },
  visSeg: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  visSegActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  visSegText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  visSegTextActive: {
    fontFamily: typography.fontFamily.medium,
    color: colors.accent,
  },
});

const ms = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: -0.55,
  },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: 80 },
  section: { gap: spacing.md },
  sectionLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 11.5,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.63,
  },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  platformBtn: {
    alignItems: 'center',
    gap: spacing.xs,
    width: 72,
  },
  platformBtnLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  addForm: { gap: spacing.md },
  addFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addFormTitle: {
    flex: 1,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  input: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addBtn: {
    backgroundColor: colors.accent,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
});

// ---------------------------------------------------------------------------
// SocialsCard — the exported card component
// ---------------------------------------------------------------------------

type SocialsCardMode = 'owner' | 'friend' | 'public';

type SocialsCardProps = {
  mode: SocialsCardMode;
  links?: SocialLink[];
  publicCount?: number;
  friendsOnlyCount?: number;
};

export function SocialsCard({ mode, links, publicCount = 0, friendsOnlyCount = 0 }: SocialsCardProps) {
  const [manageOpen, setManageOpen] = useState(false);

  const { data: ownLinks = [], isLoading: ownLoading } = useSocials();

  const isOwner = mode === 'owner';
  const displayLinks = isOwner ? ownLinks : (links ?? []);
  const isLoading = isOwner && ownLoading;

  const hiddenCount = isOwner
    ? ownLinks.filter((l) => l.visibility === 'HIDDEN').length
    : 0;

  const ownerPublicCount = isOwner
    ? ownLinks.filter((l) => l.visibility === 'PUBLIC').length
    : publicCount;
  const ownerFriendsCount = isOwner
    ? ownLinks.filter((l) => l.visibility === 'FRIENDS').length
    : 0;

  const isEmpty = displayLinks.length === 0;

  if (!isOwner && isEmpty && friendsOnlyCount === 0) return null;

  return (
    <View style={sc.root}>
      {/* Header */}
      <View style={sc.header}>
        <Text style={sc.heading}>Socials</Text>
        {isOwner && (
          <Pressable
            onPress={() => setManageOpen(true)}
            style={({ pressed }) => [sc.manageBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="pencil-outline" size={14} color={colors.accent} />
            <Text style={sc.manageText}>Manage</Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.sm }} />
      ) : (
        <>
          {/* Colorful icon rail */}
          {(isOwner ? ownLinks : displayLinks).length > 0 && (
            <View style={sc.rail}>
              {(isOwner ? ownLinks : displayLinks).map((link) => (
                <PlatformTile
                  key={link.id}
                  platform={link.platform}
                  size={44}
                  dim={isOwner && link.visibility === 'HIDDEN'}
                />
              ))}
            </View>
          )}

          {/* Row list — non-owner only */}
          {!isOwner && (
            isEmpty ? null : (
              <View style={sc.rows}>
                {displayLinks.map((link, i) => (
                  <View key={link.id} style={i > 0 ? sc.rowDivider : undefined}>
                    <SocialRow link={link} />
                  </View>
                ))}
              </View>
            )
          )}

          {/* Owner summary badges */}
          {isOwner && ownLinks.length > 0 && (
            <View style={sc.summary}>
              <View style={[sc.visBadge, sc.visBadgePublic]}>
                <Ionicons name="eye-outline" size={11} color={colors.accentInk} />
                <Text style={[sc.visBadgeText, sc.visBadgePublicText]}>Public</Text>
              </View>
              <Text style={sc.summaryCount}>{ownerPublicCount}</Text>
              <View style={[sc.visBadge, sc.visBadgeFriends]}>
                <Ionicons name="people-outline" size={11} color="#D9952E" />
                <Text style={[sc.visBadgeText, sc.visBadgeFriendsText]}>Friends</Text>
              </View>
              <Text style={sc.summaryCount}>{ownerFriendsCount}</Text>
              {hiddenCount > 0 && (
                <>
                  <View style={[sc.visBadge, sc.visBadgeHidden]}>
                    <Ionicons name="lock-closed-outline" size={11} color={colors.textTertiary} />
                    <Text style={[sc.visBadgeText, sc.visBadgeHiddenText]}>Hidden</Text>
                  </View>
                  <Text style={sc.summaryCount}>{hiddenCount}</Text>
                </>
              )}
            </View>
          )}

          {isEmpty && isOwner && (
            <Text style={sc.empty}>Add your socials so others can find you</Text>
          )}
        </>
      )}

      {mode === 'public' && friendsOnlyCount > 0 && (
        <View style={sc.teaser}>
          <Ionicons name="people-outline" size={15} color={colors.textTertiary} />
          <Text style={sc.teaserText}>
            +{friendsOnlyCount} more shared once you connect
          </Text>
        </View>
      )}

      {isOwner && <ManageSocialsSheet visible={manageOpen} onClose={() => setManageOpen(false)} />}
    </View>
  );
}

const sc = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  manageText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
  },
  rail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  rows: { gap: 0 },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: spacing.xs,
  },
  summaryCount: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 12.5,
    color: colors.textTertiary,
  },
  visBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  visBadgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 11,
    letterSpacing: 0.22,
  },
  visBadgePublic: { backgroundColor: colors.accentLight },
  visBadgePublicText: { color: colors.accentInk },
  visBadgeFriends: { backgroundColor: 'rgba(217,149,46,0.16)' },
  visBadgeFriendsText: { color: '#D9952E' },
  visBadgeHidden: { backgroundColor: colors.chipBg },
  visBadgeHiddenText: { color: colors.textTertiary },
  teaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
  },
  teaserText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 12.5,
    color: colors.textTertiary,
  },
  empty: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
});
