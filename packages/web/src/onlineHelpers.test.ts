import { describe, expect, it } from 'vitest';
import { inviteLink, loadSession, parseJoinCode, saveSession } from './onlineHelpers';

describe('parseJoinCode', () => {
  it('normalises bare codes and extracts them from links', () => {
    expect(parseJoinCode(' abc234 ')).toBe('ABC234');
    expect(parseJoinCode('http://localhost:5173/?join=xyz789')).toBe('XYZ789');
  });

  it('rejects malformed input', () => {
    expect(parseJoinCode('')).toBeNull();
    expect(parseJoinCode('ABC')).toBeNull();
    expect(parseJoinCode('ABCDE0')).toBeNull();
  });
});

describe('inviteLink', () => {
  it('builds a join URL', () => {
    expect(inviteLink('https://x.test', '/', 'ABC234')).toBe('https://x.test/?join=ABC234');
  });
});

describe('session storage', () => {
  it('round-trips and tolerates garbage', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
    expect(loadSession(storage)).toBeNull();
    saveSession(storage, { code: 'ABC234', token: 't' });
    expect(loadSession(storage)).toEqual({ code: 'ABC234', token: 't' });
    saveSession(storage, null);
    expect(loadSession(storage)).toBeNull();
    storage.setItem('hnefatafl.online', '{bad');
    expect(loadSession(storage)).toBeNull();
  });
});
