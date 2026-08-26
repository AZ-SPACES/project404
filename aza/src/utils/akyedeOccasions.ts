import type { AkyedeOccasion } from '../services/api';

/**
 * The wrapping an Akyede is shown in.
 *
 * Presentation only — the occasion moves no money. It decides the emoji and the words
 * wherever a gift appears, so the composer's chips, the card in the thread and the gift
 * screen all say the same thing about the same gift.
 */
export type OccasionArt = {
  key: AkyedeOccasion;
  /** The composer's chip, and how the sender's own card names the occasion. */
  label: string;
  emoji: string;
  /** Offered as the message until the sender writes their own. */
  greeting: string;
  /** Completes "sent you an Akyede …" — recipient-facing, so it reads in the second person. */
  line: string;
};

/** What the server falls back to when a gift is sent with no occasion set. */
const JUST_BECAUSE: OccasionArt = {
  key: 'JUST_BECAUSE', label: 'Just because', emoji: '💛', greeting: 'For you.', line: 'just because',
};

export const AKYEDE_OCCASION_ART: OccasionArt[] = [
  { key: 'BIRTHDAY',        label: 'Birthday',     emoji: '🎂', greeting: 'Happy birthday!',  line: 'for your birthday' },
  { key: 'WEDDING',         label: 'Wedding',      emoji: '💍', greeting: 'Congratulations!', line: 'for your wedding' },
  { key: 'OUTDOORING',      label: 'Outdooring',   emoji: '👶', greeting: 'Ayekoo!',          line: 'for the outdooring' },
  { key: 'GRADUATION',      label: 'Graduation',   emoji: '🎓', greeting: 'Ayekoo!',          line: 'for your graduation' },
  { key: 'CONGRATULATIONS', label: 'Well done',    emoji: '🎉', greeting: 'Congratulations!', line: 'to say well done' },
  { key: 'THANK_YOU',       label: 'Thank you',    emoji: '🙏', greeting: 'Medaase!',         line: 'to say thank you' },
  { key: 'CHRISTMAS',       label: 'Christmas',    emoji: '🎄', greeting: 'Afehyia pa!',      line: 'for Christmas' },
  { key: 'EID',             label: 'Eid',          emoji: '🌙', greeting: 'Eid Mubarak!',     line: 'for Eid' },
  { key: 'EASTER',          label: 'Easter',       emoji: '🐣', greeting: 'Happy Easter!',    line: 'for Easter' },
  JUST_BECAUSE,
];

/** Falls back to JUST_BECAUSE, which is what the server defaults an unset occasion to. */
export function akyedeArt(occasion?: AkyedeOccasion | string | null): OccasionArt {
  return AKYEDE_OCCASION_ART.find((o) => o.key === occasion) ?? JUST_BECAUSE;
}

/** How a gift addresses someone — first name only, the way a note would. */
export function akyedeFirstName(name?: string | null, fallback = 'them'): string {
  return (name ?? '').trim().split(/\s+/)[0] || fallback;
}
