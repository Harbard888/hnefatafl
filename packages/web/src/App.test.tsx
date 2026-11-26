// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Board, GameView, MoveRecord, Square } from './api';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  createGame: vi.fn(),
  playMove: vi.fn(),
}));
vi.mock('./MusicPlayer', () => ({ MusicPlayer: () => null }));
vi.mock('./OnlineGame', () => ({ default: () => <p>online-stub</p> }));

import { ApiError, createGame, playMove } from './api';
import App from './App';

const createGameMock = vi.mocked(createGame);
const playMoveMock = vi.mocked(playMove);

function board(pieces: Record<string, Square>): Board {
  const b: Board = Array.from({ length: 7 }, () => Array<Square>(7).fill(null));
  for (const [key, piece] of Object.entries(pieces)) {
    const [r, c] = key.split(',').map(Number);
    b[r][c] = piece;
  }
  return b;
}

const START = board({ '0,3': 'attacker', '3,0': 'attacker', '2,3': 'defender', '3,3': 'king' });

function view(overrides: Partial<GameView> = {}): GameView {
  return {
    id: 'g1',
    mode: 'two-player',
    variant: 'brandubh',
    computerSide: 'defender',
    difficulty: null,
    board: START,
    turn: 'attacker',
    status: { kind: 'ongoing' },
    legalMoves: [
      { from: { row: 0, col: 3 }, to: { row: 0, col: 2 } },
      { from: { row: 0, col: 3 }, to: { row: 0, col: 1 } },
    ],
    playerMove: null,
    computerMove: null,
    ...overrides,
  };
}

const cell = (r: number, c: number) => screen.getByRole('button', { name: new RegExp(`^Square ${r},${c}( |$)`) });

async function startGame(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'New game' }));
  await screen.findByRole('grid');
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  Object.defineProperty(window.navigator, 'language', { value: 'en-US', configurable: true });
  createGameMock.mockReset();
  playMoveMock.mockReset();
});
afterEach(cleanup);

describe('App board interaction', () => {
  it('shows legal targets for the selected piece and clears them when deselected', async () => {
    const user = userEvent.setup();
    createGameMock.mockResolvedValue(view());
    render(<App />);
    await startGame(user);

    expect(screen.getByText('Attackers to move')).toBeTruthy();
    await user.click(cell(0, 3));
    expect(cell(0, 3).className).toContain('selected');
    expect(cell(0, 2).className).toContain('target');
    expect(cell(0, 1).className).toContain('target');
    expect(cell(0, 4).className).not.toContain('target');

    await user.click(cell(0, 3));
    expect(cell(0, 3).className).not.toContain('selected');
    expect(cell(0, 2).className).not.toContain('target');
  });

  it("ignores the opponent's pieces and empty squares when nothing is selected, and re-selects on own piece", async () => {
    const user = userEvent.setup();
    createGameMock.mockResolvedValue(view());
    render(<App />);
    await startGame(user);

    await user.click(cell(2, 3));
    await user.click(cell(1, 1));
    expect(document.querySelector('.selected')).toBeNull();

    await user.click(cell(0, 3));
    await user.click(cell(3, 0));
    expect(cell(3, 0).className).toContain('selected');
    expect(cell(0, 3).className).not.toContain('selected');
    expect(playMoveMock).not.toHaveBeenCalled();
  });

  it('plays a move, records history, and highlights the last move and captures', async () => {
    const user = userEvent.setup();
    createGameMock.mockResolvedValue(view());
    const played: MoveRecord = { side: 'attacker', from: { row: 0, col: 3 }, to: { row: 0, col: 2 }, captured: [{ row: 2, col: 3 }] };
    playMoveMock.mockResolvedValue(
      view({ board: board({ '0,2': 'attacker', '3,0': 'attacker', '3,3': 'king' }), turn: 'defender', playerMove: played }),
    );
    render(<App />);
    await startGame(user);

    await user.click(cell(0, 3));
    await user.click(cell(0, 2));

    expect(playMoveMock).toHaveBeenCalledWith('g1', { row: 0, col: 3 }, { row: 0, col: 2 });
    expect(await screen.findByText('Defenders to move')).toBeTruthy();
    expect(screen.getByText('Attackers: 0,3 → 0,2 ×1')).toBeTruthy();
    expect(cell(0, 2).className).toContain('last');
    expect(cell(2, 3).className).toContain('captured');
    expect(document.querySelector('.selected')).toBeNull();
  });

  it('shows a friendly message and keeps the game when the server rejects a move', async () => {
    const user = userEvent.setup();
    createGameMock.mockResolvedValue(view());
    playMoveMock.mockRejectedValue(new ApiError('Illegal move', 400));
    render(<App />);
    await startGame(user);

    await user.click(cell(0, 3));
    await user.click(cell(0, 2));

    expect((await screen.findByRole('alert')).textContent).toBe('Invalid move.');
    expect(screen.getByText('Attackers to move')).toBeTruthy();
    expect(screen.getByText('No moves yet.')).toBeTruthy();
  });

  it('reports connection failures', async () => {
    const user = userEvent.setup();
    createGameMock.mockRejectedValue(new TypeError('network'));
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'New game' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not reach the server.');
  });
});

describe('App undo', () => {
  it('replays all but the last move in a fresh game of the same variant', async () => {
    const user = userEvent.setup();
    const m1: MoveRecord = { side: 'attacker', from: { row: 0, col: 3 }, to: { row: 0, col: 2 } };
    const m2: MoveRecord = { side: 'defender', from: { row: 2, col: 3 }, to: { row: 2, col: 2 } };
    createGameMock.mockResolvedValueOnce(view()).mockResolvedValueOnce(view({ id: 'g2' }));
    playMoveMock
      .mockResolvedValueOnce(view({ turn: 'defender', playerMove: m1 }))
      .mockResolvedValueOnce(view({ playerMove: m2 }))
      .mockResolvedValueOnce(view({ id: 'g2', turn: 'defender', playerMove: m1 }));
    render(<App />);
    await startGame(user);
    const undo = screen.getByRole('button', { name: 'Undo move' }) as HTMLButtonElement;
    expect(undo.disabled).toBe(true);

    await user.click(cell(0, 3));
    await user.click(cell(0, 2));
    await screen.findByText('Attackers: 0,3 → 0,2');
    await user.click(cell(2, 3));
    await user.click(cell(2, 2));
    await screen.findByText('Defenders: 2,3 → 2,2');

    await user.click(undo);
    await waitFor(() => expect(screen.queryByText('Defenders: 2,3 → 2,2')).toBeNull());

    expect(createGameMock).toHaveBeenLastCalledWith({ mode: 'two-player', variant: 'brandubh' });
    expect(playMoveMock).toHaveBeenLastCalledWith('g2', m1.from, m1.to);
    expect(screen.getByText('Attackers: 0,3 → 0,2')).toBeTruthy();
    expect(screen.getByText('Defenders to move')).toBeTruthy();
  });

  it('is unavailable against the computer', async () => {
    const user = userEvent.setup();
    createGameMock.mockResolvedValue(view({ mode: 'vs-computer', difficulty: 'easy' }));
    render(<App />);
    await user.selectOptions(screen.getByLabelText('Mode'), 'vs-computer');
    await startGame(user);
    expect((screen.getByRole('button', { name: 'Undo move' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('App setup controls', () => {
  it('sends the chosen variant and difficulty, and only offers difficulty against the computer', async () => {
    const user = userEvent.setup();
    createGameMock.mockResolvedValue(view());
    render(<App />);
    expect(screen.queryByLabelText('Difficulty')).toBeNull();

    await user.selectOptions(screen.getByLabelText('Mode'), 'vs-computer');
    await user.selectOptions(screen.getByLabelText('Variant'), 'tablut');
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'hard');
    await user.click(screen.getByRole('button', { name: 'New game' }));

    expect(createGameMock).toHaveBeenCalledWith({ mode: 'vs-computer', computerSide: 'defender', difficulty: 'hard', variant: 'tablut' });
  });

  it('switches language and shows the online lobby instead of the local controls', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText('Language'), 'de');
    expect(screen.getByRole('button', { name: 'Neues Spiel' })).toBeTruthy();
    expect(document.documentElement.lang).toBe('de');

    await user.selectOptions(screen.getByLabelText('Modus'), 'online');
    expect(screen.getByText('online-stub')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Neues Spiel' })).toBeNull();
  });

  it('opens in online mode when an invite link is used', () => {
    window.history.replaceState(null, '', '/?join=ABC234');
    render(<App />);
    expect(screen.getByText('online-stub')).toBeTruthy();
  });
});

describe('App game over', () => {
  it('shows the dialog with the winner, blocks further moves and starts a new game', async () => {
    const user = userEvent.setup();
    const won = view({
      status: { kind: 'won', winner: 'attacker', reason: 'king-captured' },
      legalMoves: [],
    });
    createGameMock.mockResolvedValueOnce(won).mockResolvedValueOnce(view({ id: 'g2' }));
    render(<App />);
    await startGame(user);

    const dialog = screen.getByRole('dialog', { name: 'Game over' });
    expect(within(dialog).getByText('Attackers wins (king captured)')).toBeTruthy();

    await user.click(cell(0, 3));
    expect(document.querySelector('.selected')).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: 'Start new game' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(createGameMock).toHaveBeenCalledTimes(2);
  });
});
