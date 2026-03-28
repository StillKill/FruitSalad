import test from 'node:test';
import assert from 'node:assert/strict';

import { getPerFruitMultiDisplayIcons } from '../src/ui/cardRenderer.js';

test('per-fruit-multi display icons are sorted by descending points while keeping tied order stable', () => {
  const icons = getPerFruitMultiDisplayIcons({
    ruleType: 'per-fruit-multi',
    saladFruits: ['orange', 'lime', 'kiwi', 'apple'],
    scoring: {
      points: [1, -4, 2, 1]
    }
  });

  assert.deepEqual(icons, [
    { fruit: 'kiwi', label: '+2' },
    { fruit: 'orange', label: '+1' },
    { fruit: 'apple', label: '+1' },
    { fruit: 'lime', label: '-4' }
  ]);
});
