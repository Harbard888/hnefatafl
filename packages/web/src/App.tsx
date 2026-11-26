import { useEffect, useState } from 'react';
import {
  ApiError,
  createGame,
  playMove,
  type GameMode,
  type GameView,
  type MoveRecord,
  type Pos,
  type Side,
} from './api';
import { describeMove, highlightsFor, movesOf } from './moves';
import { detectLang, translator, type Lang, type MessageKey } from './i18n';
import './App.css';

const THRONE = { row: 5, col: 5 };
const CORNERS = new Set(['0,0', '0,10', '10,0', '10,10']);

const SYMBOLS: Record<string, string> = {
  attacker: '⚫',
  defender: '⚪',
  king: '👑',
};

function sameCell(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col;
}

function ownsPiece(square: string | null, side: Side): boolean {
  if (side === 'attacker') return square === 'attacker';
  return square === 'defender' || square === 'king';
}

export default function App() {
  const [lang, setLang] = useState<Lang>(detectLang);
  const [game, setGame] = useState<GameView | null>(null);
  const [mode, setMode] = useState<GameMode>('two-player');
  const [selected, setSelected] = useState<Pos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [batch, setBatch] = useState<MoveRecord[]>([]);

  const t = translator(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = translator(lang)('title');
  }, [lang]);

  function errorMessage(e: unknown): string {
    if (e instanceof ApiError && e.status === 400) return t('moveRejected');
    if (e instanceof ApiError) return e.message;
    return t('connectionError');
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      setGame(await createGame({ mode, computerSide: 'defender' }));
      setSelected(null);
      setMoves([]);
      setBatch([]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // The backend has no undo endpoint, so replay all but the last move in a fresh game.
  async function undo() {
    if (!game || game.mode !== 'two-player' || moves.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const remaining = moves.slice(0, -1);
      let view = await createGame({ mode: 'two-player' });
      for (const m of remaining) view = await playMove(view.id, m.from, m.to);
      setGame(view);
      setMoves(remaining);
      setBatch(remaining.slice(-1));
      setSelected(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleClick(pos: Pos) {
    if (!game || game.status.kind !== 'ongoing' || busy) return;
    const square = game.board[pos.row][pos.col];

    if (selected === null) {
      if (ownsPiece(square, game.turn)) setSelected(pos);
      return;
    }
    if (sameCell(selected, pos)) {
      setSelected(null);
      return;
    }
    if (ownsPiece(square, game.turn)) {
      setSelected(pos);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const next = await playMove(game.id, selected, pos);
      const added = movesOf(next);
      setGame(next);
      setMoves([...moves, ...added]);
      setBatch(added);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSelected(null);
      setBusy(false);
    }
  }

  function statusText(view: GameView): string {
    if (view.status.kind === 'won') {
      const reasonKey = `reason_${view.status.reason.replace(/-/g, '_')}` as MessageKey;
      return t('winner', { side: t(view.status.winner), reason: t(reasonKey) });
    }
    return t('turn', { side: t(view.turn) });
  }

  const targets = new Set(
    game && selected
      ? game.legalMoves
          .filter((m) => sameCell(m.from, selected))
          .map((m) => `${m.to.row},${m.to.col}`)
      : [],
  );

  const highlights = highlightsFor(batch);
  const canUndo = game?.mode === 'two-player';

  return (
    <main className="app">
      <header className="header">
        <h1>{t('title')}</h1>
        <label>
          {t('language')}{' '}
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>

      <section className="controls">
        <label>
          {t('mode')}{' '}
          <select value={mode} onChange={(e) => setMode(e.target.value as GameMode)}>
            <option value="two-player">{t('modeTwoPlayer')}</option>
            <option value="vs-computer">{t('modeVsComputer')}</option>
          </select>
        </label>
        <button onClick={start} disabled={busy}>{t('newGame')}</button>
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      {game && (
        <>
          <p className="status">{statusText(game)}</p>
          <div className="board" role="grid" aria-label={t('board')}>
            {game.board.map((rowCells, row) =>
              rowCells.map((square, col) => {
                const pos = { row, col };
                const classes = ['cell'];
                if (CORNERS.has(`${row},${col}`)) classes.push('corner');
                if (sameCell(THRONE, pos)) classes.push('throne');
                if (selected !== null && sameCell(selected, pos)) classes.push('selected');
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
            <button
              onClick={undo}
              disabled={busy || !canUndo || moves.length === 0}
              title={canUndo ? undefined : t('undoUnavailable')}
            >
              {t('undo')}
            </button>
          </div>
          <section className="history">
            <h2>{t('history')}</h2>
            {moves.length === 0 ? (
              <p>{t('noMoves')}</p>
            ) : (
              <ol>
                {moves.map((m, i) => (
                  <li key={i}>
                    {t(m.side)}: {describeMove(m)}
                  </li>
                ))}
              </ol>
            )}
          </section>
          {game.status.kind === 'won' && (
            <div className="overlay" role="dialog" aria-modal="true" aria-label={t('gameOver')}>
              <div className="dialog">
                <h2>{t('gameOver')}</h2>
                <p>{statusText(game)}</p>
                <button onClick={start} disabled={busy}>{t('playAgain')}</button>
              </div>
            </div>
          )}
          {game.computerMove && (
            <p className="info">
              {t('computerMove', {
                from: `${game.computerMove.from.row},${game.computerMove.from.col}`,
                to: `${game.computerMove.to.row},${game.computerMove.to.col}`,
              })}
            </p>
          )}
        </>
      )}
    </main>
  );
}
