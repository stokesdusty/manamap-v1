import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { SocialsCard } from '../components/SocialsCard';
import { EndorsementChips } from '../components/EndorsementChips';
import { useMyGames, useMyGameStats } from '../hooks/useGames';
import type { Game, GameStats } from '@manamap/shared';
import type { BlockedUser } from '@manamap/shared';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { DeckSite, ManaColor, MtgFormat, PlayerVibe, Privacy, Profile } from '@manamap/shared';
import { DECK_SITE_HOSTS } from '@manamap/shared';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import { ManaPip } from '../components/ManaPip';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { guildName } from '../theme/identity';
import { useIdentityTheme } from '../hooks/useIdentityTheme';
import {
  useCreateDeck,
  useDecks,
  useDeleteAccount,
  useDeleteDeck,
  useExportAccountData,
  useHomeStore,
  usePrivacy,
  useProfile,
  useRecentCheckinStores,
  useSetHomeStore,
  useUpdatePrivacy,
  useUpdateProfile,
} from '../hooks/useMe';
import { useBlockedUsers, useUnblockUser } from '../hooks/useSafety';
import { useStores } from '../hooks/useNearby';
import { useBadges, useStreaksSummary } from '../hooks/useGamification';
import { useQuests } from '../hooks/useQuests';
import { useRivalries } from '../hooks/useRivalries';
import type { ActiveQuest, Rivalry } from '@manamap/shared';
import { BellButton } from '../components/BellButton';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MANA_COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

const VIBE_LABELS: Record<PlayerVibe, string> = {
  competitive: 'Competitive',
  casual: 'Casual',
  spike: 'Spike',
  timmy: 'Timmy',
  johnny: 'Johnny',
  vorthos: 'Vorthos',
  influencer: 'Influencer',
};

const FORMAT_LABELS: Record<MtgFormat, string> = {
  standard: 'Standard',
  pioneer: 'Pioneer',
  modern: 'Modern',
  legacy: 'Legacy',
  vintage: 'Vintage',
  commander: 'Commander',
  draft: 'Draft',
};

const ALL_VIBES = Object.keys(VIBE_LABELS) as PlayerVibe[];
const ALL_FORMATS = Object.keys(FORMAT_LABELS) as MtgFormat[];

const SITE_LABELS: Record<DeckSite, string> = {
  moxfield: 'Moxfield',
  archidekt: 'Archidekt',
};

// ---------------------------------------------------------------------------
// IdentityHero — replaces ProfileCard
// ---------------------------------------------------------------------------

const BANNER_H = 220;

function IdentityHero({ profile, onEdit }: { profile: Profile; onEdit: () => void }) {
  const { gradient, onAccent, accent, soft, ink } = useIdentityTheme();
  const avatarColors = profile.avatarColors as ManaColor[];
  const [bannerW, setBannerW] = useState(() => Dimensions.get('window').width - spacing.xl * 2);

  return (
    <View style={hero.root}>
      {/* Gradient banner containing avatar / name / guild chip */}
      <View style={hero.banner} onLayout={(e) => setBannerW(e.nativeEvent.layout.width)}>
        <Svg style={StyleSheet.absoluteFill} width={bannerW} height={BANNER_H}>
          <Defs>
            <SvgLinearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
              {gradient.map((c, i) => (
                <Stop key={i} offset={`${i / Math.max(1, gradient.length - 1)}`} stopColor={c} />
              ))}
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width={bannerW} height={BANNER_H} fill="url(#heroGrad)" />
        </Svg>

        <View style={hero.bannerContent}>
          <Avatar
            name={profile.displayName}
            manaColors={avatarColors}
            size={64}
            style={hero.avatar}
          />
          <Text style={[hero.displayName, { color: onAccent }]} numberOfLines={1}>
            {profile.displayName}
          </Text>
          {profile.pronouns ? (
            <Text style={[hero.pronouns, { color: onAccent + 'CC' }]}>{profile.pronouns}</Text>
          ) : null}
          {avatarColors.length > 0 && (
            <View style={hero.guildChip}>
              {avatarColors.map((c) => (
                <ManaPip key={c} color={c} size={14} />
              ))}
              <Text style={[hero.guildLabel, { color: onAccent }]}>{guildName(avatarColors)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions row on surface background */}
      <View style={hero.actions}>
        {((profile.vibes as PlayerVibe[] | undefined) ?? []).map((v) => (
          <View key={v} style={[hero.vibePill, { backgroundColor: soft }]}>
            <Text style={[hero.vibeText, { color: ink }]}>{VIBE_LABELS[v]}</Text>
          </View>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable
          style={({ pressed }) => [hero.editBtn, pressed && { opacity: 0.6 }]}
          onPress={onEdit}
        >
          <Ionicons name="pencil-outline" size={16} color={accent} />
          <Text style={[hero.editText, { color: accent }]}>Edit</Text>
        </Pressable>
      </View>

      {/* Profile details (commander / formats / bio) */}
      {profile.commander ? (
        <View style={hero.row}>
          <Ionicons name="shield-outline" size={14} color={colors.textTertiary} />
          <Text style={hero.rowText} numberOfLines={1}>
            {profile.commander}
          </Text>
        </View>
      ) : null}

      {profile.formats.length > 0 && (
        <View style={hero.chips}>
          {profile.formats.map((f) => (
            <View key={f} style={hero.chip}>
              <Text style={hero.chipText}>{FORMAT_LABELS[f as MtgFormat]}</Text>
            </View>
          ))}
        </View>
      )}

      {profile.endorsements && profile.endorsements.total > 0 && (
        <View style={hero.chips}>
          <EndorsementChips summary={profile.endorsements} />
        </View>
      )}

      {profile.bio ? (
        <Text style={hero.bio} numberOfLines={4}>
          {profile.bio}
        </Text>
      ) : null}
    </View>
  );
}

const hero = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    overflow: 'hidden',
    gap: 0,
    ...shadows.md,
  },
  banner: {
    height: BANNER_H,
    overflow: 'hidden',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  bannerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  avatar: {
    borderRadius: radii.xl,
    marginBottom: spacing.xs,
  },
  displayName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 22,
    letterSpacing: -0.44,
  },
  pronouns: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
  },
  guildChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  guildLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    marginLeft: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  vibePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  vibeText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
  },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  rowText: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  powerBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.borderLight,
    borderRadius: radii.full,
  },
  powerText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.borderLight,
    borderRadius: radii.full,
  },
  chipText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  bio: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
});

// ---------------------------------------------------------------------------
// PrivacyCard
// ---------------------------------------------------------------------------

function PrivacyCard({ privacy }: { privacy: Privacy }) {
  const { mutate } = useUpdatePrivacy();
  const isInvisible = !privacy.discoverable;

  const otherRows: Array<{ key: keyof Privacy; label: string; sub?: string }> = [
    {
      key: 'shareNameWithContacts',
      label: 'Share real name',
      sub: 'Your connections can see your real/chosen name',
    },
    { key: 'showDiscord', label: 'Show Discord', sub: 'Visible to your connections' },
    { key: 'showDecks', label: 'Show decks', sub: 'Share your deck list publicly' },
    { key: 'showMetHistory', label: 'Show met history', sub: "Others can see who you've played" },
    {
      key: 'eventReminders',
      label: 'Event reminders',
      sub: 'Push notifications before events you RSVP to',
    },
  ];

  return (
    <View style={section.card}>
      <Text style={section.heading}>Privacy</Text>

      {/* Prominent Go Invisible toggle */}
      <Pressable
        style={[section.invisibleRow, isInvisible && section.invisibleRowActive]}
        onPress={() => mutate({ discoverable: isInvisible })}
      >
        <Ionicons
          name={isInvisible ? 'eye-off' : 'eye-outline'}
          size={20}
          color={isInvisible ? colors.textInverse : colors.textSecondary}
        />
        <View style={section.privacyLabel}>
          <Text style={[section.privacyTitle, isInvisible && { color: colors.textInverse }]}>
            {isInvisible ? 'Invisible' : 'Visible'}
          </Text>
          <Text
            style={[section.privacySub, isInvisible && { color: colors.textInverse, opacity: 0.8 }]}
          >
            {isInvisible
              ? "You're hidden from nearby search"
              : 'You appear in nearby player search'}
          </Text>
        </View>
        <Switch
          value={!isInvisible}
          onValueChange={(val) => mutate({ discoverable: val })}
          trackColor={{ true: colors.success, false: colors.border }}
          thumbColor={colors.surface}
        />
      </Pressable>

      {otherRows.map((row, i) => (
        <View
          key={row.key}
          style={[section.privacyRow, i < otherRows.length - 1 && section.rowBorder]}
        >
          <View style={section.privacyLabel}>
            <Text style={section.privacyTitle}>{row.label}</Text>
            {row.sub ? <Text style={section.privacySub}>{row.sub}</Text> : null}
          </View>
          <Switch
            value={privacy[row.key]}
            onValueChange={(val) => mutate({ [row.key]: val })}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// BlockedPlayersCard
// ---------------------------------------------------------------------------

function BlockedPlayersCard() {
  const { data: blocked = [], isLoading } = useBlockedUsers();
  const { mutate: unblockUser } = useUnblockUser();

  function confirmUnblock(item: BlockedUser) {
    Alert.alert('Unblock player', `Unblock ${item.displayName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unblock', onPress: () => unblockUser(item.userId) },
    ]);
  }

  if (!isLoading && blocked.length === 0) return null;

  return (
    <View style={section.card}>
      <Text style={section.heading}>Blocked players</Text>

      {isLoading && (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.sm }} />
      )}

      {blocked.map((item) => (
        <View key={item.id} style={section.blockedRow}>
          <View style={section.blockedAvatar}>
            <Text style={section.blockedAvatarText}>
              {item.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={section.blockedName} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Pressable
            style={({ pressed }) => [section.unblockBtn, pressed && { opacity: 0.6 }]}
            onPress={() => confirmUnblock(item)}
          >
            <Text style={section.unblockText}>Unblock</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// DecksCard
// ---------------------------------------------------------------------------

function DecksCard() {
  const { data: decks = [], isLoading } = useDecks();
  const { mutate: deleteDeck } = useDeleteDeck();
  const [showAdd, setShowAdd] = useState(false);

  function confirmDelete(id: string, name: string) {
    Alert.alert('Remove deck', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteDeck(id),
      },
    ]);
  }

  return (
    <View style={section.card}>
      <View style={section.cardHeader}>
        <Text style={section.heading}>Decks</Text>
        <Pressable
          style={({ pressed }) => [section.addBtn, pressed && { opacity: 0.6 }]}
          onPress={() => setShowAdd(true)}
        >
          <Ionicons name="add" size={18} color={colors.accent} />
          <Text style={section.addText}>Add</Text>
        </Pressable>
      </View>

      {isLoading && (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.md }} />
      )}

      {!isLoading && decks.length === 0 && <Text style={section.empty}>No decks added yet</Text>}

      {decks.map((deck) => (
        <View key={deck.id} style={section.deckRow}>
          <View style={section.deckInfo}>
            {deck.site && <Text style={section.deckSite}>{SITE_LABELS[deck.site]}</Text>}
            <Text style={section.deckName} numberOfLines={1}>
              {deck.name}
            </Text>
            {deck.url && (
              <Text style={section.deckUrl} numberOfLines={1}>
                {deck.url}
              </Text>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [section.deleteBtn, pressed && { opacity: 0.5 }]}
            onPress={() => confirmDelete(deck.id, deck.name)}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </Pressable>
        </View>
      ))}

      <AddDeckModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// TradeListCard + EditTradeListModal
// ---------------------------------------------------------------------------

function EditTradeListModal({
  visible,
  profile,
  onClose,
}: {
  visible: boolean;
  profile: Profile;
  onClose: () => void;
}) {
  const { mutate: update, isPending } = useUpdateProfile();
  const [wants, setWants] = useState('');
  const [haves, setHaves] = useState('');

  function handleOpen() {
    setWants(profile.tradeWants ?? '');
    setHaves(profile.tradeHaves ?? '');
  }

  function handleSave() {
    update(
      { tradeWants: wants.trim() || null, tradeHaves: haves.trim() || null },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={handleOpen}
      onRequestClose={onClose}
    >
      <SafeAreaView style={modal.safe}>
        <View style={modal.topBar}>
          <Pressable onPress={onClose} style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <Text style={modal.cancel}>Cancel</Text>
          </Pressable>
          <Text style={modal.title}>Trade List</Text>
          <Pressable
            onPress={handleSave}
            disabled={isPending}
            style={({ pressed }) => [modal.saveBtn, pressed && { opacity: 0.6 }]}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Text style={modal.saveText}>Save</Text>
            )}
          </Pressable>
        </View>

        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={modal.scroll}
          keyboardShouldPersistTaps="handled"
          bottomOffset={spacing.xl}
        >
          <FormField label="Looking for">
            <TextInput
              style={[form.input, tl.textArea]}
              value={wants}
              onChangeText={setWants}
              maxLength={2000}
              placeholder={'e.g. Doubling Season, Force of Will\nor "all squirrel cards"'}
              placeholderTextColor={colors.textTertiary}
              multiline
              textAlignVertical="top"
            />
          </FormField>

          <FormField label="Have / For trade">
            <TextInput
              style={[form.input, tl.textArea]}
              value={haves}
              onChangeText={setHaves}
              maxLength={2000}
              placeholder="e.g. Foil Rhystic Study, multiple Smothering Tithe..."
              placeholderTextColor={colors.textTertiary}
              multiline
              textAlignVertical="top"
            />
          </FormField>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function TradeListCard({ profile }: { profile: Profile }) {
  const [manageOpen, setManageOpen] = useState(false);
  const hasWants = !!profile.tradeWants?.trim();
  const hasHaves = !!profile.tradeHaves?.trim();
  const isEmpty = !hasWants && !hasHaves;

  return (
    <View style={section.card}>
      <View style={section.cardHeader}>
        <Text style={section.heading}>Trade list</Text>
        <Pressable
          style={({ pressed }) => [section.addBtn, pressed && { opacity: 0.6 }]}
          onPress={() => setManageOpen(true)}
        >
          <Ionicons name="list-outline" size={17} color={colors.accent} />
          <Text style={section.addText}>Manage</Text>
        </Pressable>
      </View>

      {isEmpty ? (
        <Text style={section.empty}>
          No trade list yet — tap Manage to add cards you want or have.
        </Text>
      ) : (
        <>
          {hasWants && (
            <View style={tl.section}>
              <Text style={tl.sectionLabel}>Looking for</Text>
              <Text style={tl.body}>{profile.tradeWants}</Text>
            </View>
          )}
          {hasHaves && (
            <View style={[tl.section, hasWants && tl.sectionBorder]}>
              <Text style={tl.sectionLabel}>Have / For trade</Text>
              <Text style={tl.body}>{profile.tradeHaves}</Text>
            </View>
          )}
        </>
      )}

      <EditTradeListModal
        visible={manageOpen}
        profile={profile}
        onClose={() => setManageOpen(false)}
      />
    </View>
  );
}

const tl = StyleSheet.create({
  textArea: { height: 140, paddingTop: spacing.sm },
  section: { gap: spacing.xs, paddingTop: spacing.xs },
  sectionBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.md },
  sectionLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  body: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

// ---------------------------------------------------------------------------
// RewardsCard
// ---------------------------------------------------------------------------

function RewardsCard() {
  const { data: badges = [], isLoading: badgesLoading } = useBadges();
  const { data: streaks } = useStreaksSummary();

  const hasActivity = badges.length > 0 || (streaks?.totalCheckins ?? 0) > 0;

  if (badgesLoading) {
    return (
      <View style={section.card}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!hasActivity) return null;

  return (
    <View style={[section.card, { paddingHorizontal: 0, paddingVertical: spacing.lg }]}>
      <Text style={[section.heading, { paddingHorizontal: spacing.xl }]}>Achievements</Text>

      {streaks && (streaks.bestLongestStreak > 0 || streaks.totalCheckins > 0) ? (
        <View style={rewards.statsRow}>
          <View style={rewards.stat}>
            <Text style={rewards.statValue}>🔥 {streaks.bestLongestStreak}</Text>
            <Text style={rewards.statLabel}>Best streak</Text>
          </View>
          <View style={rewards.statDivider} />
          <View style={rewards.stat}>
            <Text style={rewards.statValue}>{streaks.totalCheckins}</Text>
            <Text style={rewards.statLabel}>Check-ins</Text>
          </View>
          {streaks.bestCurrentStreak > 1 && (
            <>
              <View style={rewards.statDivider} />
              <View style={rewards.stat}>
                <Text style={rewards.statValue}>🔥 {streaks.bestCurrentStreak} now</Text>
                <Text style={rewards.statLabel}>Active streak</Text>
              </View>
            </>
          )}
        </View>
      ) : null}

      {badges.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={rewards.badgeRow}
        >
          {badges.map((ub) => (
            <View key={ub.id} style={rewards.badge}>
              <Text style={rewards.badgeIcon}>{ub.badge.icon}</Text>
              <Text style={rewards.badgeName} numberOfLines={2}>
                {ub.badge.name}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={[section.empty, { paddingHorizontal: spacing.xl }]}>
          No badges yet — keep checking in!
        </Text>
      )}
    </View>
  );
}

const rewards = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.sm,
  },
  badgeRow: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingVertical: spacing.xs },
  badge: {
    alignItems: 'center',
    gap: spacing.xs,
    width: 72,
    backgroundColor: colors.paper,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  badgeIcon: { fontSize: 28, lineHeight: 36 },
  badgeName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

// ---------------------------------------------------------------------------
// HomeStoreRow
// ---------------------------------------------------------------------------

function HomeStorePicker({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const { data: recent, isLoading: recentLoading } = useRecentCheckinStores();
  const { data: searchResults = [], isLoading: searchLoading } = useStores(
    query.length >= 2 ? query : undefined,
  );

  const showingSearch = query.length >= 2;
  const isLoading = showingSearch ? searchLoading : recentLoading;
  const stores = showingSearch ? searchResults : (recent?.stores ?? []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <View style={section.pickerHeader}>
          <Pressable onPress={onClose} hitSlop={8} style={section.pickerBack}>
            <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={section.pickerTitle}>Set home store</Text>
        </View>
        <View style={section.pickerSearchWrap}>
          <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
          <TextInput
            style={section.pickerInput}
            placeholder="Search stores…"
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
        {isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : (
          <FlatList
            data={stores}
            keyExtractor={(s) => s.id}
            ListHeaderComponent={
              !showingSearch && stores.length > 0 ? (
                <Text style={section.pickerSectionLabel}>Recently visited</Text>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [section.pickerRow, pressed && { opacity: 0.6 }]}
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
              >
                <Ionicons name="storefront-outline" size={18} color={colors.textTertiary} />
                <View style={{ flex: 1 }}>
                  <Text style={section.storeTitle}>{item.name}</Text>
                  {(item.city || item.state) && (
                    <Text style={section.storeSub}>
                      {[item.city, item.state].filter(Boolean).join(', ')}
                    </Text>
                  )}
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={section.pickerEmptyWrap}>
                <Ionicons name="storefront-outline" size={32} color={colors.border} />
                <Text style={section.pickerEmptyText}>
                  {showingSearch
                    ? 'No stores found'
                    : 'Recently visited stores will appear here\nor use the search bar above'}
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function HomeStoreRow() {
  const { data, isLoading } = useHomeStore();
  const { mutate: setHomeStore, isPending } = useSetHomeStore();
  const [showPicker, setShowPicker] = useState(false);

  const store = data?.store;

  return (
    <View style={section.card}>
      <Pressable
        style={({ pressed }) => [section.storeRow, pressed && { opacity: 0.7 }]}
        onPress={() => setShowPicker(true)}
      >
        <Ionicons name="storefront-outline" size={20} color={colors.textTertiary} />
        <View style={{ flex: 1 }}>
          <Text style={section.storeTitle}>Home store</Text>
          {isLoading || isPending ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={section.storeSub}>{store ? store.name : 'Not set'}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </Pressable>

      <HomeStorePicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={(storeId) => setHomeStore({ storeId })}
      />
    </View>
  );
}

const section = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  addText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
  },
  invisibleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  invisibleRowActive: {
    backgroundColor: colors.textSecondary,
    borderColor: colors.textSecondary,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  privacyLabel: { flex: 1, gap: 2 },
  privacyTitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  privacySub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  empty: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  deckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  deckInfo: { flex: 1, gap: 2 },
  deckSite: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deckName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  deckUrl: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  deleteBtn: { padding: spacing.xs },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  blockedAvatar: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedAvatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  blockedName: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  unblockBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  unblockText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
  },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  storeTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  storeSub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  pickerBack: {
    padding: 2,
  },
  pickerTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
    flex: 1,
  },
  pickerSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  pickerInput: {
    flex: 1,
    height: 44,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  pickerSectionLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  pickerEmptyWrap: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  pickerEmptyText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

// ---------------------------------------------------------------------------
// EditProfileModal
// ---------------------------------------------------------------------------

type ProfileDraft = {
  name: string;
  displayName: string;
  pronouns: string;
  bio: string;
  avatarColors: ManaColor[];
  commander: string;
  vibes: PlayerVibe[];
  formats: MtgFormat[];
  spelltable: boolean;
  convokeGames: boolean;
};

function draftFromProfile(p: Profile): ProfileDraft {
  return {
    name: p.name ?? '',
    displayName: p.displayName,
    pronouns: p.pronouns ?? '',
    bio: p.bio ?? '',
    avatarColors: p.avatarColors as ManaColor[],
    commander: p.commander ?? '',
    vibes: (p.vibes as PlayerVibe[]) ?? [],
    formats: p.formats as MtgFormat[],
    spelltable: p.spelltable ?? false,
    convokeGames: p.convokeGames ?? false,
  };
}

function EditProfileModal({
  visible,
  profile,
  onClose,
}: {
  visible: boolean;
  profile: Profile;
  onClose: () => void;
}) {
  const { mutate: update, isPending } = useUpdateProfile();
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile));

  function set<K extends keyof ProfileDraft>(key: K, val: ProfileDraft[K]) {
    setDraft((d) => ({ ...d, [key]: val }));
  }

  function toggleColor(c: ManaColor) {
    set(
      'avatarColors',
      draft.avatarColors.includes(c)
        ? draft.avatarColors.filter((x) => x !== c)
        : [...draft.avatarColors, c],
    );
  }

  function toggleFormat(f: MtgFormat) {
    set(
      'formats',
      draft.formats.includes(f) ? draft.formats.filter((x) => x !== f) : [...draft.formats, f],
    );
  }

  function handleSave() {
    update(
      {
        name: draft.name.trim() || null,
        displayName: draft.displayName.trim() || profile.displayName,
        pronouns: draft.pronouns.trim() || null,
        bio: draft.bio.trim() || null,
        avatarColors: draft.avatarColors,
        commander: draft.commander.trim() || null,
        vibes: draft.vibes,
        formats: draft.formats,
        spelltable: draft.spelltable,
        convokeGames: draft.convokeGames,
      },
      { onSuccess: onClose },
    );
  }

  // Reset draft when modal opens
  function handleOpen() {
    setDraft(draftFromProfile(profile));
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={handleOpen}
      onRequestClose={onClose}
    >
      <SafeAreaView style={modal.safe}>
        <View style={modal.topBar}>
          <Pressable onPress={onClose} style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <Text style={modal.cancel}>Cancel</Text>
          </Pressable>
          <Text style={modal.title}>Edit Profile</Text>
          <Pressable
            onPress={handleSave}
            disabled={isPending}
            style={({ pressed }) => [modal.saveBtn, pressed && { opacity: 0.6 }]}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Text style={modal.saveText}>Save</Text>
            )}
          </Pressable>
        </View>

        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={modal.scroll}
          keyboardShouldPersistTaps="handled"
          bottomOffset={spacing.xl}
        >
          <FormField label="Display name">
            <TextInput
              style={form.input}
              value={draft.displayName}
              onChangeText={(v) => set('displayName', v)}
              maxLength={64}
              placeholder="Your name"
              placeholderTextColor={colors.textTertiary}
            />
          </FormField>

          <FormField label="Real / chosen name (optional)">
            <TextInput
              style={form.input}
              value={draft.name}
              onChangeText={(v) => set('name', v)}
              maxLength={80}
              placeholder="e.g. Alex Smith or Alex S."
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
            />
            <Text style={form.fieldHint}>
              Shared only with contacts when you enable "Share real name" in Privacy
            </Text>
          </FormField>

          <FormField label="Pronouns">
            <TextInput
              style={form.input}
              value={draft.pronouns}
              onChangeText={(v) => set('pronouns', v)}
              maxLength={32}
              placeholder="e.g. they/them"
              placeholderTextColor={colors.textTertiary}
            />
          </FormField>

          <FormField label="Bio">
            <TextInput
              style={[form.input, form.multiline]}
              value={draft.bio}
              onChangeText={(v) => set('bio', v)}
              maxLength={500}
              placeholder="Tell people about yourself..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </FormField>

          <FormField label="Color identity">
            <View style={form.row}>
              {MANA_COLORS.map((c) => {
                const active = draft.avatarColors.includes(c);
                return (
                  <Pressable
                    key={c}
                    onPress={() => toggleColor(c)}
                    style={[form.colorBtn, active && form.colorBtnActive]}
                  >
                    <ManaPip color={c} size={28} />
                  </Pressable>
                );
              })}
            </View>
          </FormField>

          <FormField label="Favorite Commander">
            <TextInput
              style={form.input}
              value={draft.commander}
              onChangeText={(v) => set('commander', v)}
              maxLength={128}
              placeholder="e.g. Atraxa, Praetors' Voice"
              placeholderTextColor={colors.textTertiary}
            />
          </FormField>

          <FormField label="Vibe (select all that apply)">
            <View style={form.chips}>
              {ALL_VIBES.map((v) => {
                const active = draft.vibes.includes(v);
                return (
                  <Pressable
                    key={v}
                    onPress={() =>
                      set(
                        'vibes',
                        active ? draft.vibes.filter((x) => x !== v) : [...draft.vibes, v],
                      )
                    }
                    style={[form.chip, active && form.chipActive]}
                  >
                    <Text style={[form.chipText, active && form.chipTextActive]}>
                      {VIBE_LABELS[v]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FormField>

          <FormField label="Formats">
            <View style={form.chips}>
              {ALL_FORMATS.map((f) => {
                const active = draft.formats.includes(f);
                return (
                  <Pressable
                    key={f}
                    onPress={() => toggleFormat(f)}
                    style={[form.chip, active && form.chipActive]}
                  >
                    <Text style={[form.chipText, active && form.chipTextActive]}>
                      {FORMAT_LABELS[f]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FormField>

          <FormField label="Online play">
            <View style={form.toggleRow}>
              <View style={form.toggleLabel}>
                <Text style={form.toggleTitle}>SpellTable</Text>
                <Text style={form.toggleSub}>Open to online Commander games</Text>
              </View>
              <Switch
                value={draft.spelltable}
                onValueChange={(v) => set('spelltable', v)}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor={colors.surface}
              />
            </View>
            <View style={[form.toggleRow, { marginTop: spacing.sm }]}>
              <View style={form.toggleLabel}>
                <Text style={form.toggleTitle}>Convoke.games</Text>
                <Text style={form.toggleSub}>Open to Convoke online matches</Text>
              </View>
              <Switch
                value={draft.convokeGames}
                onValueChange={(v) => set('convokeGames', v)}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor={colors.surface}
              />
            </View>
          </FormField>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={form.field}>
      <Text style={form.label}>{label}</Text>
      {children}
    </View>
  );
}

const modal = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  cancel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    minWidth: 56,
    alignItems: 'center',
  },
  saveText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 80 },
});

const form = StyleSheet.create({
  field: { gap: spacing.xs },
  label: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  multiline: { height: 100, paddingTop: spacing.sm },
  fieldHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginTop: 4,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  colorBtn: {
    borderRadius: radii.full,
    padding: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorBtnActive: { borderColor: colors.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  chipText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  chipTextActive: { color: colors.accent, fontFamily: typography.fontFamily.medium },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  toggleLabel: { flex: 1, gap: 2 },
  toggleTitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  toggleSub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
});

// ---------------------------------------------------------------------------
// AddDeckModal
// ---------------------------------------------------------------------------

function AddDeckModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { mutate: createDeck, isPending } = useCreateDeck();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  function reset() {
    setName('');
    setUrl('');
    setUrlError('');
  }

  function validateUrl(raw: string): string {
    try {
      const host = new URL(raw).hostname.replace(/^www\./, '');
      const valid = Object.values(DECK_SITE_HOSTS).some(
        (h) => host === h || host.endsWith(`.${h}`),
      );
      return valid ? '' : 'Only Moxfield or Archidekt links are supported';
    } catch {
      return 'Enter a valid URL';
    }
  }

  function handleSave() {
    if (!name.trim()) {
      return;
    }
    if (url.trim()) {
      const err = validateUrl(url);
      if (err) {
        setUrlError(err);
        return;
      }
    }

    createDeck(
      { name: name.trim(), ...(url.trim() ? { url: url.trim() } : {}) },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
        onError: () => setUrlError('Failed to save. Check the URL and try again.'),
      },
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={reset}
      onRequestClose={onClose}
    >
      <SafeAreaView style={addDeck.safe}>
        <View style={modal.topBar}>
          <Pressable onPress={onClose} style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <Text style={modal.cancel}>Cancel</Text>
          </Pressable>
          <Text style={modal.title}>Add Deck</Text>
          <Pressable
            onPress={handleSave}
            disabled={isPending || !name.trim()}
            style={({ pressed }) => [modal.saveBtn, (pressed || !name.trim()) && { opacity: 0.6 }]}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Text style={modal.saveText}>Add</Text>
            )}
          </Pressable>
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={addDeck.scroll}
          keyboardShouldPersistTaps="handled"
          bottomOffset={spacing.xl}
        >
          <FormField label="Deck name">
            <TextInput
              style={form.input}
              value={name}
              onChangeText={setName}
              maxLength={64}
              placeholder="My Commander Deck"
              placeholderTextColor={colors.textTertiary}
            />
          </FormField>

          <FormField label="URL (optional)">
            <Text style={addDeck.hint}>Only Moxfield and Archidekt links are supported</Text>
            <TextInput
              style={[form.input, urlError ? addDeck.inputError : null]}
              value={url}
              onChangeText={(v) => {
                setUrl(v);
                setUrlError('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://moxfield.com/decks/..."
              placeholderTextColor={colors.textTertiary}
            />
            {urlError ? <Text style={addDeck.errorText}>{urlError}</Text> : null}
          </FormField>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const addDeck = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  hint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  inputError: { borderColor: colors.error },
  errorText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.error,
  },
});

// ---------------------------------------------------------------------------
// QuestsCard
// ---------------------------------------------------------------------------

function QuestRow({ item }: { item: ActiveQuest }) {
  const { accent } = useIdentityTheme();
  const { quest, progress, goal, completed } = item;
  const pct = Math.min(progress / goal, 1);

  return (
    <View style={qc.row}>
      <Text style={qc.icon}>{quest.icon}</Text>
      <View style={qc.body}>
        <View style={qc.titleRow}>
          <Text style={qc.title} numberOfLines={1}>
            {quest.title}
          </Text>
          {completed ? (
            <View style={qc.donePill}>
              <Text style={qc.doneText}>DONE</Text>
            </View>
          ) : (
            <Text style={qc.count}>
              {progress}/{goal}
            </Text>
          )}
        </View>
        {quest.description ? (
          <Text style={qc.sub} numberOfLines={1}>
            {quest.description}
          </Text>
        ) : null}
        <View style={qc.barBg}>
          <View
            style={[
              qc.barFill,
              {
                width: `${Math.round(pct * 100)}%` as `${number}%`,
                backgroundColor: completed ? colors.success : accent,
              },
            ]}
          />
        </View>
        {quest.rewardBadge ? (
          <Text style={qc.reward} numberOfLines={1}>
            Reward: {quest.rewardBadge.icon} {quest.rewardBadge.name}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function _QuestsCard() {
  const { data: quests, isLoading } = useQuests();

  if (isLoading) {
    return (
      <View style={section.card}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!quests?.length) return null;

  const done = quests.filter((q) => q.completed).length;

  return (
    <View style={section.card}>
      <View style={section.cardHeader}>
        <Text style={section.heading}>This month's quests</Text>
        <Text style={qc.summary}>
          {done}/{quests.length} done
        </Text>
      </View>
      {quests.map((q, i) => (
        <View key={q.quest.id} style={i > 0 ? qc.divider : undefined}>
          <QuestRow item={q} />
        </View>
      ))}
    </View>
  );
}

const qc = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  icon: { fontSize: 28, lineHeight: 36, marginTop: 2 },
  body: { flex: 1, gap: spacing.xs },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  count: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  donePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.success + '25',
    borderRadius: radii.full,
    flexShrink: 0,
  },
  doneText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.success,
    letterSpacing: 0.5,
  },
  barBg: {
    height: 5,
    backgroundColor: colors.borderLight,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  barFill: {
    height: 5,
    borderRadius: radii.full,
  },
  reward: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  summary: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
});

// ---------------------------------------------------------------------------
// GameRecordCard
// ---------------------------------------------------------------------------

function WinRateStat({ winRate }: { winRate: number }) {
  const { gradient, onAccent } = useIdentityTheme();
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);

  return (
    <View
      style={[gr.stat, gr.winRateStat]}
      onLayout={(e) => {
        setW(e.nativeEvent.layout.width);
        setH(e.nativeEvent.layout.height);
      }}
    >
      {w > 0 && h > 0 && (
        <Svg style={StyleSheet.absoluteFill} width={w} height={h}>
          <Defs>
            <SvgLinearGradient id="wrGrad" x1="0" y1="0" x2="1" y2="1">
              {gradient.map((c, i) => (
                <Stop key={i} offset={`${i / Math.max(1, gradient.length - 1)}`} stopColor={c} />
              ))}
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width={w} height={h} rx={radii.md} ry={radii.md} fill="url(#wrGrad)" />
        </Svg>
      )}
      <Text style={[gr.statValue, { color: onAccent }]}>{Math.round(winRate * 100)}%</Text>
      <Text style={[gr.statLabel, { color: onAccent + 'CC' }]}>Win rate</Text>
    </View>
  );
}

function GameRecordCard({ stats }: { stats: GameStats }) {
  const { accent } = useIdentityTheme();
  if (stats.games === 0) return null;

  return (
    <View style={[section.card, { paddingHorizontal: 0, paddingVertical: spacing.lg }]}>
      <Text style={[section.heading, { paddingHorizontal: spacing.xl }]}>Game record</Text>

      <View style={gr.statsRow}>
        <View style={gr.stat}>
          <Text style={gr.statValue}>{stats.wins}W</Text>
          <Text style={gr.statLabel}>Wins</Text>
        </View>
        <View style={gr.statDivider} />
        <View style={gr.stat}>
          <Text style={gr.statValue}>{stats.losses}L</Text>
          <Text style={gr.statLabel}>Losses</Text>
        </View>
        <View style={gr.statDivider} />
        <WinRateStat winRate={stats.winRate} />
      </View>

      {stats.byDeck.length > 0 && (
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
          <Text
            style={[section.heading, { fontSize: typography.fontSize.sm, marginTop: spacing.xs }]}
          >
            By deck
          </Text>
          {stats.byDeck.slice(0, 5).map((d) => {
            const total = d.wins + d.losses;
            const pct = total > 0 ? d.wins / total : 0;
            return (
              <View key={d.deck} style={gr.deckRow}>
                <Text style={gr.deckName} numberOfLines={1}>
                  {d.deck}
                </Text>
                <View style={gr.barBg}>
                  <View
                    style={[
                      gr.barFill,
                      {
                        width: `${Math.round(pct * 100)}%` as `${number}%`,
                        backgroundColor: accent,
                      },
                    ]}
                  />
                </View>
                <Text style={gr.deckRecord}>
                  {d.wins}–{d.losses}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const gr = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm },
  winRateStat: {
    borderRadius: radii.md,
    overflow: 'hidden',
    paddingVertical: spacing.md,
  },
  statValue: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.sm,
  },
  deckRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deckName: {
    flex: 1,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  barBg: {
    width: 80,
    height: 6,
    backgroundColor: colors.borderLight,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: radii.full,
  },
  deckRecord: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    width: 36,
    textAlign: 'right',
  },
});

// ---------------------------------------------------------------------------
// RecentGamesCard
// ---------------------------------------------------------------------------

function gameResultLabel(game: Game, myId: string): { label: string; color: string } {
  if (game.winnerId === myId) return { label: 'W', color: colors.success };
  return { label: 'L', color: colors.error };
}

function RecentGamesCard({ myId }: { myId: string }) {
  const { data: games = [], isLoading } = useMyGames(8);

  if (isLoading) {
    return (
      <View style={section.card}>
        <Text style={section.heading}>Recent games</Text>
        <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.sm }} />
      </View>
    );
  }

  if (games.length === 0) return null;

  return (
    <View style={section.card}>
      <Text style={section.heading}>Recent games</Text>
      {games.map((game, i) => {
        const { label, color } = gameResultLabel(game, myId);
        const opponents = game.players.filter((p) => p.userId !== myId);
        const myPlayer = game.players.find((p) => p.userId === myId);
        return (
          <View key={game.id} style={[rg.row, i < games.length - 1 && rg.rowBorder]}>
            <View style={[rg.result, { backgroundColor: color + '20' }]}>
              <Text style={[rg.resultText, { color }]}>{label}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={rg.opponents} numberOfLines={1}>
                vs {opponents.map((p) => p.displayName).join(', ')}
              </Text>
              {myPlayer?.deck ? (
                <Text style={rg.deck} numberOfLines={1}>
                  {myPlayer.deck}
                </Text>
              ) : null}
            </View>
            <Text style={rg.date}>
              {new Date(game.confirmedAt ?? game.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const rg = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  result: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
  },
  opponents: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  deck: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  date: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    flexShrink: 0,
  },
});

// ---------------------------------------------------------------------------
// RivalriesCard
// ---------------------------------------------------------------------------

function RivalryRow({ item, isLast }: { item: Rivalry; isLast: boolean }) {
  return (
    <View style={[rv.row, !isLast && rv.rowBorder]}>
      <View style={rv.avatar}>
        <Text style={rv.avatarText}>{item.displayName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={rv.info}>
        <View style={rv.nameRow}>
          <Text style={rv.name} numberOfLines={1}>
            {item.displayName}
          </Text>
          {item.hot && <Text style={rv.flame}>🔥</Text>}
        </View>
        <Text style={rv.sub}>
          {item.gamesTogether} game{item.gamesTogether !== 1 ? 's' : ''} together
        </Text>
      </View>
      <View style={rv.recordBadge}>
        <Text style={rv.recordText}>{item.record}</Text>
      </View>
    </View>
  );
}

function RivalriesCard() {
  const { data: rivalries, isLoading } = useRivalries(5);

  if (isLoading || !rivalries?.length) return null;

  return (
    <View style={[section.card, { paddingHorizontal: 0, paddingVertical: spacing.lg }]}>
      <Text style={[section.heading, { paddingHorizontal: spacing.xl }]}>Rivalries</Text>
      {rivalries.map((r, i) => (
        <RivalryRow key={r.opponentId} item={r} isLast={i === rivalries.length - 1} />
      ))}
    </View>
  );
}

const rv = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radii.avatar,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.accent,
  },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  flame: { fontSize: 14 },
  sub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  recordBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.borderLight,
    borderRadius: radii.full,
    flexShrink: 0,
  },
  recordText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
});

function AccountActionsCard() {
  const { signOut } = useAuth();
  const exportData = useExportAccountData();
  const deleteAccount = useDeleteAccount();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleExport = () => {
    exportData.mutate(undefined, {
      onSuccess: (data) => {
        void Share.share({
          title: 'ManaMap data export',
          message: JSON.stringify(data, null, 2),
        });
      },
      onError: () => {
        Alert.alert("Couldn't export your data", 'Please try again in a moment.');
      },
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete your account?',
      "This permanently removes your profile, check-ins, streaks, badges, decks, and connections. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account',
          style: 'destructive',
          onPress: () => {
            deleteAccount.mutate(undefined, {
              onSuccess: () => void signOut(),
              onError: () => {
                Alert.alert("Couldn't delete your account", 'Please try again in a moment.');
              },
            });
          },
        },
      ],
    );
  };

  return (
    <View style={[section.card, { paddingHorizontal: 0, paddingVertical: spacing.sm, gap: 0 }]}>
      <Pressable
        style={({ pressed }) => [accountActions.row, pressed && styles.pressed]}
        onPress={() => navigation.navigate('Legal', { doc: 'terms' })}
      >
        <Text style={accountActions.label}>Terms of Service</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </Pressable>
      <Pressable
        style={({ pressed }) => [accountActions.row, pressed && styles.pressed]}
        onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}
      >
        <Text style={accountActions.label}>Privacy Policy</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </Pressable>
      <Pressable
        style={({ pressed }) => [accountActions.row, pressed && styles.pressed]}
        onPress={handleExport}
        disabled={exportData.isPending}
      >
        <Text style={accountActions.label}>Export my data</Text>
        {exportData.isPending ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        )}
      </Pressable>
      <Pressable
        style={({ pressed }) => [accountActions.row, pressed && styles.pressed]}
        onPress={handleDelete}
        disabled={deleteAccount.isPending}
      >
        <Text style={[accountActions.label, accountActions.dangerLabel]}>Delete my account</Text>
        {deleteAccount.isPending ? (
          <ActivityIndicator size="small" color={colors.error} />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.error} />
        )}
      </Pressable>
    </View>
  );
}

const accountActions = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  label: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  dangerLabel: { color: colors.error },
});

// ---------------------------------------------------------------------------
// YouScreen
// ---------------------------------------------------------------------------

export function YouScreen() {
  const { signOut } = useAuth();
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile();
  const { data: privacy, isLoading: privacyLoading } = usePrivacy();
  const { data: gameStats } = useMyGameStats();
  const { accent } = useIdentityTheme();
  const [editOpen, setEditOpen] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (profileError || !profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Couldn't load profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Pressable
            onLongPress={__DEV__ ? () => navigation.navigate('Dev') : undefined}
            delayLongPress={800}
          >
            <Text style={styles.title}>Your Profile</Text>
          </Pressable>
        </View>
        <BellButton />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <IdentityHero profile={profile} onEdit={() => setEditOpen(true)} />

        <SocialsCard mode="owner" />

        {privacyLoading ? (
          <View style={[section.card, { alignItems: 'center' }]}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : privacy ? (
          <PrivacyCard privacy={privacy} />
        ) : null}

        <BlockedPlayersCard />

        <DecksCard />

        <TradeListCard profile={profile} />

        <HomeStoreRow />

        <RewardsCard />

        {gameStats && <GameRecordCard stats={gameStats} />}

        <RecentGamesCard myId={profile.id} />

        <RivalriesCard />

        <AccountActionsCard />

        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
          onPress={signOut}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <EditProfileModal visible={editOpen} profile={profile} onClose={() => setEditOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backBtn: {
    marginLeft: -4,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
    letterSpacing: -0.48,
    color: colors.textPrimary,
  },
  scroll: { paddingBottom: spacing.xxxl },
  errorText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  signOutBtn: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    height: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  signOutText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
});

// Hidden quest feature — see README "Hidden / future features"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type _HiddenQuestFeature = typeof _QuestsCard;
