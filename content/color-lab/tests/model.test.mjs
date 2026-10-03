import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  toRgb,
  toHex,
  compareMix,
  recipeFromSearch,
  recipeUrl,
  LEVELS,
  explainColor,
} from '../site/model.js';

test('known additive color boundaries: primaries, secondaries, black and white', () => {
  const known = [
    [[0, 0, 0], '#000000'],
    [[100, 0, 0], '#FF0000'],
    [[0, 100, 0], '#00FF00'],
    [[0, 0, 100], '#0000FF'],
    [[100, 100, 0], '#FFFF00'],
    [[0, 100, 100], '#00FFFF'],
    [[100, 0, 100], '#FF00FF'],
    [[100, 100, 100], '#FFFFFF'],
  ];
  for (const [channels, expected] of known) assert.equal(toHex(channels), expected);
  assert.deepEqual(toRgb([50, 0, 100]), [128, 0, 255]);
  assert.equal(toHex([-20, 200, NaN]), '#00FF00');
  assert.match(explainColor([100, 100, 0]).title, /黄/);
  assert.match(explainColor([0, 0, 0]).title, /黑/);
});

test('a high rounded score never bypasses per-channel challenge tolerance', () => {
  assert.equal(compareMix([94, 94, 6], [100, 100, 0]).solved, true);
  const near = compareMix([93, 100, 0], [100, 100, 0]);
  assert.ok(near.score > 90);
  assert.equal(near.solved, false);
  assert.equal(near.channel, 0);
  assert.equal(near.direction, 'up');
  assert.equal(compareMix([100, 100, 30], [100, 100, 0]).direction, 'down');
  for (const level of LEVELS) {
    assert.equal(compareMix(level.channels, level.channels).score, 100);
    assert.equal(compareMix(level.channels, level.channels).solved, true);
  }
});

test('share recipes are complete bounded triples and survive a fresh URL', () => {
  const url = recipeUrl('https://color-lab.gemigo.app/?utm_source=old#ignored', [100, 55, 20]);
  assert.equal(url, 'https://color-lab.gemigo.app/?r=100&g=55&b=20');
  assert.deepEqual(recipeFromSearch(new URL(url).search), [100, 55, 20]);
  assert.deepEqual(recipeFromSearch('?r=0&g=0&b=0'), [0, 0, 0]);
  for (const invalid of [
    '',
    '?r=100&g=100',
    '?r=101&g=100&b=0',
    '?r=-1&g=0&b=0',
    '?r=&g=0&b=0',
    '?r=2.2&g=0&b=0',
    '?r=NaN&g=0&b=0',
  ]) {
    assert.equal(recipeFromSearch(invalid), null, invalid);
  }
});
