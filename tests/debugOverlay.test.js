import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDebugSnapshot } from '../src/ui/debugOverlay.js';

test('buildDebugSnapshot includes the active locale', () => {
  const session = {
    options: { locale: 'en' },
    players: [
      { name: 'A', salads: [], score: 0 },
      { name: 'B', salads: [], score: 0 }
    ],
    activePlayerIndex: 0,
    viewedPlayerIndex: 0,
    decks: [],
    stateMachine: { state: 'turn' },
    turnNumber: 1,
    pendingSelection: [],
    pendingFlip: null,
    scorePreview: []
  };

  const lines = buildDebugSnapshot(session, 'en');
  assert.equal(lines[0], 'lang=en');
});
