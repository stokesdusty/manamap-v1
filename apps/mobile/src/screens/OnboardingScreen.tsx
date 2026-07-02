import React, { useEffect, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ManaColor, MtgFormat, PlayerVibe, SocialPlatform } from '@manamap/shared';
import { DECK_SITE_HOSTS } from '@manamap/shared';
import { Avatar } from '../components/Avatar';
import { ManaPip } from '../components/ManaPip';
import { ALL_PLATFORMS, SOCIAL_META, socialKeyboardType } from '../components/SocialsCard';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { useSubmitOnboarding } from '../hooks/useMe';
import { useStores } from '../hooks/useNearby';
import { useAddSocial, useSocials, useUpdateSocial } from '../hooks/useSocials';

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

const GUILD_NAMES: Record<string, string> = {
  W: 'Plains Walker',
  U: 'Island Mage',
  B: 'Swamp Lurker',
  R: 'Mountain Berserker',
  G: 'Forest Druid',
  WU: 'Azorius Senator',
  WB: 'Orzhov Syndic',
  UB: 'Dimir Operative',
  UR: 'Izzet Researcher',
  BR: 'Rakdos Showman',
  RG: 'Gruul Warrior',
  GW: 'Selesnya Conclave',
  BG: 'Golgari Shaman',
  RW: 'Boros Legionary',
  GU: 'Simic Biologist',
  WUB: 'Esper Sphinx',
  UBR: 'Grixis Demon',
  BRG: 'Jund Savage',
  RGW: 'Naya Beast',
  GWU: 'Bant Knight',
  WBG: 'Abzan Clan',
  URW: 'Jeskai Monk',
  BGU: 'Sultai Brood',
  RWB: 'Mardu Warrior',
  GUR: 'Temur Shaman',
  WUBRG: 'Five-Color Mage',
};

function guildName(cs: ManaColor[]): string {
  if (cs.length === 0) return 'Colorless Mage';
  const key = [...cs].sort().join('');
  return GUILD_NAMES[key] ?? GUILD_NAMES[cs.join('')] ?? `${cs.join('')} Mage`;
}

// ---------------------------------------------------------------------------
// Draft state
// ---------------------------------------------------------------------------

type DeckDraft = { name: string; url?: string };

type Draft = {
  name: string;
  shareNameWithContacts: boolean;
  displayName: string;
  pronouns: string;
  avatarColors: ManaColor[];
  formats: MtgFormat[];
  commander: string;
  vibes: PlayerVibe[];
  bio: string;
  socials: Partial<Record<SocialPlatform, string>>;
  discoverable: boolean;
  decks: DeckDraft[];
  homeStoreId: string | null;
  homeStoreName: string | null;
};

type DraftAction =
  | { type: 'SET'; key: keyof Draft; value: Draft[keyof Draft] }
  | { type: 'TOGGLE_COLOR'; color: ManaColor }
  | { type: 'TOGGLE_FORMAT'; format: MtgFormat }
  | { type: 'TOGGLE_VIBE'; vibe: PlayerVibe }
  | { type: 'ADD_DECK'; deck: DeckDraft }
  | { type: 'REMOVE_DECK'; index: number };

function draftReducer(state: Draft, action: DraftAction): Draft {
  switch (action.type) {
    case 'SET':
      return { ...state, [action.key]: action.value };
    case 'TOGGLE_COLOR': {
      const has = state.avatarColors.includes(action.color);
      return {
        ...state,
        avatarColors: has
          ? state.avatarColors.filter((c) => c !== action.color)
          : [...state.avatarColors, action.color],
      };
    }
    case 'TOGGLE_FORMAT': {
      const has = state.formats.includes(action.format);
      return {
        ...state,
        formats: has
          ? state.formats.filter((f) => f !== action.format)
          : [...state.formats, action.format],
      };
    }
    case 'TOGGLE_VIBE': {
      const has = state.vibes.includes(action.vibe);
      return {
        ...state,
        vibes: has ? state.vibes.filter((v) => v !== action.vibe) : [...state.vibes, action.vibe],
      };
    }
    case 'ADD_DECK':
      return { ...state, decks: [...state.decks, action.deck] };
    case 'REMOVE_DECK':
      return { ...state, decks: state.decks.filter((_, i) => i !== action.index) };
    default:
      return state;
  }
}

const INITIAL_DRAFT: Draft = {
  name: '',
  shareNameWithContacts: false,
  displayName: '',
  pronouns: '',
  avatarColors: [],
  formats: [],
  commander: '',
  vibes: [],
  bio: '',
  socials: {},
  discoverable: true,
  decks: [],
  homeStoreId: null,
  homeStoreName: null,
};

// ---------------------------------------------------------------------------
// Preview card
// ---------------------------------------------------------------------------

function PreviewCard({ draft }: { draft: Draft }) {
  const name = draft.displayName.trim() || 'Your Name';
  const comboName = guildName(draft.avatarColors);

  return (
    <View style={preview.root}>
      <View style={preview.header}>
        <Avatar name={name} manaColors={draft.avatarColors} size={56} />
        <View style={preview.nameBlock}>
          <Text style={preview.name} numberOfLines={1}>
            {name}
          </Text>
          {draft.pronouns.trim() ? (
            <Text style={preview.pronouns} numberOfLines={1} ellipsizeMode="tail">
              {draft.pronouns.trim()}
            </Text>
          ) : null}
          <View style={preview.comboRow}>
            {draft.avatarColors.map((c) => (
              <ManaPip key={c} color={c} size={14} showLetter={false} ring={false} />
            ))}
            {draft.avatarColors.length > 0 && (
              <Text style={preview.comboName} numberOfLines={1} ellipsizeMode="tail">
                {comboName}
              </Text>
            )}
          </View>
        </View>
      </View>

      {draft.vibes.length > 0 && (
        <View style={preview.vibeRow}>
          {draft.vibes.map((v) => (
            <View key={v} style={preview.vibePill}>
              <Text style={preview.vibeText}>{VIBE_LABELS[v]}</Text>
            </View>
          ))}
        </View>
      )}

      {draft.formats.length > 0 && (
        <View style={preview.chips}>
          {draft.formats.slice(0, 4).map((f) => (
            <View key={f} style={preview.chip}>
              <Text style={preview.chipText}>{FORMAT_LABELS[f]}</Text>
            </View>
          ))}
          {draft.formats.length > 4 && (
            <View style={preview.chip}>
              <Text style={preview.chipText}>+{draft.formats.length - 4}</Text>
            </View>
          )}
        </View>
      )}

      {draft.commander.trim() ? (
        <View style={preview.commanderRow}>
          <Ionicons name="shield-outline" size={12} color={colors.textTertiary} />
          <Text style={preview.commanderText} numberOfLines={1}>
            {draft.commander.trim()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const preview = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  nameBlock: { flex: 1, gap: 2 },
  name: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 19,
    color: colors.textPrimary,
    letterSpacing: -0.38,
  },
  pronouns: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  comboRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  comboName: {
    flexShrink: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginLeft: 2,
  },
  vibeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  vibePill: {
    alignSelf: 'flex-start',
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.chipBg,
    borderRadius: radii.full,
  },
  chipText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.chipFg,
  },
  commanderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  commanderText: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
});

// ---------------------------------------------------------------------------
// Step 1 — Name + pronouns
// ---------------------------------------------------------------------------

function Step1({ draft, dispatch }: { draft: Draft; dispatch: React.Dispatch<DraftAction> }) {
  return (
    <KeyboardAwareScrollView
      contentContainerStyle={step.scroll}
      keyboardShouldPersistTaps="handled"
      bottomOffset={spacing.xl}
    >
      <Text style={step.heading}>What should we call you?</Text>
      <Text style={step.sub}>
        Your display name is how other players see you in Magic contexts.
      </Text>

      <View style={step.field}>
        <Text style={step.label}>Display name</Text>
        <TextInput
          style={step.input}
          value={draft.displayName}
          onChangeText={(v) => dispatch({ type: 'SET', key: 'displayName', value: v })}
          maxLength={64}
          placeholder="e.g. Jace Beleren"
          placeholderTextColor={colors.textTertiary}
          autoFocus
          autoCapitalize="words"
          accessibilityLabel="Display name"
        />
      </View>

      <View style={step.field}>
        <Text style={step.label}>
          Pronouns <Text style={step.optional}>(optional)</Text>
        </Text>
        <TextInput
          style={step.input}
          value={draft.pronouns}
          onChangeText={(v) => dispatch({ type: 'SET', key: 'pronouns', value: v })}
          maxLength={32}
          placeholder="e.g. they/them"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Pronouns"
        />
      </View>

      <View style={step.field}>
        <Text style={step.label}>
          Real / chosen name <Text style={step.optional}>(optional)</Text>
        </Text>
        <TextInput
          style={step.input}
          value={draft.name}
          onChangeText={(v) => dispatch({ type: 'SET', key: 'name', value: v })}
          maxLength={80}
          placeholder="e.g. Alex Smith or Alex S."
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="words"
          accessibilityLabel="Real or chosen name"
        />
        {draft.name.trim().length > 0 && (
          <View style={step.nameShareRow}>
            <View style={{ flex: 1 }}>
              <Text style={step.nameShareTitle}>Share with contacts</Text>
              <Text style={step.nameShareSub}>Your connections can see this name</Text>
            </View>
            <Switch
              value={draft.shareNameWithContacts}
              onValueChange={(v) =>
                dispatch({ type: 'SET', key: 'shareNameWithContacts', value: v })
              }
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.surface}
              accessibilityLabel="Share with contacts"
            />
          </View>
        )}
      </View>
    </KeyboardAwareScrollView>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Color identity
// ---------------------------------------------------------------------------

function Step2({ draft, dispatch }: { draft: Draft; dispatch: React.Dispatch<DraftAction> }) {
  return (
    <ScrollView contentContainerStyle={step.scroll}>
      <Text style={step.heading}>Pick your colors</Text>
      <Text style={step.sub}>Your color identity shows how you think about Magic.</Text>

      <View style={step.pipRow}>
        {MANA_COLORS.map((c) => {
          const active = draft.avatarColors.includes(c);
          return (
            <Pressable
              key={c}
              onPress={() => dispatch({ type: 'TOGGLE_COLOR', color: c })}
              style={[step.pipBtn, !active && step.pipBtnInactive]}
              accessibilityRole="button"
              accessibilityLabel={c}
              accessibilityState={{ selected: active }}
            >
              <ManaPip color={c} size={48} />
              {active && (
                <View style={step.pipCheck}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {draft.avatarColors.length > 0 && (
        <View style={step.guildRow}>
          <Text style={step.guildName}>{guildName(draft.avatarColors)}</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Play style
// ---------------------------------------------------------------------------

function Step3({ draft, dispatch }: { draft: Draft; dispatch: React.Dispatch<DraftAction> }) {
  return (
    <KeyboardAwareScrollView
      contentContainerStyle={step.scroll}
      keyboardShouldPersistTaps="handled"
      bottomOffset={spacing.xl}
    >
      <Text style={step.heading}>How do you play?</Text>
      <Text style={step.sub}>Help others find the right game with you.</Text>

      <View style={step.field}>
        <Text style={step.label}>
          Formats <Text style={step.required}>*</Text>
        </Text>
        <View style={step.chips}>
          {ALL_FORMATS.map((f) => {
            const active = draft.formats.includes(f);
            return (
              <Pressable
                key={f}
                onPress={() => dispatch({ type: 'TOGGLE_FORMAT', format: f })}
                style={[step.chip, active && step.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[step.chipText, active && step.chipTextActive]}>
                  {FORMAT_LABELS[f]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={step.field}>
        <Text style={step.label}>
          Vibe <Text style={step.optional}>(optional, select all that apply)</Text>
        </Text>
        <View style={step.chips}>
          {ALL_VIBES.map((v) => {
            const active = draft.vibes.includes(v);
            return (
              <Pressable
                key={v}
                onPress={() => dispatch({ type: 'TOGGLE_VIBE', vibe: v })}
                style={[step.chip, active && step.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[step.chipText, active && step.chipTextActive]}>{VIBE_LABELS[v]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={step.field}>
        <Text style={step.label}>
          Favorite Commander <Text style={step.optional}>(optional)</Text>
        </Text>
        <TextInput
          style={step.input}
          value={draft.commander}
          onChangeText={(v) => dispatch({ type: 'SET', key: 'commander', value: v })}
          maxLength={128}
          placeholder="e.g. Atraxa, Praetors' Voice"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Favorite Commander"
        />
      </View>
    </KeyboardAwareScrollView>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Decks (skippable)
// ---------------------------------------------------------------------------

function Step4({ draft, dispatch }: { draft: Draft; dispatch: React.Dispatch<DraftAction> }) {
  const [showAddDeck, setShowAddDeck] = useState(false);
  const [deckName, setDeckName] = useState('');
  const [deckUrl, setDeckUrl] = useState('');
  const [deckUrlError, setDeckUrlError] = useState('');

  function addDeck() {
    if (!deckName.trim()) return;
    if (deckUrl.trim()) {
      try {
        const host = new URL(deckUrl).hostname.replace(/^www\./, '');
        const valid = Object.values(DECK_SITE_HOSTS).some(
          (h) => host === h || host.endsWith(`.${h}`),
        );
        if (!valid) {
          setDeckUrlError('Only Moxfield or Archidekt links are supported');
          return;
        }
      } catch {
        setDeckUrlError('Enter a valid URL');
        return;
      }
    }
    dispatch({
      type: 'ADD_DECK',
      deck: { name: deckName.trim(), ...(deckUrl.trim() ? { url: deckUrl.trim() } : {}) },
    });
    setDeckName('');
    setDeckUrl('');
    setDeckUrlError('');
    setShowAddDeck(false);
  }

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={step.scroll}
      keyboardShouldPersistTaps="handled"
      bottomOffset={spacing.xl}
    >
      <Text style={step.heading}>How do people reach you?</Text>
      <Text style={step.sub}>Shared only after you both approve a connection.</Text>

      {ALL_PLATFORMS.map((platform) => {
        const meta = SOCIAL_META[platform];
        return (
          <View key={platform} style={step.field}>
            <Text style={step.label}>
              {meta.label} <Text style={step.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={step.input}
              value={draft.socials[platform] ?? ''}
              onChangeText={(v) =>
                dispatch({
                  type: 'SET',
                  key: 'socials',
                  value: { ...draft.socials, [platform]: v },
                })
              }
              maxLength={256}
              placeholder={meta.placeholder}
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={socialKeyboardType(platform)}
              accessibilityLabel={meta.label}
            />
          </View>
        );
      })}

      {draft.decks.length > 0 && (
        <View style={step.deckList}>
          {draft.decks.map((d, i) => (
            <View key={i} style={step.deckRow}>
              <View style={{ flex: 1 }}>
                <Text style={step.deckName} numberOfLines={1}>
                  {d.name}
                </Text>
                {d.url && (
                  <Text style={step.deckSite} numberOfLines={1}>
                    {d.url}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => dispatch({ type: 'REMOVE_DECK', index: i })}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${d.name}`}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Text style={[step.label, { marginBottom: spacing.sm }]}>
        Deck links <Text style={step.optional}>(optional)</Text>
      </Text>

      {!showAddDeck ? (
        <Pressable
          style={({ pressed }) => [step.addDeckBtn, pressed && { opacity: 0.7 }]}
          onPress={() => setShowAddDeck(true)}
          accessibilityRole="button"
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
          <Text style={step.addDeckText}>Add a deck link</Text>
        </Pressable>
      ) : (
        <View style={step.addDeckForm}>
          <TextInput
            style={step.input}
            value={deckName}
            onChangeText={setDeckName}
            maxLength={64}
            placeholder="Deck name"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Deck name"
          />
          <TextInput
            style={[step.input, deckUrlError ? step.inputError : null]}
            value={deckUrl}
            onChangeText={(v) => {
              setDeckUrl(v);
              setDeckUrlError('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="URL (optional) — Moxfield or Archidekt only"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Deck URL"
          />
          {deckUrlError ? <Text style={step.errorText}>{deckUrlError}</Text> : null}
          <View style={step.formBtns}>
            <Pressable
              style={({ pressed }) => [step.cancelBtn, pressed && { opacity: 0.6 }]}
              onPress={() => {
                setShowAddDeck(false);
                setDeckUrlError('');
              }}
              accessibilityRole="button"
            >
              <Text style={step.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                step.saveBtn,
                !deckName.trim() && step.saveBtnDisabled,
                pressed && { opacity: 0.7 },
              ]}
              onPress={addDeck}
              disabled={!deckName.trim()}
              accessibilityRole="button"
              accessibilityState={{ disabled: !deckName.trim() }}
            >
              <Text style={step.saveBtnText}>Add</Text>
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAwareScrollView>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Home store + discoverable
// ---------------------------------------------------------------------------

function Step5({ draft, dispatch }: { draft: Draft; dispatch: React.Dispatch<DraftAction> }) {
  const [query, setQuery] = useState('');
  const { data: stores = [], isLoading } = useStores(query.length >= 2 ? query : undefined);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[step.scroll, { paddingBottom: 0 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={step.heading}>Find your home store</Text>
        <Text style={step.sub}>
          Your home store appears on your card and helps others find you.
        </Text>

        {draft.homeStoreName && (
          <View style={step.selectedStore}>
            <Ionicons name="storefront" size={20} color={colors.accent} />
            <Text style={step.selectedStoreName} numberOfLines={1}>
              {draft.homeStoreName}
            </Text>
            <Pressable
              onPress={() => {
                dispatch({ type: 'SET', key: 'homeStoreId', value: null });
                dispatch({ type: 'SET', key: 'homeStoreName', value: null });
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear home store"
            >
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </Pressable>
          </View>
        )}

        <View style={step.searchWrap}>
          <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
          <TextInput
            style={step.searchInput}
            placeholder="Search stores…"
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="Search stores"
          />
        </View>
      </ScrollView>

      {query.length >= 2 && (
        <View style={step.storeListWrap}>
          {isLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />
          ) : (
            <FlatList
              data={stores}
              keyExtractor={(s) => s.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [step.storeRow, pressed && { opacity: 0.6 }]}
                  onPress={() => {
                    dispatch({ type: 'SET', key: 'homeStoreId', value: item.id });
                    dispatch({ type: 'SET', key: 'homeStoreName', value: item.name });
                    setQuery('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  accessibilityState={{ selected: draft.homeStoreId === item.id }}
                >
                  <Ionicons name="storefront-outline" size={18} color={colors.textTertiary} />
                  <View style={{ flex: 1 }}>
                    <Text style={step.storeTitle}>{item.name}</Text>
                    {(item.city || item.state) && (
                      <Text style={step.storeSub}>
                        {[item.city, item.state].filter(Boolean).join(', ')}
                      </Text>
                    )}
                  </View>
                  {draft.homeStoreId === item.id && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={<Text style={step.empty}>No stores found</Text>}
            />
          )}
        </View>
      )}

      <View style={[step.scroll, { paddingTop: spacing.lg }]}>
        <View style={step.discoverRow}>
          <View style={{ flex: 1 }}>
            <Text style={step.discoverTitle}>Appear in nearby search</Text>
            <Text style={step.discoverSub}>
              Other players at the same store can find you. You can change this anytime.
            </Text>
          </View>
          <Switch
            value={draft.discoverable}
            onValueChange={(v) => dispatch({ type: 'SET', key: 'discoverable', value: v })}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor={colors.surface}
            accessibilityLabel="Appear in nearby search"
          />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step metadata
// ---------------------------------------------------------------------------

const STEPS = [
  { label: 'Name', required: (d: Draft) => d.displayName.trim().length > 0 },
  { label: 'Colors', required: (d: Draft) => d.avatarColors.length > 0 },
  { label: 'Style', required: (d: Draft) => d.formats.length > 0 },
  { label: 'Decks', required: (_d: Draft) => true },
  { label: 'Store', required: (_d: Draft) => true },
];

// ---------------------------------------------------------------------------
// OnboardingScreen
// ---------------------------------------------------------------------------

export function OnboardingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [draft, dispatch] = useReducer(draftReducer, INITIAL_DRAFT);
  const [isDone, setIsDone] = useState(false);
  const { mutate: submit, isPending } = useSubmitOnboarding();
  const { mutate: addSocial } = useAddSocial();
  const { mutate: updateSocial } = useUpdateSocial();
  const { data: existingSocials } = useSocials();
  const socialsSeededRef = useRef(false);

  useEffect(() => {
    if (socialsSeededRef.current || !existingSocials) return;
    const seeded: Partial<Record<SocialPlatform, string>> = {};
    for (const link of existingSocials) {
      seeded[link.platform] = link.value;
    }
    dispatch({ type: 'SET', key: 'socials', value: seeded });
    socialsSeededRef.current = true;
  }, [existingSocials]);

  const canContinue = STEPS[currentStep].required(draft);
  const isLastStep = currentStep === STEPS.length - 1;

  function handleNext() {
    if (isLastStep) {
      setIsDone(true);
    } else {
      setCurrentStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }

  function handleEnter() {
    submit(
      {
        ...(draft.name.trim() ? { name: draft.name.trim() } : {}),
        shareNameWithContacts: draft.shareNameWithContacts,
        displayName: draft.displayName.trim(),
        pronouns: draft.pronouns.trim() || null,
        avatarColors: draft.avatarColors,
        formats: draft.formats,
        commander: draft.commander.trim() || null,
        vibes: draft.vibes,
        bio: draft.bio.trim() || null,
        discoverable: draft.discoverable,
        decks: draft.decks.length > 0 ? draft.decks : undefined,
        homeStoreId: draft.homeStoreId ?? undefined,
      },
      {
        onSuccess: () => {
          for (const platform of ALL_PLATFORMS) {
            const value = (draft.socials[platform] ?? '').trim();
            const existing = existingSocials?.find((s) => s.platform === platform);
            if (existing) {
              if (value && value !== existing.value) {
                updateSocial({ id: existing.id, value, visibility: 'PUBLIC' });
              }
            } else if (value) {
              addSocial({ platform, value, visibility: 'PUBLIC' });
            }
          }
        },
        onError: () => Alert.alert('Error', 'Something went wrong. Please try again.'),
      },
    );
  }

  const stepComponents = [
    <Step1 key={0} draft={draft} dispatch={dispatch} />,
    <Step2 key={1} draft={draft} dispatch={dispatch} />,
    <Step3 key={2} draft={draft} dispatch={dispatch} />,
    <Step4 key={3} draft={draft} dispatch={dispatch} />,
    <Step5 key={4} draft={draft} dispatch={dispatch} />,
  ];

  if (isDone) {
    return (
      <SafeAreaView style={ob.safe}>
        <ScrollView contentContainerStyle={ob.doneScroll}>
          <View style={ob.doneBadge}>
            <Ionicons name="sparkles" size={15} color={colors.accentInk} />
            <Text style={ob.doneBadgeText}>YOUR CARD IS READY</Text>
          </View>
          <Text style={ob.doneTitle}>Welcome, {draft.displayName.trim() || 'Planeswalker'}!</Text>
          <Text style={ob.doneSub}>This is what other players see when you meet.</Text>
          <PreviewCard draft={draft} />
        </ScrollView>
        <View style={ob.footer}>
          <Pressable
            style={({ pressed }) => [
              ob.continueBtn,
              isPending && ob.continueBtnDisabled,
              pressed && !isPending && { opacity: 0.85 },
            ]}
            onPress={handleEnter}
            disabled={isPending}
            accessibilityRole="button"
            accessibilityLabel="Enter ManaMap"
            accessibilityState={{ disabled: isPending, busy: isPending }}
          >
            {isPending ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <>
                <Text style={ob.continueBtnText}>Enter ManaMap</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.textInverse} />
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={ob.safe}>
      <View style={ob.topBar}>
        {currentStep > 0 ? (
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [ob.backBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={20} color={colors.accent} />
            <Text style={ob.backText}>Back</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
        <View style={ob.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[ob.dot, i === currentStep && ob.dotActive, i < currentStep && ob.dotDone]}
            />
          ))}
        </View>
        <View style={{ width: 60 }} />
      </View>

      <View style={ob.previewWrap}>
        <PreviewCard draft={draft} />
      </View>

      <View style={ob.stepContent}>{stepComponents[currentStep]}</View>

      <View style={ob.footer}>
        {currentStep === 3 && (
          <Pressable
            style={({ pressed }) => [ob.skipBtn, pressed && { opacity: 0.6 }]}
            onPress={() => setCurrentStep(4)}
            accessibilityRole="button"
          >
            <Text style={ob.skipText}>Skip</Text>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [
            ob.continueBtn,
            !canContinue && ob.continueBtnDisabled,
            pressed && canContinue && { opacity: 0.85 },
          ]}
          onPress={handleNext}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityLabel={isLastStep ? 'Finish' : 'Continue'}
          accessibilityState={{ disabled: !canContinue }}
        >
          <Text style={ob.continueBtnText}>{isLastStep ? 'Finish' : 'Continue'}</Text>
          <Ionicons
            name={isLastStep ? 'checkmark' : 'arrow-forward'}
            size={17}
            color={colors.textInverse}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Step styles
// ---------------------------------------------------------------------------

const step = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },
  heading: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: -0.55,
  },
  sub: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 14.5,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: -spacing.xs,
  },
  field: { gap: spacing.sm },
  label: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 12.5,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.38,
  },
  optional: {
    fontFamily: typography.fontFamily.regular,
    color: colors.textTertiary,
    textTransform: 'none',
    letterSpacing: 0,
  },
  required: { color: colors.accent },
  input: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 48,
  },
  inputError: { borderColor: colors.error },
  errorText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.error,
  },
  pipRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.lg },
  pipBtn: {
    position: 'relative',
    borderRadius: radii.full,
    padding: 4,
  },
  pipBtnInactive: { opacity: 0.45 },
  pipCheck: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guildRow: { alignItems: 'center', marginTop: -spacing.sm },
  guildName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.accentInk,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  chipText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  chipTextActive: { color: colors.accentInk },
  deckList: {
    gap: 0,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  deckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
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
  addDeckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  addDeckText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.accent,
  },
  addDeckForm: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  formBtns: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  cancelBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  cancelBtnText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  saveBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
  },
  saveBtnDisabled: { backgroundColor: colors.borderLight },
  saveBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
  selectedStore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.accentLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  selectedStoreName: {
    flex: 1,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.accent,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  storeListWrap: { flex: 1, maxHeight: 240 },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
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
  discoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  discoverTitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  discoverSub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
    lineHeight: 16,
  },
  empty: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  nameShareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.paper,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  nameShareTitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  nameShareSub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
});

// ---------------------------------------------------------------------------
// Onboarding shell styles
// ---------------------------------------------------------------------------

const ob = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  backText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.accent,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radii.full,
    backgroundColor: colors.borderLight,
  },
  dotActive: { width: 22, backgroundColor: colors.accent },
  dotDone: { backgroundColor: colors.accentLight },
  previewWrap: { paddingBottom: spacing.md },
  stepContent: { flex: 1 },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  skipBtn: {
    height: 44,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textTertiary,
  },
  continueBtn: {
    flexDirection: 'row',
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  continueBtnDisabled: { backgroundColor: colors.borderLight },
  continueBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textInverse,
  },
  doneScroll: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  doneBadgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 12.5,
    color: colors.accentInk,
    letterSpacing: 0.5,
  },
  doneTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 25,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  doneSub: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 14.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: -spacing.sm,
  },
});
