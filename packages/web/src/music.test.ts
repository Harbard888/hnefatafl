import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAYLIST_URL,
  DEFAULT_VOLUME,
  clampVolume,
  loadVolume,
  parseYouTubeSource,
} from './music';

describe('parseYouTubeSource', () => {
  it('parses a watch URL with a playlist', () => {
    expect(parseYouTubeSource('https://www.youtube.com/watch?v=VYEqT0enZe4&list=PL123_ab-C&pp=x')).toEqual({
      list: 'PL123_ab-C',
      video: 'VYEqT0enZe4',
    });
  });

  it('parses a pure playlist URL', () => {
    expect(parseYouTubeSource('https://www.youtube.com/playlist?list=PLabc')).toEqual({ list: 'PLabc' });
  });

  it('parses single-video forms', () => {
    expect(parseYouTubeSource('https://youtu.be/VYEqT0enZe4?t=3')).toEqual({ video: 'VYEqT0enZe4' });
    expect(parseYouTubeSource('youtube.com/embed/VYEqT0enZe4')).toEqual({ video: 'VYEqT0enZe4' });
  });

  it('rejects non-YouTube or invalid input', () => {
    expect(parseYouTubeSource('')).toBeNull();
    expect(parseYouTubeSource('not a url')).toBeNull();
    expect(parseYouTubeSource('https://example.com/watch?v=abc')).toBeNull();
    expect(parseYouTubeSource('https://www.youtube.com/')).toBeNull();
    expect(parseYouTubeSource('https://www.youtube.com/watch?list=a<b>')).toBeNull();
  });

  it('understands the default playlist constant', () => {
    expect(parseYouTubeSource(DEFAULT_PLAYLIST_URL)?.video).toBe('VYEqT0enZe4');
  });
});

describe('volume', () => {
  it('clamps and rounds', () => {
    expect(clampVolume(150)).toBe(100);
    expect(clampVolume(-5)).toBe(0);
    expect(clampVolume(33.6)).toBe(34);
    expect(clampVolume(NaN)).toBe(DEFAULT_VOLUME);
  });

  it('loads from storage with fallback', () => {
    expect(loadVolume({ getItem: () => '70' })).toBe(70);
    expect(loadVolume({ getItem: () => null })).toBe(DEFAULT_VOLUME);
    expect(loadVolume(undefined)).toBe(DEFAULT_VOLUME);
  });
});
