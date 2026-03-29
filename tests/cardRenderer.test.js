import test from 'node:test';
import assert from 'node:assert/strict';

import { getPerFruitMultiDisplayIcons, getSaladDescriptor } from '../src/ui/cardRenderer.js';

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

test('getSaladDescriptor uses compact localized copy for dense salad cards', () => {
  assert.deepEqual(
    getSaladDescriptor({
      ruleType: 'compare-poverty',
      saladFruits: [],
      scoring: { points: 7 }
    }, 'ru'),
    {
      title: 'Меньше фр.',
      subtitle: '+7',
      icons: [{ special: 'basket' }]
    }
  );

  assert.equal(
    getSaladDescriptor({
      ruleType: 'missing-kind',
      saladFruits: ['kiwi'],
      scoring: { pointsPerMissingKind: 3 }
    }, 'ru').subtitle,
    '+3 /вид'
  );
});
