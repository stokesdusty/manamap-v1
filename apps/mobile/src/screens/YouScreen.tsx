import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { DeckSite, ManaColor, MtgFormat, PlayerVibe, Privacy, Profile } from '@manamap/shared';
import { DECK_SITE_HOSTS } from '@manamap/shared';
import { useAuth } from '../context/AuthContext';
import { ManaPip } from '../components/ManaPip';
import { colors, radii, shadows, spacing, typography } from '../theme';
import {
  useCreateDeck,
  useDecks,
  useDeleteDeck,
  usePrivacy,
  useProfile,
  useUpdatePrivacy,
  useUpdateProfile,
} from '../hooks/useMe';

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
// ProfileCard
// ---------------------------------------------------------------------------

function ProfileCard({
  profile,
  onEdit,
}: {
  profile: Profile;
  onEdit: () => void;
}) {
  return (
    <View style={card.root}>
      <View style={card.header}>
        <View style={card.avatarWrap}>
          <View style={card.avatar}>
            <Text style={card.avatarText}>
              {profile.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          {profile.avatarColors.length > 0 && (
            <View style={card.pips}>
              {profile.avatarColors.map((c) => (
                <ManaPip key={c} color={c} size={16} />
              ))}
            </View>
          )}
        </View>

        <View style={card.nameBlock}>
          <Text style={card.displayName} numberOfLines={1}>
            {profile.displayName}
          </Text>
          {profile.pronouns ? (
            <Text style={card.pronouns}>{profile.pronouns}</Text>
          ) : null}
          {profile.vibe ? (
            <View style={card.vibePill}>
              <Text style={card.vibeText}>{VIBE_LABELS[profile.vibe as PlayerVibe]}</Text>
            </View>
          ) : null}
        </View>

        <Pressable style={({ pressed }) => [card.editBtn, pressed && { opacity: 0.6 }]} onPress={onEdit}>
          <Ionicons name="pencil-outline" size={16} color={colors.accent} />
          <Text style={card.editText}>Edit</Text>
        </Pressable>
      </View>

      {profile.commander ? (
        <View style={card.row}>
          <Ionicons name="shield-outline" size={14} color={colors.textTertiary} />
          <Text style={card.rowText} numberOfLines={1}>
            {profile.commander}
          </Text>
          {profile.powerLevel != null && (
            <View style={card.powerBadge}>
              <Text style={card.powerText}>P{profile.powerLevel}</Text>
            </View>
          )}
        </View>
      ) : null}

      {profile.formats.length > 0 && (
        <View style={card.chips}>
          {profile.formats.map((f) => (
            <View key={f} style={card.chip}>
              <Text style={card.chipText}>{FORMAT_LABELS[f as MtgFormat]}</Text>
            </View>
          ))}
        </View>
      )}

      {profile.bio ? (
        <Text style={card.bio} numberOfLines={4}>
          {profile.bio}
        </Text>
      ) : null}
    </View>
  );
}

const card = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.md,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  avatarWrap: { alignItems: 'center', gap: spacing.xs },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.accent,
  },
  pips: { flexDirection: 'row', gap: 2 },
  nameBlock: { flex: 1, gap: 2 },
  displayName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  pronouns: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  vibePill: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.accentLight,
    borderRadius: radii.full,
  },
  vibeText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.accent,
  },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 2 },
  editText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
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
  },
});

// ---------------------------------------------------------------------------
// PrivacyCard
// ---------------------------------------------------------------------------

function PrivacyCard({ privacy }: { privacy: Privacy }) {
  const { mutate } = useUpdatePrivacy();

  const rows: Array<{ key: keyof Privacy; label: string; sub?: string }> = [
    { key: 'discoverable', label: 'Discoverable', sub: 'Appear in nearby player search' },
    { key: 'showDiscord', label: 'Show Discord', sub: 'Visible to your connections' },
    { key: 'showDecks', label: 'Show decks', sub: 'Share your deck list publicly' },
    { key: 'showMetHistory', label: 'Show met history', sub: "Others can see who you've played" },
  ];

  return (
    <View style={section.card}>
      <Text style={section.heading}>Privacy</Text>
      {rows.map((row, i) => (
        <View key={row.key} style={[section.privacyRow, i < rows.length - 1 && section.rowBorder]}>
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

      {isLoading && <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.md }} />}

      {!isLoading && decks.length === 0 && (
        <Text style={section.empty}>No decks added yet</Text>
      )}

      {decks.map((deck) => (
        <View key={deck.id} style={section.deckRow}>
          <View style={section.deckInfo}>
            <Text style={section.deckSite}>{SITE_LABELS[deck.site]}</Text>
            <Text style={section.deckName} numberOfLines={1}>
              {deck.name}
            </Text>
            <Text style={section.deckUrl} numberOfLines={1}>
              {deck.url}
            </Text>
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
// HomeStoreRow
// ---------------------------------------------------------------------------

function HomeStoreRow() {
  return (
    <View style={section.card}>
      <View style={section.storeRow}>
        <Ionicons name="storefront-outline" size={20} color={colors.textTertiary} />
        <View style={{ flex: 1 }}>
          <Text style={section.storeTitle}>Home store</Text>
          <Text style={section.storeSub}>Not set</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </View>
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
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  addText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
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
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  storeTitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  storeSub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
});

// ---------------------------------------------------------------------------
// EditProfileModal
// ---------------------------------------------------------------------------

type ProfileDraft = {
  displayName: string;
  pronouns: string;
  bio: string;
  avatarColors: ManaColor[];
  commander: string;
  powerLevel: string;
  vibe: PlayerVibe | '';
  formats: MtgFormat[];
};

function draftFromProfile(p: Profile): ProfileDraft {
  return {
    displayName: p.displayName,
    pronouns: p.pronouns ?? '',
    bio: p.bio ?? '',
    avatarColors: p.avatarColors as ManaColor[],
    commander: p.commander ?? '',
    powerLevel: p.powerLevel != null ? String(p.powerLevel) : '',
    vibe: (p.vibe as PlayerVibe) ?? '',
    formats: p.formats as MtgFormat[],
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
      draft.formats.includes(f)
        ? draft.formats.filter((x) => x !== f)
        : [...draft.formats, f],
    );
  }

  function handleSave() {
    const level = parseInt(draft.powerLevel, 10);
    update(
      {
        displayName: draft.displayName.trim() || profile.displayName,
        pronouns: draft.pronouns.trim() || null,
        bio: draft.bio.trim() || null,
        avatarColors: draft.avatarColors,
        commander: draft.commander.trim() || null,
        powerLevel: Number.isInteger(level) && level >= 1 && level <= 10 ? level : null,
        vibe: draft.vibe || null,
        formats: draft.formats,
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

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={modal.scroll}
            keyboardShouldPersistTaps="handled"
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

            <FormField label="Commander">
              <TextInput
                style={form.input}
                value={draft.commander}
                onChangeText={(v) => set('commander', v)}
                maxLength={128}
                placeholder="e.g. Atraxa, Praetors' Voice"
                placeholderTextColor={colors.textTertiary}
              />
            </FormField>

            <FormField label="Power level (1–10)">
              <TextInput
                style={[form.input, { width: 80 }]}
                value={draft.powerLevel}
                onChangeText={(v) => set('powerLevel', v.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="—"
                placeholderTextColor={colors.textTertiary}
              />
            </FormField>

            <FormField label="Vibe">
              <View style={form.chips}>
                {ALL_VIBES.map((v) => {
                  const active = draft.vibe === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => set('vibe', active ? '' : v)}
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
          </ScrollView>
        </KeyboardAvoidingView>
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
});

// ---------------------------------------------------------------------------
// AddDeckModal
// ---------------------------------------------------------------------------

function AddDeckModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { mutate: createDeck, isPending } = useCreateDeck();
  const [site, setSite] = useState<DeckSite>('moxfield');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  function reset() {
    setSite('moxfield');
    setName('');
    setUrl('');
    setUrlError('');
  }

  function validateUrl(raw: string): string {
    try {
      const host = new URL(raw).hostname.replace(/^www\./, '');
      const expected = DECK_SITE_HOSTS[site];
      if (host !== expected && !host.endsWith(`.${expected}`)) {
        return `URL must be a ${expected} link`;
      }
      return '';
    } catch {
      return 'Enter a valid URL';
    }
  }

  function handleSave() {
    const err = validateUrl(url);
    if (err) { setUrlError(err); return; }
    if (!name.trim()) { return; }

    createDeck(
      { site, name: name.trim(), url: url.trim() },
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
            style={({ pressed }) => [
              modal.saveBtn,
              (pressed || !name.trim()) && { opacity: 0.6 },
            ]}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Text style={modal.saveText}>Add</Text>
            )}
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={addDeck.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <FormField label="Site">
              <View style={addDeck.siteRow}>
                {(['moxfield', 'archidekt'] as DeckSite[]).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => { setSite(s); setUrlError(''); }}
                    style={[addDeck.siteBtn, site === s && addDeck.siteBtnActive]}
                  >
                    <Text style={[addDeck.siteBtnText, site === s && addDeck.siteBtnTextActive]}>
                      {SITE_LABELS[s]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </FormField>

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

            <FormField label="URL">
              <TextInput
                style={[form.input, urlError ? addDeck.inputError : null]}
                value={url}
                onChangeText={(v) => { setUrl(v); setUrlError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder={`https://${DECK_SITE_HOSTS[site]}/decks/...`}
                placeholderTextColor={colors.textTertiary}
              />
              {urlError ? <Text style={addDeck.errorText}>{urlError}</Text> : null}
            </FormField>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const addDeck = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  siteRow: { flexDirection: 'row', gap: spacing.sm },
  siteBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  siteBtnActive: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  siteBtnText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  siteBtnTextActive: { color: colors.accent },
  inputError: { borderColor: colors.error },
  errorText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.error,
  },
});

// ---------------------------------------------------------------------------
// YouScreen
// ---------------------------------------------------------------------------

export function YouScreen() {
  const { signOut } = useAuth();
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile();
  const { data: privacy, isLoading: privacyLoading } = usePrivacy();
  const [editOpen, setEditOpen] = useState(false);

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
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
        <Text style={styles.title}>You</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ProfileCard profile={profile} onEdit={() => setEditOpen(true)} />

        {privacyLoading ? (
          <View style={[section.card, { alignItems: 'center' }]}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : privacy ? (
          <PrivacyCard privacy={privacy} />
        ) : null}

        <DecksCard />

        <HomeStoreRow />

        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
          onPress={signOut}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <EditProfileModal
        visible={editOpen}
        profile={profile}
        onClose={() => setEditOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
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
