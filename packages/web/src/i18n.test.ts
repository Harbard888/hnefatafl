import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIFFICULTY_KEYS, detectLang, translator } from './i18n';

describe('translator', () => {
  it('interpolates named variables', () => {
    const t = translator('en');
    expect(t('winner', { side: 'Defenders', reason: 'king escaped' })).toBe(
      'Defenders wins (king escaped)',
    );
  });

  it('returns German text for German', () => {
    expect(translator('de')('newGame')).toBe('Neues Spiel');
  });

  it('keeps unknown placeholders visible', () => {
    expect(translator('en')('turn')).toBe('{side} to move');
  });
});

describe('messages', () => {
  it('has the same keys in German and English', () => {
    const t = (lang: 'de' | 'en') => translator(lang);
    expect(t('de')('modeOnline')).not.toBe(t('en')('modeOnline'));
    expect(t('en')('onlineCode', { code: 'ABC234' })).toBe('Code: ABC234');
  });

  it('translates every difficulty in both languages', () => {
    for (const lang of ['de', 'en'] as const) {
      const t = translator(lang);
      for (const key of Object.values(DIFFICULTY_KEYS)) expect(t(key)).not.toBe('');
    }
    expect(translator('de')('difficultyHard')).not.toBe(translator('en')('difficultyHard'));
  });
});

describe('detectLang', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('chooses German for German browsers', () => {
    vi.stubGlobal('navigator', { language: 'de-AT' });
    expect(detectLang()).toBe('de');
  });

  it('falls back to English for other languages', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    expect(detectLang()).toBe('en');
  });
});
