import { normalizeSessionOptions } from '../config/sessionDefaults.js';
import { normalizeLocale } from '../i18n/locale.js';
import { TurnStateMachine } from './stateMachine.js';

export const FAIR_SESSION_STORAGE_KEY = 'fruit-salad/fair-session';
export const FAIR_SESSION_SNAPSHOT_VERSION = 1;

function canUseStorage(storage) {
  return !!storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function' && typeof storage.removeItem === 'function';
}

function cloneValue(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function normalizeTurnTimer(turnTimer, now = Date.now()) {
  if (!turnTimer) {
    return null;
  }

  const limitMs = Math.max(0, Number(turnTimer.limitMs ?? 0));
  const rawDeadlineAt = Number.isFinite(turnTimer.deadlineAt) ? Number(turnTimer.deadlineAt) : null;
  const remainingMs = rawDeadlineAt !== null
    ? Math.max(0, rawDeadlineAt - now)
    : Math.max(0, Number(turnTimer.remainingMs ?? limitMs));

  return {
    limitMs,
    remainingMs,
    deadlineAt: limitMs > 0 ? now + remainingMs : null
  };
}

function buildRestoredTurnTimer(snapshotTurnTimer, now = Date.now()) {
  if (!snapshotTurnTimer) {
    return null;
  }

  const limitMs = Math.max(0, Number(snapshotTurnTimer.limitMs ?? 0));
  const rawDeadlineAt = Number.isFinite(snapshotTurnTimer.deadlineAt) ? Number(snapshotTurnTimer.deadlineAt) : null;
  const remainingMs = rawDeadlineAt !== null
    ? Math.max(0, rawDeadlineAt - now)
    : Math.max(0, Number(snapshotTurnTimer.remainingMs ?? limitMs));

  return {
    limitMs,
    remainingMs,
    deadlineAt: limitMs > 0 ? now + remainingMs : null
  };
}

export function buildFairSessionSnapshot(state, now = Date.now()) {
  const session = state?.session ?? null;
  if (!session || session.options?.seedDemoProgress === true) {
    return null;
  }

  const locale = normalizeLocale(state?.locale ?? session.options?.locale ?? 'ru');
  const sessionOptions = normalizeSessionOptions(session.options ?? {}, locale);
  const lastFairSessionOptions = normalizeSessionOptions(
    state?.lastFairSessionOptions ?? sessionOptions,
    locale
  );

  return {
    version: FAIR_SESSION_SNAPSHOT_VERSION,
    savedAt: now,
    locale,
    lastFairSessionOptions,
    session: {
      options: sessionOptions,
      players: cloneValue(session.players ?? []),
      decks: cloneValue(session.decks ?? []),
      turnNumber: Math.max(1, Number(session.turnNumber ?? 1)),
      activePlayerIndex: Math.max(0, Number(session.activePlayerIndex ?? 0)),
      viewedPlayerIndex: Math.max(0, Number(session.viewedPlayerIndex ?? 0)),
      turnTimer: normalizeTurnTimer(session.turnTimer, now),
      pendingSelection: cloneValue(session.pendingSelection ?? []),
      pendingFlip: cloneValue(session.pendingFlip ?? null),
      logs: cloneValue(session.logs ?? []),
      lastAction: session.lastAction ?? null,
      state: session.stateMachine?.state ?? 'turn'
    }
  };
}

export function restoreFairSessionSnapshot(snapshot, sessionRules, scoringCatalog, now = Date.now()) {
  if (!snapshot || snapshot.version !== FAIR_SESSION_SNAPSHOT_VERSION || !snapshot.session) {
    return null;
  }

  const locale = normalizeLocale(snapshot.locale ?? snapshot.session.options?.locale ?? 'ru');
  const sessionOptions = normalizeSessionOptions(snapshot.session.options ?? {}, locale);

  if (sessionOptions.seedDemoProgress === true) {
    return null;
  }

  const players = Array.isArray(snapshot.session.players) ? cloneValue(snapshot.session.players) : null;
  const decks = Array.isArray(snapshot.session.decks) ? cloneValue(snapshot.session.decks) : null;
  const logs = Array.isArray(snapshot.session.logs) ? cloneValue(snapshot.session.logs) : [];

  if (!players || !decks) {
    return null;
  }

  const activePlayerIndex = Math.min(Math.max(0, Number(snapshot.session.activePlayerIndex ?? 0)), Math.max(0, players.length - 1));
  const viewedPlayerIndex = Math.min(Math.max(0, Number(snapshot.session.viewedPlayerIndex ?? activePlayerIndex)), Math.max(0, players.length - 1));

  return {
    locale,
    lastFairSessionOptions: normalizeSessionOptions(
      snapshot.lastFairSessionOptions ?? sessionOptions,
      locale
    ),
    session: {
      options: sessionOptions,
      players,
      decks,
      scoringCatalog,
      rules: sessionRules,
      stateMachine: new TurnStateMachine(snapshot.session.state ?? 'turn'),
      turnNumber: Math.max(1, Number(snapshot.session.turnNumber ?? 1)),
      activePlayerIndex,
      viewedPlayerIndex,
      turnTimer: buildRestoredTurnTimer(snapshot.session.turnTimer, now),
      pendingSelection: Array.isArray(snapshot.session.pendingSelection) ? cloneValue(snapshot.session.pendingSelection) : [],
      pendingFlip: cloneValue(snapshot.session.pendingFlip ?? null),
      logs,
      lastAction: snapshot.session.lastAction ?? null
    }
  };
}

export function saveFairSessionState(state, storage = globalThis.localStorage, now = Date.now()) {
  if (!canUseStorage(storage)) {
    return false;
  }

  const snapshot = buildFairSessionSnapshot(state, now);
  if (!snapshot) {
    storage.removeItem(FAIR_SESSION_STORAGE_KEY);
    return false;
  }

  storage.setItem(FAIR_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  return true;
}

export function loadFairSessionState(sessionRules, scoringCatalog, storage = globalThis.localStorage, now = Date.now()) {
  if (!canUseStorage(storage)) {
    return null;
  }

  const rawSnapshot = storage.getItem(FAIR_SESSION_STORAGE_KEY);
  if (!rawSnapshot) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSnapshot);
    const restored = restoreFairSessionSnapshot(parsed, sessionRules, scoringCatalog, now);
    if (!restored) {
      storage.removeItem(FAIR_SESSION_STORAGE_KEY);
      return null;
    }

    return restored;
  } catch {
    storage.removeItem(FAIR_SESSION_STORAGE_KEY);
    return null;
  }
}

export function clearFairSessionState(storage = globalThis.localStorage) {
  if (!canUseStorage(storage)) {
    return false;
  }

  storage.removeItem(FAIR_SESSION_STORAGE_KEY);
  return true;
}
