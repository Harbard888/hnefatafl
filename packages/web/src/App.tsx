import { useState } from 'react';
import { createGame, playMove, type GameMode, type GameView, type Pos, type Side } from './api';
import './App.css';

const THRONE = { row: 5, col: 5 };
const CORNERS = new Set(['0,0', '0,10', '10,0', '10,10']);

const SYMBOLS: Record<string, string> = {
  attacker: '⚫',
  defender: '⚪',
  king: '👑',
};

const SIDE_NAMES: Record<Side, string> = {
  attacker: 'Angreifer',
  defender: 'Verteidiger',
};

function sameCell(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col;
}

function ownsPiece(square: string | null, side: Side): boolean {
  if (side === 'attacker') return square === 'attacker';
  return square === 'defender' || square === 'king';
}

export default function App() {
  const [game, setGame] = useState<GameView | null>(null);
  const [mode, setMode] = useState<GameMode>('two-player');
  const [selected, setSelected] = useState<Pos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      setGame(await createGame({ mode, computerSide: 'defender' }));
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      setGame(await playMove(game.id, selected, pos));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSelected(null);
      setBusy(false);
    }
  }

  function statusText(view: GameView): string {
    if (view.status.kind === 'won') {
      return `${SIDE_NAMES[view.status.winner]} gewinnt (${view.status.reason})`;
    }
    return `Am Zug: ${SIDE_NAMES[view.turn]}`;
  }

  const targets = new Set(
    game && selected
      ? game.legalMoves
          .filter((m) => sameCell(m.from, selected))
          .map((m) => `${m.to.row},${m.to.col}`)
      : [],
  );

  return (
    <main className="app">
      <h1>Hnefatafl</h1>

      <section className="controls">
        <label>
          Modus{' '}
          <select value={mode} onChange={(e) => setMode(e.target.value as GameMode)}>
            <option value="two-player">Zwei Spieler</option>
            <option value="vs-computer">Gegen den Computer (Verteidiger)</option>
          </select>
        </label>
        <button onClick={start} disabled={busy}>Neues Spiel</button>
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      {game && (
        <>
          <p className="status">{statusText(game)}</p>
          <div className="board" role="grid" aria-label="Spielbrett">
            {game.board.map((rowCells, row) =>
              rowCells.map((square, col) => {
                const pos = { row, col };
                const classes = ['cell'];
                if (CORNERS.has(`${row},${col}`)) classes.push('corner');
                if (sameCell(THRONE, pos)) classes.push('throne');
                if (selected !== null && sameCell(selected, pos)) classes.push('selected');
                if (targets.has(`${row},${col}`)) classes.push('target');
                return (
                  <button
                    key={`${row}-${col}`}
                    className={classes.join(' ')}
                    onClick={() => handleClick(pos)}
                    aria-label={`Feld ${row},${col}${square ? ` (${square})` : ''}`}
                  >
                    {square ? SYMBOLS[square] : ''}
                  </button>
                );
              }),
            )}
          </div>
          {game.computerMove && (
            <p className="info">
              Computer zieht von {game.computerMove.from.row},{game.computerMove.from.col} nach{' '}
              {game.computerMove.to.row},{game.computerMove.to.col}.
            </p>
          )}
        </>
      )}
    </main>
  );
}
