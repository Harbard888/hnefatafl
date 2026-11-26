import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ApiError,
  createOnlineGame,
  fetchOnlineGame,
  joinOnlineGame,
  playOnlineMove,
  type OnlineSeat,
  type OnlineView,
  type Pos,
  type Side,
  type Variant,
  VARIANTS,
} from './api';
import { describeMove, highlightsFor, specialSquares } from './moves';
import { VARIANT_KEYS, type MessageKey, type Translate } from './i18n';
import { inviteLink, loadSession, parseJoinCode, saveSession, type Session } from './onlineHelpers';

const SYMBOLS: Record<string, string> = { attacker: '⚫', defender: '⚪', king: '👑' };
const POLL_MS = 1500;

const same = (a: Pos, b: Pos) => a.row === b.row && a.col === b.col;
const owns = (square: string | null, side: Side) =>
  side === 'attacker' ? square === 'attacker' : square === 'defender' || square === 'king';

function initialJoinParam(): string | null {
  const param = new URLSearchParams(window.location.search).get('join');
  return param ? parseJoinCode(param) : null;
}

export default function OnlineGame({ t }: { t: Translate }) {
  const [session, setSession] = useState<Session | null>(() => loadSession(window.localStorage));
  const [view, setView] = useState<OnlineView | null>(null);
  const [side, setSide] = useState<Side | 'random'>('random');
  const [variant, setVariant] = useState<Variant>('copenhagen');
  const [codeInput, setCodeInput] = useState(() => initialJoinParam() ?? '');
  const [selected, setSelected] = useState<Pos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const describe = useCallback(
    (e: unknown): string => {
      if (e instanceof ApiError) {
        if (e.status === 404) return t('onlineNotFound');
        if (e.status === 409 && /full/.test(e.message)) return t('onlineFull');
        if (e.status === 403) return t('onlineNotYourTurn');
        if (e.status === 400) return t('moveRejected');
        return e.message;
      }
      return t('connectionError');
    },
    [t],
  );

  const leave = useCallback(() => {
    saveSession(window.localStorage, null);
    setSession(null);
    setView(null);
    setSelected(null);
  }, []);

  function enter(seat: OnlineSeat) {
    const next = { code: seat.view.code, token: seat.token };
    saveSession(window.localStorage, next);
    setSession(next);
    setView(seat.view);
    setSelected(null);
    window.history.replaceState(null, '', window.location.pathname);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  }

  const create = () => run(async () => enter(await createOnlineGame(side, variant)));
  const join = () =>
    run(async () => {
      const code = parseJoinCode(codeInput);
      if (!code) throw new ApiError(t('onlineInvalidCode'), 0);
      enter(await joinOnlineGame(code));
    });

  // Poll for the opponent's moves and connection state; survive transient network errors.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const tick = async () => {
            try {
        const next = await fetchOnlineGame(session.code, session.token);
        if (cancelled) return;
        setView(next);
        setOffline(false);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 401 || e.status === 404)) {
          setError(tRef.current('onlineExpired'));
          leave();
        } else {
          setOffline(true);
        }
      }
    };
    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [session, leave]);

  async function handleClick(pos: Pos) {
    if (!view || !session || busy || view.status.kind !== 'ongoing' || !view.opponentJoined) return;
    const square = view.board[pos.row][pos.col];
    if (view.turn !== view.you) return;
    if (selected === null || (owns(square, view.you) && !same(selected, pos))) {
      if (owns(square, view.you)) setSelected(pos);
      return;
    }
    if (same(selected, pos)) {
      setSelected(null);
      return;
    }
    const from = selected;
    setSelected(null);
    await run(async () => setView(await playOnlineMove(session.code, session.token, from, pos)));
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable; the link is visible for manual copying
    }
  }

  if (session && !view) {
    return (
      <section className="lobby">
        {error && <p className="error" role="alert">{error}</p>}
        <p className="info" role="status">{offline ? t('onlineReconnecting') : t('onlineRestoring')}</p>
        <div className="actions">
          <button onClick={leave}>{t('onlineLeave')}</button>
        </div>
      </section>
    );
  }

  if (!session || !view) {
    return (
      <section className="lobby">
        {error && <p className="error" role="alert">{error}</p>}
        <div className="controls">
          <label>
            {t('onlineYourSide')}{' '}
            <select value={side} onChange={(e) => setSide(e.target.value as Side | 'random')}>
              <option value="random">{t('onlineSideRandom')}</option>
              <option value="attacker">{t('attacker')}</option>
              <option value="defender">{t('defender')}</option>
            </select>
          </label>
          <label>
            {t('variant')}{' '}
            <select value={variant} onChange={(e) => setVariant(e.target.value as Variant)}>
              {VARIANTS.map((v) => (
                <option key={v} value={v}>{t(VARIANT_KEYS[v])}</option>
              ))}
            </select>
          </label>
          <button onClick={create} disabled={busy}>{t('onlineCreate')}</button>
        </div>
        <div className="controls">
          <label>
            {t('onlineCodeLabel')}{' '}
            <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} />
          </label>
          <button onClick={join} disabled={busy || codeInput.trim() === ''}>{t('onlineJoin')}</button>
        </div>
      </section>
    );
  }

  const myTurn = view.turn === view.you;
  const link = inviteLink(window.location.origin, window.location.pathname, view.code);
  const targets = new Set(
    selected ? view.legalMoves.filter((m) => same(m.from, selected)).map((m) => `${m.to.row},${m.to.col}`) : [],
  );
  const highlights = highlightsFor(view.moves.slice(-1));

  let status: string;
  if (view.status.kind === 'won') {
    const reasonKey = `reason_${view.status.reason.replace(/-/g, '_')}` as MessageKey;
    status = t('winner', { side: t(view.status.winner), reason: t(reasonKey) });
  } else {
    status = myTurn ? t('onlineYourTurn') : t('onlineTheirTurn');
  }

  const special = specialSquares(view.board.length, view.variant);

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {offline && <p className="info" role="status">{t('onlineReconnecting')}</p>}
      <p className="info">{t('onlineYouAre', { side: t(view.you) })} · {t('onlineCode', { code: view.code })}</p>
      {!view.opponentJoined ? (
        <div className="invite">
          <p>{t('onlineWaiting')}</p>
          <p><strong>{view.code}</strong></p>
          <p><input readOnly value={link} onFocus={(e) => e.currentTarget.select()} /></p>
          <button onClick={() => copy(link)}>{copied ? t('onlineCopied') : t('onlineCopy')}</button>
        </div>
      ) : (
        <>
          <p className="status">{status}</p>
          {!view.opponentConnected && view.status.kind === 'ongoing' && (
            <p className="info" role="status">{t('onlineOpponentOffline')}</p>
          )}
        </>
      )}
      <div
        className="board"
        role="grid"
        aria-label={t('board')}
        style={{ '--board-size': view.board.length } as CSSProperties}
      >
        {view.board.map((rowCells, row) =>
          rowCells.map((square, col) => {
            const pos = { row, col };
            const classes = ['cell'];
            if (special.corners.has(`${row},${col}`)) classes.push('corner');
            if (same(special.throne, pos)) classes.push('throne');
            if (selected !== null && same(selected, pos)) classes.push('selected');
            if (targets.has(`${row},${col}`)) classes.push('target');
            if (highlights.last.has(`${row},${col}`)) classes.push('last');
            if (highlights.captured.has(`${row},${col}`)) classes.push('captured');
            const label = t('square', { row, col });
            return (
              <button
                key={`${row}-${col}`}
                className={classes.join(' ')}
                onClick={() => handleClick(pos)}
                aria-label={square ? `${label} (${t(square as MessageKey)})` : label}
              >
                {square ? SYMBOLS[square] : ''}
              </button>
            );
          }),
        )}
      </div>
      <div className="actions">
        <button onClick={leave}>{t('onlineLeave')}</button>
      </div>
      <section className="history">
        <h2>{t('history')}</h2>
        {view.moves.length === 0 ? (
          <p>{t('noMoves')}</p>
        ) : (
          <ol>
            {view.moves.map((m, i) => (
              <li key={i}>{t(m.side)}: {describeMove(m)}</li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
