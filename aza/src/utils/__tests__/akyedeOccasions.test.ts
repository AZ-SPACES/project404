import { AKYEDE_OCCASION_ART, akyedeArt, akyedeFirstName } from '../akyedeOccasions';
import { AKYEDE_OCCASIONS } from '../../services/api';

describe('AKYEDE_OCCASION_ART', () => {
  it('covers every occasion the API accepts, exactly once', () => {
    const keys = AKYEDE_OCCASION_ART.map((o) => o.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...AKYEDE_OCCASIONS].sort());
  });

  it('gives every occasion a chip, an emoji, a greeting, and a line', () => {
    for (const art of AKYEDE_OCCASION_ART) {
      expect(art.label).toBeTruthy();
      expect(art.emoji).toBeTruthy();
      expect(art.greeting).toBeTruthy();
      expect(art.line).toBeTruthy();
    }
  });
});

describe('akyedeArt', () => {
  it('finds the wrapping for a known occasion', () => {
    expect(akyedeArt('BIRTHDAY').emoji).toBe('🎂');
  });

  // A card sealed into a thread carries whatever the sender's build wrote, so the
  // lookup has to survive an occasion this build has never heard of.
  it.each([undefined, null, 'HARMATTAN'])('falls back to JUST_BECAUSE for %p', (occasion) => {
    expect(akyedeArt(occasion).key).toBe('JUST_BECAUSE');
  });
});

describe('akyedeFirstName', () => {
  it('uses the first name only', () => {
    expect(akyedeFirstName('Ama Serwaa Boateng')).toBe('Ama');
  });

  it('falls back when there is no name to use', () => {
    expect(akyedeFirstName(null)).toBe('them');
    expect(akyedeFirstName('   ', 'someone')).toBe('someone');
  });
});
