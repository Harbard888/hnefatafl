import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectLang, translator } from './i18n';

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
