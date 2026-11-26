// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Board, OnlineSeat, OnlineView, Square } from './api';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  createOnlineGame: vi.fn(),
  joinOnlineGame: vi.fn(),
  fetchOnlineGame: vi.fn(),
  playOnlineMove: vi.fn(),
}));

import { ApiError, createOnlineGame, fetchOnlineGame, joinOnlineGame, playOnlineMove } from './api';
import { translator } from './i18n';
import OnlineGame from './OnlineGame';

const createMock = vi.mocked(createOnlineGame);
const joinMock = vi.mocked(joinOnlineGame);
const fetchMock = vi.mocked(fetchOnlineGame);
const playMock = vi.mocked(playOnlineMove);
const t = translator('en');
const YOUR_TURN = t('onlineYourTurn');

const BOARD: Board = Array.from({ length: 7 }, () => Array<Square>(7).fill(null));
BOARD[0][3] = 'attacker';
BOARD[2][3] = 'defender';
BOARD[3][3] = 'king';

function view(overrides: Partial<OnlineView> = {}): OnlineView {
  return {
    code: 'ABC234',
    you: 'attacker',
    variant: 'brandubh',
    board: BOARD,
    turn: 'attacker',
    status: { kind: 'ongoing' },
    legalMoves: [{ from: { row: 0, col: 3 }, to: { row: 0, col: 2 } }],
    opponentJoined: true,
    opponentConnected: true,
    moves: [],
    ...overrides,
  };
}

const seat = (v: OnlineView = view()): OnlineSeat => ({ token: 'tok', side: v.you, view: v });
const cell = (r: number, c: number) => screen.getByRole('button', { name: new RegExp(`^Square ${r},${c}( |$)`) });
const stored = () => JSON.parse(window.localStorage.getItem('hnefatafl.online') ?? 'null');

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  for (const m of [createMock, joinMock, fetchMock, playMock]) m.mockReset();
  fetchMock.mockResolvedValue(view());
});
afterEach(cleanup);

describe('online lobby', () => {
  it('creates a game with the chosen side and variant, remembers the session and shows the invite', async () => {
    const user = userEvent.setup();
    const waiting = view({ opponentJoined: false, opponentConnected: false, turn: 'attacker', legalMoves: [] });
    createMock.mockResolvedValue(seat(waiting));
    fetchMock.mockResolvedValue(waiting);
    render(<OnlineGame t={t} />);

    await user.selectOptions(screen.getByLabelText('Your side'), 'defender');
    await user.selectOptions(screen.getByLabelText('Variant'), 'tablut');
    await user.click(screen.getByRole('button', { name: 'Create game' }));

    expect(createMock).toHaveBeenCalledWith('defender', 'tablut');
    expect(await screen.findByText(t('onlineWaiting'))).toBeTruthy();
    expect(screen.getByText('ABC234', { selector: 'strong' })).toBeTruthy();
    expect((screen.getByDisplayValue(/\?join=ABC234$/) as HTMLInputElement).readOnly).toBe(true);
    expect(stored()).toEqual({ code: 'ABC234', token: 'tok' });
  });

  it('joins with a pasted invite link and normalises the code', async () => {
    const user = userEvent.setup();
    joinMock.mockResolvedValue(seat());
    render(<OnlineGame t={t} />);

    const join = screen.getByRole('button', { name: 'Join' }) as HTMLButtonElement;
    expect(join.disabled).toBe(true);
    await user.type(screen.getByLabelText('Game code or link'), 'http://localhost:5173/?join=abc234');
    await user.click(join);

    await waitFor(() => expect(joinMock).toHaveBeenCalledWith('ABC234'));
    expect(await screen.findByText(YOUR_TURN)).toBeTruthy();
    expect(stored()).toEqual({ code: 'ABC234', token: 'tok' });
  });

  it('prefills the code from ?join= and strips it from the address bar after entering', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?join=xyz789');
    joinMock.mockResolvedValue(seat());
    render(<OnlineGame t={t} />);

    expect((screen.getByLabelText('Game code or link') as HTMLInputElement).value).toBe('XYZ789');
    await user.click(screen.getByRole('button', { name: 'Join' }));
    await screen.findByText(YOUR_TURN);
    expect(window.location.search).toBe('');
  });

  it('rejects an invalid code locally without calling the server', async () => {
    const user = userEvent.setup();
    render(<OnlineGame t={t} />);
    await user.type(screen.getByLabelText('Game code or link'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Join' }));
    expect((await screen.findByRole('alert')).textContent).toBe(t('onlineInvalidCode'));
    expect(joinMock).not.toHaveBeenCalled();
  });

  it.each([
    [404, 'game not found', 'onlineNotFound'],
    [409, 'game is already full', 'onlineFull'],
  ] as const)('explains a %i join failure', async (status, message, key) => {
    const user = userEvent.setup();
    joinMock.mockRejectedValue(new ApiError(message, status));
    render(<OnlineGame t={t} />);
    await user.type(screen.getByLabelText('Game code or link'), 'ABC234');
    await user.click(screen.getByRole('button', { name: 'Join' }));
    expect((await screen.findByRole('alert')).textContent).toBe(t(key));
    expect(stored()).toBeNull();
  });
});

describe('online play', () => {
  beforeEach(() => window.localStorage.setItem('hnefatafl.online', JSON.stringify({ code: 'ABC234', token: 'tok' })));

  it('resumes a stored session and sends moves with the stored token', async () => {
    const user = userEvent.setup();
    playMock.mockResolvedValue(
      view({ turn: 'defender', legalMoves: [], moves: [{ side: 'attacker', from: { row: 0, col: 3 }, to: { row: 0, col: 2 } }] }),
    );
    render(<OnlineGame t={t} />);
    await screen.findByText(YOUR_TURN);
    expect(fetchMock).toHaveBeenCalledWith('ABC234', 'tok');

    await user.click(cell(0, 3));
    expect(cell(0, 2).className).toContain('target');
    await user.click(cell(0, 2));

    expect(playMock).toHaveBeenCalledWith('ABC234', 'tok', { row: 0, col: 3 }, { row: 0, col: 2 });
    expect(await screen.findByText(t('onlineTheirTurn'))).toBeTruthy();
    expect(screen.getByText('Attackers: 0,3 → 0,2')).toBeTruthy();
  });

  it("does not let the player select pieces on the opponent's turn or before the opponent joined", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(view({ turn: 'defender', legalMoves: [] }));
    const { unmount } = render(<OnlineGame t={t} />);
    await screen.findByText(t('onlineTheirTurn'));
    await user.click(cell(0, 3));
    expect(document.querySelector('.selected')).toBeNull();
    unmount();

    fetchMock.mockResolvedValue(view({ opponentJoined: false, opponentConnected: false }));
    render(<OnlineGame t={t} />);
    await screen.findByText(t('onlineWaiting'));
    await user.click(cell(0, 3));
    expect(document.querySelector('.selected')).toBeNull();
    expect(playMock).not.toHaveBeenCalled();
  });

  it('warns when the opponent is offline but not once the game is over', async () => {
    fetchMock.mockResolvedValue(view({ opponentConnected: false }));
    const { unmount } = render(<OnlineGame t={t} />);
    expect(await screen.findByText(t('onlineOpponentOffline'))).toBeTruthy();
    unmount();

    fetchMock.mockResolvedValue(
      view({ opponentConnected: false, status: { kind: 'won', winner: 'defender', reason: 'king-escaped' }, legalMoves: [] }),
    );
    render(<OnlineGame t={t} />);
    expect(await screen.findByText('Defenders wins (king escaped)')).toBeTruthy();
    expect(screen.queryByText(t('onlineOpponentOffline'))).toBeNull();
  });

  it('shows a reconnecting notice on network errors and recovers', async () => {
    fetchMock.mockResolvedValueOnce(view()).mockRejectedValueOnce(new TypeError('network')).mockResolvedValue(view());
    render(<OnlineGame t={t} />);
    expect(await screen.findByText(t('onlineReconnecting'), undefined, { timeout: 4000 })).toBeTruthy();
    expect(stored()).not.toBeNull();
    await waitFor(() => expect(screen.queryByText(t('onlineReconnecting'))).toBeNull(), { timeout: 4000 });
  });

  it('shows a restoring state instead of the lobby until the first poll succeeds', async () => {
    let resolve!: (v: OnlineView) => void;
    fetchMock.mockReturnValueOnce(new Promise<OnlineView>((r) => (resolve = r)));
    render(<OnlineGame t={t} />);
    expect(screen.getByText(t('onlineRestoring'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create game' })).toBeNull();
    resolve(view());
    await screen.findByText(YOUR_TURN);
    expect(screen.queryByText(t('onlineRestoring'))).toBeNull();
  });

  it('shows the reconnecting notice when the first poll fails, keeping the session', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network')).mockResolvedValue(view());
    render(<OnlineGame t={t} />);
    expect(await screen.findByText(t('onlineReconnecting'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create game' })).toBeNull();
    expect(stored()).not.toBeNull();
    await screen.findByText(YOUR_TURN, undefined, { timeout: 4000 });
  });

  it.each([401, 404])('drops an expired session on a %i poll', async (status) => {
    fetchMock.mockRejectedValue(new ApiError('gone', status));
    render(<OnlineGame t={t} />);
    expect((await screen.findByRole('alert')).textContent).toBe(t('onlineExpired'));
    expect(stored()).toBeNull();
    expect(screen.getByRole('button', { name: 'Create game' })).toBeTruthy();
  });

  it('maps a 403 move error to the not-your-turn message', async () => {
    const user = userEvent.setup();
    playMock.mockRejectedValue(new ApiError('it is not your turn', 403));
    render(<OnlineGame t={t} />);
    await screen.findByText(YOUR_TURN);
    await user.click(cell(0, 3));
    await user.click(cell(0, 2));
    expect((await screen.findByRole('alert')).textContent).toBe(t('onlineNotYourTurn'));
  });

  it('forgets the session when leaving', async () => {
    const user = userEvent.setup();
    render(<OnlineGame t={t} />);
    await screen.findByText(YOUR_TURN);
    await user.click(screen.getByRole('button', { name: 'Leave game' }));
    expect(stored()).toBeNull();
    expect(screen.getByRole('button', { name: 'Create game' })).toBeTruthy();
  });
});
