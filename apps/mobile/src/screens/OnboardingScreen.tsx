import React, { useReducer, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
import type { DeckSite, ManaColor, MtgFormat, PlayerVibe } from '@manamap/shared';
import { DECK_SITE_HOSTS } from '@manamap/shared';
import { Avatar } from '../components/Avatar';
import { ManaPip } from '../components/ManaPip';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { useSubmitOnboarding } from '../hooks/useMe';
import { useStores } from '../hooks/useNearby';

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

type DeckDraft = { site: DeckSite; name: string; url: string };

type Draft = {
  displayName: string;
  pronouns: string;
  avatarColors: ManaColor[];
  formats: MtgFormat[];
  commander: string;
  powerLevel: number | null;
  vibe: PlayerVibe | null;
  bio: string;
  discoverable: boolean;
  decks: DeckDraft[];
  homeStoreId: string | null;
  homeStoreName: string | null;
};

type DraftAction =
  | { type: 'SET'; key: keyof Draft; value: Draft[keyof Draft] }
  | { type: 'TOGGLE_COLOR'; color: ManaColor }
  | { type: 'TOGGLE_FORMAT'; format: MtgFormat }
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
        formats: has ? state.formats.filter((f) => f !== action.format) : [...state.formats, action.format],
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
  displayName: '',
  pronouns: '',
  avatarColors: [],
  formats: [],
  commander: '',
  powerLevel: null,
  vibe: null,
  bio: '',
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
        <Avatar name={name} manaColors={draft.avatarColors} size={52} />
        <View style={preview.nameBlock}>
          <Text style={preview.name} numberOfLines={1}>{name}</Text>
          {draft.pronouns.trim() ? (
            <Text style={preview.pronouns}>{draft.pronouns.trim()}</Text>
          ) : null}
          <View style={preview.comboRow}>
            {draft.avatarColors.map((c) => (
              <ManaPip key={c} color={c} size={14} showLetter={false} ring={false} />
            ))}
            {draft.avatarColors.length > 0 && (
              <Text style={preview.comboName}>{comboName}</Text>
            )}
          </View>
        </View>
        {draft.vibe ? (
          <View style={preview.vibePill}>
            <Text style={preview.vibeText}>{VIBE_LABELS[draft.vibe]}</Text>
          </View>
        ) : null}
      </View>

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
          <Text style={preview.commanderText} numberOfLines={1}>{draft.commander.trim()}</Text>
          {draft.powerLevel != null && (
            <View style={preview.powerBadge}>
              <Text style={preview.powerText}>P{draft.powerLevel}</Text>
            </View>
          )}
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
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  pronouns: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  comboRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  comboName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginLeft: 2,
  },
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
  powerBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    backgroundColor: colors.borderLight,
    borderRadius: radii.full,
  },
  powerText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
});

// ---------------------------------------------------------------------------
// Step 1 — Name + pronouns
// ---------------------------------------------------------------------------

function Step1({ draft, dispatch }: { draft: Draft; dispatch: React.Dispatch<DraftAction> }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={step.scroll} keyboardShouldPersistTaps="handled">
        <Text style={step.heading}>What should we call you?</Text>
        <Text style={step.sub}>Your display name is how other players see you.</Text>

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
          />
        </View>

        <View style={step.field}>
          <Text style={step.label}>Pronouns <Text style={step.optional}>(optional)</Text></Text>
          <TextInput
            style={step.input}
            value={draft.pronouns}
            onChangeText={(v) => dispatch({ type: 'SET', key: 'pronouns', value: v })}
            maxLength={32}
            placeholder="e.g. they/them"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
              style={[step.pipBtn, active && step.pipBtnActive]}
            >
              <ManaPip color={c} size={48} />
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={step.scroll} keyboardShouldPersistTaps="handled">
        <Text style={step.heading}>How do you play?</Text>
        <Text style={step.sub}>Help others find the right game with you.</Text>

        <View style={step.field}>
          <Text style={step.label}>Formats <Text style={step.required}>*</Text></Text>
          <View style={step.chips}>
            {ALL_FORMATS.map((f) => {
              const active = draft.formats.includes(f);
              return (
                <Pressable
                  key={f}
                  onPress={() => dispatch({ type: 'TOGGLE_FORMAT', format: f })}
                  style={[step.chip, active && step.chipActive]}
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
          <Text style={step.label}>Vibe <Text style={step.optional}>(optional)</Text></Text>
          <View style={step.chips}>
            {ALL_VIBES.map((v) => {
              const active = draft.vibe === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => dispatch({ type: 'SET', key: 'vibe', value: active ? null : v })}
                  style={[step.chip, active && step.chipActive]}
                >
                  <Text style={[step.chipText, active && step.chipTextActive]}>
                    {VIBE_LABELS[v]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={step.field}>
          <Text style={step.label}>Commander <Text style={step.optional}>(optional)</Text></Text>
          <TextInput
            style={step.input}
            value={draft.commander}
            onChangeText={(v) => dispatch({ type: 'SET', key: 'commander', value: v })}
            maxLength={128}
            placeholder="e.g. Atraxa, Praetors' Voice"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <View style={step.field}>
          <Text style={step.label}>Power level <Text style={step.optional}>(1–10, optional)</Text></Text>
          <View style={step.stepperRow}>
            <Pressable
              style={[step.stepperBtn, (draft.powerLevel ?? 0) <= 1 && step.stepperBtnDisabled]}
              onPress={() => draft.powerLevel != null && draft.powerLevel > 1 &&
                dispatch({ type: 'SET', key: 'powerLevel', value: draft.powerLevel - 1 })}
            >
              <Ionicons name="remove" size={20} color={draft.powerLevel != null && draft.powerLevel > 1 ? colors.accent : colors.textTertiary} />
            </Pressable>
            <Text style={step.stepperValue}>
              {draft.powerLevel != null ? draft.powerLevel : '—'}
            </Text>
            <Pressable
              style={[step.stepperBtn, (draft.powerLevel ?? 11) >= 10 && step.stepperBtnDisabled]}
              onPress={() => {
                const cur = draft.powerLevel ?? 0;
                if (cur < 10) dispatch({ type: 'SET', key: 'powerLevel', value: cur + 1 });
              }}
            >
              <Ionicons name="add" size={20} color={(draft.powerLevel ?? 0) < 10 ? colors.accent : colors.textTertiary} />
            </Pressable>
            {draft.powerLevel != null && (
              <Pressable
                onPress={() => dispatch({ type: 'SET', key: 'powerLevel', value: null })}
                style={step.clearPower}
              >
                <Text style={step.clearPowerText}>Clear</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Decks (skippable)
// ---------------------------------------------------------------------------

function Step4({ draft, dispatch }: { draft: Draft; dispatch: React.Dispatch<DraftAction> }) {
  const [showAddDeck, setShowAddDeck] = useState(false);
  const [deckSite, setDeckSite] = useState<DeckSite>('moxfield');
  const [deckName, setDeckName] = useState('');
  const [deckUrl, setDeckUrl] = useState('');
  const [deckUrlError, setDeckUrlError] = useState('');

  function addDeck() {
    try {
      const host = new URL(deckUrl).hostname.replace(/^www\./, '');
      const expected = DECK_SITE_HOSTS[deckSite];
      if (host !== expected && !host.endsWith(`.${expected}`)) {
        setDeckUrlError(`URL must be a ${expected} link`);
        return;
      }
    } catch {
      setDeckUrlError('Enter a valid URL');
      return;
    }
    if (!deckName.trim()) return;
    dispatch({ type: 'ADD_DECK', deck: { site: deckSite, name: deckName.trim(), url: deckUrl.trim() } });
    setDeckName('');
    setDeckUrl('');
    setDeckUrlError('');
    setShowAddDeck(false);
  }

  const SITE_LABELS: Record<DeckSite, string> = { moxfield: 'Moxfield', archidekt: 'Archidekt' };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={step.scroll} keyboardShouldPersistTaps="handled">
        <Text style={step.heading}>Share your decks</Text>
        <Text style={step.sub}>This step is optional — you can add decks later from your profile.</Text>

        {draft.decks.length > 0 && (
          <View style={step.deckList}>
            {draft.decks.map((d, i) => (
              <View key={i} style={step.deckRow}>
                <View style={{ flex: 1 }}>
                  <Text style={step.deckSite}>{SITE_LABELS[d.site]}</Text>
                  <Text style={step.deckName} numberOfLines={1}>{d.name}</Text>
                </View>
                <Pressable
                  onPress={() => dispatch({ type: 'REMOVE_DECK', index: i })}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {!showAddDeck ? (
          <Pressable
            style={({ pressed }) => [step.addDeckBtn, pressed && { opacity: 0.7 }]}
            onPress={() => setShowAddDeck(true)}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
            <Text style={step.addDeckText}>Add a deck link</Text>
          </Pressable>
        ) : (
          <View style={step.addDeckForm}>
            <View style={step.siteRow}>
              {(['moxfield', 'archidekt'] as DeckSite[]).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => { setDeckSite(s); setDeckUrlError(''); }}
                  style={[step.siteBtn, deckSite === s && step.siteBtnActive]}
                >
                  <Text style={[step.siteBtnText, deckSite === s && step.siteBtnTextActive]}>
                    {SITE_LABELS[s]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={step.input}
              value={deckName}
              onChangeText={setDeckName}
              maxLength={64}
              placeholder="Deck name"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[step.input, deckUrlError ? step.inputError : null]}
              value={deckUrl}
              onChangeText={(v) => { setDeckUrl(v); setDeckUrlError(''); }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder={`https://${DECK_SITE_HOSTS[deckSite]}/decks/...`}
              placeholderTextColor={colors.textTertiary}
            />
            {deckUrlError ? <Text style={step.errorText}>{deckUrlError}</Text> : null}
            <View style={step.formBtns}>
              <Pressable
                style={({ pressed }) => [step.cancelBtn, pressed && { opacity: 0.6 }]}
                onPress={() => { setShowAddDeck(false); setDeckUrlError(''); }}
              >
                <Text style={step.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [step.saveBtn, (!deckName.trim() || !deckUrl.trim()) && step.saveBtnDisabled, pressed && { opacity: 0.7 }]}
                onPress={addDeck}
                disabled={!deckName.trim() || !deckUrl.trim()}
              >
                <Text style={step.saveBtnText}>Add</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
      <ScrollView contentContainerStyle={[step.scroll, { paddingBottom: 0 }]} keyboardShouldPersistTaps="handled">
        <Text style={step.heading}>Find your home store</Text>
        <Text style={step.sub}>Your home store appears on your card and helps others find you.</Text>

        {draft.homeStoreName && (
          <View style={step.selectedStore}>
            <Ionicons name="storefront" size={20} color={colors.accent} />
            <Text style={step.selectedStoreName} numberOfLines={1}>{draft.homeStoreName}</Text>
            <Pressable onPress={() => {
              dispatch({ type: 'SET', key: 'homeStoreId', value: null });
              dispatch({ type: 'SET', key: 'homeStoreName', value: null });
            }}>
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
                >
                  <Ionicons name="storefront-outline" size={18} color={colors.textTertiary} />
                  <View style={{ flex: 1 }}>
                    <Text style={step.storeTitle}>{item.name}</Text>
                    {(item.city || item.state) && (
                      <Text style={step.storeSub}>{[item.city, item.state].filter(Boolean).join(', ')}</Text>
                    )}
                  </View>
                  {draft.homeStoreId === item.id && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={step.empty}>No stores found</Text>
              }
            />
          )}
        </View>
      )}

      <View style={[step.scroll, { paddingTop: spacing.lg }]}>
        <View style={step.discoverRow}>
          <View style={{ flex: 1 }}>
            <Text style={step.discoverTitle}>Appear in nearby search</Text>
            <Text style={step.discoverSub}>Other players at the same store can find you. You can change this anytime.</Text>
          </View>
          <Switch
            value={draft.discoverable}
            onValueChange={(v) => dispatch({ type: 'SET', key: 'discoverable', value: v })}
            trackColor={{ true: colors.success, false: colors.border }}
            thumbColor={colors.surface}
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
  const { mutate: submit, isPending } = useSubmitOnboarding();

  const canContinue = STEPS[currentStep].required(draft);
  const isLastStep = currentStep === STEPS.length - 1;

  function handleNext() {
    if (isLastStep) {
      submit(
        {
          displayName: draft.displayName.trim(),
          pronouns: draft.pronouns.trim() || null,
          avatarColors: draft.avatarColors,
          formats: draft.formats,
          commander: draft.commander.trim() || null,
          powerLevel: draft.powerLevel,
          vibe: draft.vibe,
          bio: draft.bio.trim() || null,
          discoverable: draft.discoverable,
          decks: draft.decks.length > 0 ? draft.decks : undefined,
          homeStoreId: draft.homeStoreId ?? undefined,
        },
        {
          onError: () => Alert.alert('Error', 'Something went wrong. Please try again.'),
        },
      );
    } else {
      setCurrentStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }

  const stepComponents = [
    <Step1 key={0} draft={draft} dispatch={dispatch} />,
    <Step2 key={1} draft={draft} dispatch={dispatch} />,
    <Step3 key={2} draft={draft} dispatch={dispatch} />,
    <Step4 key={3} draft={draft} dispatch={dispatch} />,
    <Step5 key={4} draft={draft} dispatch={dispatch} />,
  ];

  return (
    <SafeAreaView style={ob.safe}>
      <View style={ob.topBar}>
        {currentStep > 0 ? (
          <Pressable onPress={handleBack} style={({ pressed }) => [ob.backBtn, pressed && { opacity: 0.6 }]}>
            <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
        <View style={ob.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[ob.dot, i === currentStep && ob.dotActive, i < currentStep && ob.dotDone]} />
          ))}
        </View>
        {currentStep === 3 ? (
          <Pressable onPress={() => setCurrentStep(4)} style={({ pressed }) => [ob.skipBtn, pressed && { opacity: 0.6 }]}>
            <Text style={ob.skipText}>Skip</Text>
          </Pressable>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      <View style={ob.previewWrap}>
        <PreviewCard draft={draft} />
      </View>

      <View style={ob.stepContent}>
        {stepComponents[currentStep]}
      </View>

      <View style={ob.footer}>
        <Pressable
          style={({ pressed }) => [
            ob.continueBtn,
            !canContinue && ob.continueBtnDisabled,
            pressed && canContinue && { opacity: 0.85 },
          ]}
          onPress={handleNext}
          disabled={!canContinue || isPending}
        >
          {isPending ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={ob.continueBtnText}>
              {isLastStep ? 'Finish' : 'Continue'}
            </Text>
          )}
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
    fontSize: typography.fontSize.xxl,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: -spacing.sm,
  },
  field: { gap: spacing.xs },
  label: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optional: {
    fontFamily: typography.fontFamily.regular,
    color: colors.textTertiary,
    textTransform: 'none',
  },
  required: { color: colors.accent },
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
    height: 48,
  },
  inputError: { borderColor: colors.error },
  errorText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.error,
  },
  pipRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.lg },
  pipBtn: {
    borderRadius: radii.full,
    padding: 6,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  pipBtnActive: { borderColor: colors.accent },
  guildRow: { alignItems: 'center', marginTop: -spacing.sm },
  guildName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.lg,
    color: colors.accentInk,
  },
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
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: { borderColor: colors.borderLight },
  stepperValue: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
    minWidth: 36,
    textAlign: 'center',
  },
  clearPower: { marginLeft: spacing.xs },
  clearPowerText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
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
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  siteBtnTextActive: { color: colors.accent },
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
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.borderLight,
  },
  dotActive: { width: 18, backgroundColor: colors.accent },
  dotDone: { backgroundColor: colors.accentLight },
  skipBtn: { paddingHorizontal: spacing.sm },
  skipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textTertiary,
  },
  previewWrap: { paddingBottom: spacing.md },
  stepContent: { flex: 1 },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  continueBtn: {
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: { backgroundColor: colors.borderLight },
  continueBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textInverse,
  },
});
