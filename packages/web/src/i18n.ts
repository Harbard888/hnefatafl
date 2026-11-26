export type Lang = 'de' | 'en';

const messages = {
  de: {
    title: 'Hnefatafl',
    language: 'Sprache',
    mode: 'Modus',
    modeTwoPlayer: 'Zwei Spieler',
    modeVsComputer: 'Gegen den Computer (Verteidiger)',
    difficulty: 'Schwierigkeit',
    difficultyEasy: 'Leicht',
    difficultyMedium: 'Mittel',
    difficultyHard: 'Schwer',
    newGame: 'Neues Spiel',
    board: 'Spielbrett',
    square: 'Feld {row},{col}',
    attacker: 'Angreifer',
    defender: 'Verteidiger',
    king: 'König',
    turn: 'Am Zug: {side}',
    winner: '{side} gewinnt ({reason})',
    reason_king_escaped: 'König entkommen',
    reason_king_captured: 'König gefangen',
    reason_exit_fort: 'Ausstiegs-Fort',
    reason_encirclement: 'Umzingelung',
    reason_no_legal_moves: 'keine legalen Züge',
    computerMove: 'Computer zieht von {from} nach {to}.',
    history: 'Zugverlauf',
    noMoves: 'Noch keine Züge.',
    undo: 'Zug zurücknehmen',
    undoUnavailable: 'Zurücknehmen ist nur im Zwei-Spieler-Modus möglich.',
    gameOver: 'Spiel beendet',
    playAgain: 'Neues Spiel starten',
    moveRejected: 'Ungültiger Zug.',
    connectionError: 'Verbindung zum Server fehlgeschlagen.',
  },
  en: {
    title: 'Hnefatafl',
    language: 'Language',
    mode: 'Mode',
    modeTwoPlayer: 'Two players',
    modeVsComputer: 'Against the computer (defenders)',
    difficulty: 'Difficulty',
    difficultyEasy: 'Easy',
    difficultyMedium: 'Medium',
    difficultyHard: 'Hard',
    newGame: 'New game',
    board: 'Board',
    square: 'Square {row},{col}',
    attacker: 'Attackers',
    defender: 'Defenders',
    king: 'King',
    turn: '{side} to move',
    winner: '{side} wins ({reason})',
    reason_king_escaped: 'king escaped',
    reason_king_captured: 'king captured',
    reason_exit_fort: 'exit fort',
    reason_encirclement: 'encirclement',
    reason_no_legal_moves: 'no legal moves',
    computerMove: 'Computer moved from {from} to {to}.',
    history: 'Move history',
    noMoves: 'No moves yet.',
    undo: 'Undo move',
    undoUnavailable: 'Undo is only available in two-player mode.',
    gameOver: 'Game over',
    playAgain: 'Start new game',
    moveRejected: 'Invalid move.',
    connectionError: 'Could not reach the server.',
  },
} as const satisfies Record<Lang, Record<string, string>>;

export type MessageKey = keyof typeof messages.de;
export const DIFFICULTY_KEYS = {
  easy: 'difficultyEasy',
  medium: 'difficultyMedium',
  hard: 'difficultyHard',
} as const satisfies Record<string, MessageKey>;

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function detectLang(): Lang {
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function translator(lang: Lang): Translate {
  return (key, vars = {}) =>
    messages[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
