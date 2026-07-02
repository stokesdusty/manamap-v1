// Canonical Terms of Service & Privacy Policy content, shared between the admin
// web app (public /terms and /privacy pages) and the mobile app (in-app legal
// screens), so both surfaces always show the same text.
//
// IMPORTANT: This is a working draft grounded in ManaMap's actual data model
// and features. It is not legal advice. Have it reviewed by an attorney
// before shipping — in particular the bracketed placeholders (governing law /
// jurisdiction, business entity name, minimum age) need to be filled in based
// on where and how the business is actually formed and operated.

export const LEGAL_CONTACT_EMAIL = 'stokes.dusty@gmail.com';
export const LEGAL_EFFECTIVE_DATE = '2026-07-02';

export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalDocument {
  title: string;
  effectiveDate: string;
  sections: LegalSection[];
}

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  sections: [
    {
      heading: 'Overview',
      body: [
        'ManaMap ("ManaMap", "we", "us") is a social app for tabletop Magic: The Gathering players — check in to local game stores, track streaks and badges, find nearby players, RSVP to store events, and log game results. This policy explains what information we collect, how we use it, and the choices you have.',
        'By using ManaMap, you agree to the collection and use of information as described here. If you don’t agree, please don’t use the app.',
      ],
    },
    {
      heading: 'Information we collect',
      body: [
        'Account & profile information: the email address, display name, and avatar provided by your sign-in method, plus anything you add yourself — bio, pronouns, commander, power level, preferred formats, play-style tags, and trade lists.',
        'Sign-in information: when you sign in with Discord, Google, or Apple, we receive a unique identifier and basic profile details (name, email, avatar) from that provider. We never see or store your password for those accounts.',
        'Location information: with your permission, we collect your device’s location to verify store check-ins and to show nearby players who have discovery turned on. We also store your last known location so features like "recent stores" keep working between sessions.',
        'Activity you generate: check-ins, streaks and badges, game results you log or confirm, decks you link, connection (friend) requests, endorsements, event RSVPs, "looking for group" posts, reports you file, and messages store partners send through the app.',
        'Device & technical information: a push-notification token (if you enable notifications), nearby-device Bluetooth signals used only to power the in-app player radar, and crash/error diagnostics that help us fix bugs.',
      ],
    },
    {
      heading: 'How we use your information',
      body: [
        'To provide core features: check-ins, streak and badge tracking, store discovery, nearby-player discovery, event RSVPs and reminders, game logging and win/loss stats, "looking for group" matching, and connections between players.',
        'To operate the store partner program: redemption codes, offer eligibility, and aggregated, non-identifying analytics we share with the store you checked into.',
        'To keep the community safe: reviewing reports, enforcing our Terms of Service, and applying warnings, suspensions, or bans when necessary.',
        'To send you notifications you’ve opted into, such as event reminders, connection requests, and game confirmations.',
        'To maintain and improve the app, including diagnosing crashes and abuse.',
      ],
    },
    {
      heading: 'Location data, specifically',
      body: [
        'Precise location is used for two things: confirming you’re actually at a store when you check in, and, only if you’ve turned on discoverability in your privacy settings, showing your approximate presence to other nearby players.',
        'You control this in the app’s Privacy settings at any time — you can turn off discoverability, limit who sees your location to your connections, or turn off location sharing entirely (which disables check-ins and nearby discovery, but not the rest of the app).',
        'Presence data used for "who’s nearby" automatically expires on its own after a short period of inactivity — we don’t keep a persistent location trail beyond your check-in history.',
      ],
    },
    {
      heading: 'How we share information',
      body: [
        'With other users, according to your privacy settings — your public profile, and (if enabled) your presence, decks, and trade lists.',
        'With the store you check into or interact with — attendance, redemption, and aggregated analytics for their location. Stores do not receive your precise location beyond confirming a check-in occurred.',
        'With service providers who help us run ManaMap: Discord, Google, and Apple (for sign-in), a push-notification delivery provider, and infrastructure and error-monitoring providers who process data on our behalf and are not permitted to use it for their own purposes.',
        'When required by law, to protect the safety of our users, or to investigate violations of our Terms of Service.',
        'We do not sell your personal information.',
      ],
    },
    {
      heading: 'Your choices and rights',
      body: [
        'You can review and change most of your data directly in the app: profile fields, privacy and discoverability settings, decks, and notification preferences.',
        'You can block or report other users at any time.',
        'You can export a copy of your ManaMap data, or permanently delete your account, from Your Profile in the app at any time — no need to contact us first, though we’re happy to help if you run into trouble.',
        'Depending on where you live, you may have additional rights (for example, under GDPR or CCPA) to access, correct, or object to the processing of your information. Contact us and we’ll do our best to help.',
      ],
    },
    {
      heading: 'Data retention',
      body: [
        'We keep your information for as long as your account is active, plus a reasonable period afterward as needed for legal, security, or record-keeping purposes.',
        'When you delete your account, we immediately remove your sessions, device tokens, notifications, linked identities, decks, social links, check-in history, streaks, and badges. Records that are shared with other players — like confirmed game results, encounters, and endorsements — are anonymized rather than deleted outright, so we don’t corrupt other players’ own game history; your profile is scrubbed of identifying information as part of that process.',
        'Moderation records (reports and enforcement actions) are retained as an internal audit trail even after account deletion.',
      ],
    },
    {
      heading: 'Children’s privacy',
      body: [
        'ManaMap is not directed at children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we’ll delete it.',
      ],
    },
    {
      heading: 'Security',
      body: [
        'We use reasonable technical and organizational measures to protect your information, including encrypted connections and hashed credentials. No method of transmission or storage is completely secure, so we can’t guarantee absolute security.',
      ],
    },
    {
      heading: 'International users',
      body: [
        'ManaMap may process and store information on servers located outside your country of residence. By using the app, you consent to this transfer.',
      ],
    },
    {
      heading: 'Changes to this policy',
      body: [
        'We may update this policy from time to time. If we make material changes, we’ll notify you in the app or by email before they take effect.',
      ],
    },
    {
      heading: 'Contact us',
      body: [`Questions about this policy? Email us at ${LEGAL_CONTACT_EMAIL}.`],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  title: 'Terms of Service',
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  sections: [
    {
      heading: 'Acceptance of terms',
      body: [
        'These Terms of Service govern your use of ManaMap. By creating an account or using the app, you agree to these terms and to our Privacy Policy. If you don’t agree, please don’t use ManaMap.',
      ],
    },
    {
      heading: 'Eligibility',
      body: [
        'You must be at least [13 / the age of digital consent in your jurisdiction] to use ManaMap, and capable of forming a binding contract. If you’re using ManaMap on behalf of a store or organization, you confirm you’re authorized to do so.',
      ],
    },
    {
      heading: 'Your account',
      body: [
        'You sign in to ManaMap using a third-party provider (Discord, Google, or Apple). You’re responsible for keeping that provider account secure — we never see or store its password.',
        'Keep your profile information accurate, and let us know right away if you believe your account has been used without your permission.',
      ],
    },
    {
      heading: 'Acceptable use',
      body: [
        'Be respectful. You agree not to use ManaMap to harass, threaten, or abuse other users; post spam or misleading content; impersonate someone else or maintain a fake profile; post inappropriate or illegal content; misrepresent game results; misuse location or discovery features to track someone without their consent; or otherwise violate applicable law.',
        'We rely on our community to report bad behavior. Filing knowingly false reports is itself a violation of these terms.',
      ],
    },
    {
      heading: 'Your content',
      body: [
        'You retain ownership of the content you post (profile details, decks, messages, and similar). By posting it, you grant ManaMap a license to store, display, and distribute it as part of operating the app — for example, showing your profile to other players or a store’s check-in roster to that store.',
        'You’re responsible for the content you post and confirm you have the right to share it.',
      ],
    },
    {
      heading: 'Location-based features',
      body: [
        'Check-ins, nearby-player discovery, and similar features require location permission and reasonably accurate device location. We don’t guarantee location accuracy, and store check-in eligibility is determined automatically based on proximity.',
      ],
    },
    {
      heading: 'Game results',
      body: [
        'Game results are self-reported by players and confirmed by the other participants in the app. ManaMap does not verify the accuracy of reported results and is not responsible for disputes between players — we provide a dispute flag for contested results, but resolution is between the players involved.',
      ],
    },
    {
      heading: 'Store partner program',
      body: [
        'Reward offers, redemption codes, and event listings are created and honored by the individual participating store, not by ManaMap. ManaMap is not responsible for a store’s failure to honor an offer or for the accuracy of store-provided event information.',
      ],
    },
    {
      heading: 'Moderation and enforcement',
      body: [
        'We may review reports, remove content, and warn, suspend, or ban accounts that violate these terms, at our discretion. We’ll generally try to explain why, but in cases of serious or repeated abuse we may act without prior notice.',
        'If you believe an enforcement action was made in error, contact us and we’ll review it.',
      ],
    },
    {
      heading: 'Termination',
      body: [
        'You can delete your account at any time from Your Profile in the app. We may suspend or terminate your access for violating these terms, or if we discontinue the app.',
      ],
    },
    {
      heading: 'Disclaimers',
      body: [
        'ManaMap is provided "as is" and "as available," without warranties of any kind, express or implied. We don’t guarantee the app will be uninterrupted, error-free, or that any particular store, event, or offer will be available.',
      ],
    },
    {
      heading: 'Limitation of liability',
      body: [
        'To the maximum extent permitted by law, ManaMap and its operators are not liable for indirect, incidental, or consequential damages arising from your use of the app, including disputes between users or with participating stores.',
      ],
    },
    {
      heading: 'Governing law',
      body: [
        'These terms are governed by the laws of [jurisdiction to be specified]. Any disputes will be resolved in the courts of that jurisdiction, unless applicable law requires otherwise.',
      ],
    },
    {
      heading: 'Changes to these terms',
      body: [
        'We may update these terms from time to time. If we make material changes, we’ll notify you in the app or by email before they take effect. Continued use of ManaMap after changes take effect means you accept the updated terms.',
      ],
    },
    {
      heading: 'Contact us',
      body: [`Questions about these terms? Email us at ${LEGAL_CONTACT_EMAIL}.`],
    },
  ],
};
