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
  const game = new Game(() => now, () => calls++ % 3 === 1 ? rolls.shift() ?? 0 : 0);
  game.start(words, {...defaults, duration: 1});
  return {game, advance(ms) { now += ms; game.tick(); }};
}

test('six unique opening targets, no timed spawns, and immediate refill below three', () => {
  const extra = ['五', '六', '七'].map((word, index) => ({word, codes: [String(index)]}));
  const {game, advance} = setup([...items, ...extra]);
  advance(2999);
  assert.equal(game.targets.length, 0);
  advance(1);
  assert.equal(game.targets.length, 6);
  assert.equal(new Set(game.targets.map(t => t.word)).size, 6);
  assert.equal(new Set(game.targets.map(t => t.x)).size, 6);
  assert.ok(game.targets.every(t => t.x >= .1 && t.x <= .9));
  assert.ok(game.targets.every((target, index, wave) => index === 0 || target.y < wave[index - 1].y));
  advance(4800);
  assert.equal(game.targets.length, 6);
  assert.equal(game.answer('g').target.word, '一', 'closest to the defense wins');
  assert.equal(game.answer('g').target.word, '学习');
  assert.equal(game.answer('g'), false, 'destroyed words do not match before refill');
  game.answer('d');
  assert.equal(game.targets.length, 3);
  game.answer('l');
  assert.equal(game.targets.length, 3);
  assert.ok(game.targets.some(target => target.bornAt === game.usedMs));
  assert.equal(game.characters, 5);
  assert.equal(game.statistics().accuracy, 4 / 5);
});

test('ordinary damage and piercing update HP, score and inventory immediately', () => {
  const {game, advance} = setup([items[0]], [0, 0.6, 0.95, 0.75]);
  advance(15000);
  assert.equal(game.answer('g').destroyed, true);
  const hit = game.answer('g');
  assert.equal(hit.target.kind, 'armored');
  assert.equal(hit.target.hp, 1);
  assert.equal(hit.destroyed, false);
  advance(2400);
  assert.equal(game.answer('g').piercing, false);
  assert.equal(game.answer('g').target.kind, 'reward');
  assert.equal(game.ammo, 1);
  const piercing = game.answer('g');
  assert.equal(piercing.target.kind, 'heavy');
  assert.equal(piercing.piercing, true);
  assert.equal(piercing.destroyed, true);
  assert.equal(game.ammo, 0);
  assert.equal(game.piercingUsed, 1);
  assert.equal(game.score, 750);
  assert.equal(game.correct, 4);
  assert.equal(game.combo, 5);
});

test('reward scores once, caps stock and reports full inventory', () => {
  const {game, advance} = setup([items[0]], Array(5).fill(0.95));
  advance(7800);
  game.answer('g');
  for (let index = 1; index <= 4; index++) {
    assert.equal(game.answer('g').stockFull, index > ammoLimit);
    assert.equal(game.ammo, Math.min(ammoLimit, index));
  }
  assert.equal(game.score, 700);
});

test('reward escape is harmless and damaged enemies breach for their original HP', () => {
  const {game, advance} = setup([items[0]], [0, 0.95, 0.6]);
  advance(7800);
  game.answer('g');
  advance(8700);
  assert.equal(game.defense, 10);
  assert.equal(game.breaches[0].target.kind, 'reward');
  assert.equal(game.answer('g').target.hp, 1);
  advance(16670);
  assert.equal(game.defense, 8);
  assert.equal(game.correct, 1);
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
  assert.equal(game.targets.length, 4);
  assert.equal(game.targets[0].hp, enemyTypes.scout.hp);
  game.finish();
  assert.equal(game.outcome, 'manual');
});
