const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

/** Accepts a bare code or a full invite link and returns the normalised code, or null. */
export function parseJoinCode(input: string): string | null {
  const text = input.trim();
  let candidate = text;
  try {
    const joinParam = new URL(text).searchParams.get('join');
    if (joinParam) candidate = joinParam;
  } catch {
    // not a URL: treat as a bare code
  }
  const code = candidate.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export function inviteLink(origin: string, pathname: string, code: string): string {
  return `${origin}${pathname}?join=${code}`;
}

export interface Session {
  code: string;
  token: string;
}

const STORAGE_KEY = 'hnefatafl.online';

export function loadSession(storage: Pick<Storage, 'getItem'>): Session | null {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as Partial<Session> | null;
    return parsed && typeof parsed.code === 'string' && typeof parsed.token === 'string'
      ? { code: parsed.code, token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

export function saveSession(storage: Pick<Storage, 'setItem' | 'removeItem'>, session: Session | null): void {
  if (session) storage.setItem(STORAGE_KEY, JSON.stringify(session));
  else storage.removeItem(STORAGE_KEY);
}
