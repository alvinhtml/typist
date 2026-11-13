const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game, ammoLimit, enemyTypes } = require('../dist/shared/game');
const { defaults } = require('../dist/shared/contracts');

const items = [
  {word: '一', codes: ['g', 'gggg']},
  {word: '学习', codes: ['g', 'abcd']},
  {word: '三', codes: ['d']},
  {word: '四', codes: ['l']},
];
function setup(words = items, rolls = []) {
  let now = 0;
  let calls = 0;
  const game = new Game(() => now, () => calls++ % 2 === 0 ? 0 : rolls.shift() ?? 0);
  game.start(words, {...defaults, duration: 1});
  return {game, advance(ms) { now += ms; game.tick(); }};
}

test('paced unique targets, free selection, nearest same code and creation-order ties', () => {
  const {game, advance} = setup();
  advance(2999);
  assert.equal(game.targets.length, 0);
  advance(1);
  assert.equal(game.targets.length, 1);
  advance(2400);
  assert.deepEqual(game.targets.map(t => t.word), ['一', '学习']);
  assert.ok(game.targets[0].y > game.targets[1].y);
  assert.equal(game.answer('g').target.word, '一');
  assert.equal(game.answer('abcd').target.word, '学习');
  assert.equal(game.answer('g'), false, 'exploding targets cannot match');
  assert.equal(game.answer(null), null);
  assert.equal(game.statistics().accuracy, 2 / 3);
  assert.equal(game.characters, 3);
  assert.equal(game.combo, 0);
  assert.equal(game.bestCombo, 2);

  advance(4800);
  // Match a pair at the same simulated distance.
  game.targets[1].bornAt = game.targets[0].bornAt;
  const oldest = game.targets[0].id;
  assert.equal(game.answer('g').target.id, oldest);
});

test('ordinary damage is immediate and piercing only spends ammo on multiple remaining HP', () => {
  const {game, advance} = setup(items, [0, 0, 0.6, 0.95, 0.6, 0, 0.75]);
  advance(5400);
  assert.equal(game.answer('gggg').destroyed, true);
  assert.equal(game.answer('abcd').destroyed, true);
  advance(2400);
  const hit = game.answer('gggg');
  assert.equal(hit.target.kind, 'armored');
  assert.equal(hit.target.hp, 1);
  assert.equal(hit.destroyed, false);
  assert.equal(game.score, 200);
  advance(2400);
  assert.equal(game.answer('abcd').target.kind, 'reward');
  assert.equal(game.ammo, 1);
  assert.equal(game.answer('gggg').piercing, false);
  assert.equal(game.ammo, 1);
  advance(2400);
  const piercing = game.answer('gggg');
  assert.equal(piercing.piercing, true);
  assert.equal(piercing.destroyed, true);
  assert.equal(game.ammo, 0);
  assert.equal(game.piercingUsed, 1);
  advance(4800);
  const heavy = game.targets.find(t => t.kind === 'heavy');
  assert.ok(heavy);
  for (const hp of [2, 1, 0]) assert.equal(game.answer(heavy.codes.at(-1)).target.hp, hp);
  assert.equal(game.score, 1050);
  assert.equal(game.correct, 6);
  assert.equal(game.combo, 9);
  assert.equal(game.statistics().accuracy, 1);
});

test('reward scores once, caps stock and reports full inventory', () => {
  const {game, advance} = setup([items[0]], [0, 0, 0.95, 0.95, 0.95, 0.95]);
  advance(3000);
  game.answer('g');
  advance(2400);
  game.answer('g');
  for (let index = 1; index <= 4; index++) {
    advance(2400);
    assert.equal(game.answer('g').stockFull, index > ammoLimit);
    assert.equal(game.ammo, Math.min(ammoLimit, index));
    assert.equal(game.answer('g'), false);
  }
  assert.equal(game.score, 800);
});

test('reward escape is harmless and damaged enemies breach for their original HP', () => {
  const {game, advance} = setup(items, [0, 0, 0.6, 0.95]);
  advance(5400);
  game.answer('gggg');
  game.answer('abcd');
  advance(2400);
  assert.equal(game.answer('gggg').target.hp, 1);
  advance(11100);
  assert.equal(game.defense, 10);
  assert.equal(game.breaches[0].target.kind, 'reward');
  advance(6000);
  assert.equal(game.defense, 8);
  assert.equal(game.correct, 2);
});

test('late tick settles at the first depleted-defense event or the time limit', () => {
  const {game, advance} = setup(items, Array(30).fill(0.75));
  advance(63000);
  assert.equal(game.outcome, 'breach');
  assert.equal(game.defense, 0);
  assert.ok(game.usedMs < 60000);
  assert.equal(game.session.remainingMs, 60000 - game.usedMs);
  assert.equal(game.answer('g'), null);

  const timed = setup([items[0]], Array(30).fill(0.95));
  timed.advance(62999);
  assert.equal(timed.game.session.phase, 'running');
  timed.advance(1);
  assert.equal(timed.game.outcome, 'time');
  assert.equal(timed.game.usedMs, 60000);
  assert.equal(timed.game.answer('g'), null);
});

test('pause freezes movement, spawn, effects and time; sync updates codes and removes invalid targets', () => {
  const {game, advance} = setup();
  advance(5400);
  game.answer('abcd');
  game.pause();
  const position = game.targets[0].y;
  advance(60000);
  assert.equal(game.targets[0].y, position);
  assert.equal(game.usedMs, 2400);
  assert.equal(game.attacks.length, 1);
  assert.equal(game.answer('g'), null);
  game.sync([{word:'一', codes:['x']}]);
  game.resume();
  assert.equal(game.answer('g'), false);
  assert.equal(game.answer('x').destroyed, true);
  assert.equal(game.statistics().speed, 75);
  assert.equal(game.statistics().accuracy, 2 / 3);
  game.sync([]);
  assert.equal(game.outcome, 'empty');
  assert.equal(game.targets.length, 0);
  assert.throws(() => game.start([], defaults), /暂无/);

  game.start(items, {...defaults, difficulty: 'hard'});
  assert.equal(game.usedMs, 0);
  assert.equal(game.correct, 0);
  assert.equal(game.ammo, 0);
  assert.equal(game.defense, 10);
  advance(3000);
  assert.equal(game.targets.length, 1);
  assert.equal(game.targets[0].hp, enemyTypes.scout.hp);
  game.finish();
  assert.equal(game.outcome, 'manual');
});
