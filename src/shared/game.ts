import { Session } from './session';
import type { CourseWord, Settings } from './contracts';

export const enemyTypes = {
  scout: { hp: 1, speed: 0.072, points: 100, damage: 1 },
  armored: { hp: 2, speed: 0.060, points: 200, damage: 2 },
  heavy: { hp: 3, speed: 0.049, points: 300, damage: 3 },
  reward: { hp: 1, speed: 0.115, points: 150, damage: 0 },
} as const;

const openingTargetCount = 6;
const openingSpacingMs = 500;
const refillTargetCount = 3;
export const ammoLimit = 3;
export const shotFlightMs = 145;

type EnemyType = keyof typeof enemyTypes;
export type Target = {
  id: number;
  word: string;
  codes: string[];
  kind: EnemyType;
  x: number;
  hp: number;
  bornAt: number;
  y: number;
};

export type Attack = {
  target: Target;
  at: number;
  piercing: boolean;
  destroyed: boolean;
  stockFull: boolean;
};

export class Game {
  readonly session: Session;
  targets: Target[] = [];
  attacks: Attack[] = [];
  breaches: { target: Target; at: number }[] = [];
  correct = 0;
  characters = 0;
  mistakes = 0;
  hits = 0;
  score = 0;
  combo = 0;
  bestCombo = 0;
  piercingUsed = 0;
  defense = 10;
  ammo = 0;
  outcome: 'time' | 'breach' | 'manual' | 'empty' | null = null;
  private items: CourseWord[] = [];
  private sequence = 0;
  private elapsed = 0;

  constructor(clock: () => number = () => performance.now(), private random: () => number = Math.random) {
    this.session = new Session(clock);
  }

  get usedMs() { return this.elapsed; }

  start(items: CourseWord[], settings: Settings) {
    if (!items.length) throw new Error('当前课程暂无可练内容。');
    this.session.start(settings);
    this.items = items;
    this.targets = [];
    this.attacks = [];
    this.breaches = [];
    this.correct = this.characters = this.mistakes = this.hits = this.score = this.combo = this.ammo = 0;
    this.bestCombo = this.piercingUsed = 0;
    this.defense = 10;
    this.elapsed = this.sequence = 0;
    this.outcome = null;
  }

  private spawn(at: number) {
    const activeWords = new Set(this.targets.map(target => target.word));
    const available = this.items.filter(item => !activeWords.has(item.word));
    if (!available.length) return false;
    const item = available[Math.floor(this.random() * available.length)];
    const roll = this.random();
    let kind: EnemyType = 'scout';
    if (at >= 4800 && roll >= 0.88) kind = 'reward';
    else if (at >= 14400 && roll >= 0.70) kind = 'heavy';
    else if (at >= 4800 && roll >= 0.48) kind = 'armored';
    this.targets.push({
      id: ++this.sequence, word: item.word, codes: [...item.codes], x: this.spawnX(at), kind,
      hp: enemyTypes[kind].hp, bornAt: at, y: 0,
    });
    return true;
  }

  private spawnX(at: number) {
    // Prefer space between enemies still close to the top of the field.
    const nearby = this.targets.filter(target => (at - target.bornAt) * enemyTypes[target.kind].speed < 200);
    const offset = this.random();
    if (!nearby.length) return 0.10 + 0.80 * offset;
    let best = 0, bestClearance = -1;
    for (let index = 0; index < 12; index++) {
      const x = 0.10 + 0.80 * (index + offset) / 12;
      const clearance = Math.min(...nearby.map(target => Math.abs(target.x - x)));
      if (clearance > bestClearance) {
        best = x;
        bestClearance = clearance;
      }
    }
    return best;
  }

  private fill(at: number) {
    while (this.targets.length < refillTargetCount && this.spawn(at)) {
      // A small course may run out of distinct words before the target count.
    }
  }

  tick() {
    if (!this.session.active || this.session.phase === 'paused') return;
    this.session.tick();
    if (this.session.phase === 'countdown') return;
    const duration = this.session.settingsSnapshot!.duration * 60000;
    const until = duration - this.session.remainingMs;
    if (!this.sequence) {
      const count = Math.min(openingTargetCount, this.items.length);
      // Start the leading ships farther along their flight paths.
      for (let index = count - 1; index >= 0; index--) this.spawn(-index * openingSpacingMs);
    }
    else if (this.session.phase === 'running') this.fill(this.elapsed);

    // Settle breaches in chronological order, including refills after each group.
    while (true) {
      const at = Math.min(...this.targets.map(target => this.arrival(target)));
      if (at > until || at >= duration) break;
      const arrived = this.targets.filter(target => this.arrival(target) === at);
      for (const target of arrived) {
        this.defense = Math.max(0, this.defense - enemyTypes[target.kind].damage);
        this.breaches.push({target, at});
      }
      this.targets = this.targets.filter(target => !arrived.includes(target));
      if (this.defense === 0) {
        this.elapsed = at;
        this.session.remainingMs = duration - at;
        this.end('breach');
        break;
      }
      this.fill(at);
    }
    if (!this.outcome) {
      this.elapsed = until;
      if (this.session.phase === 'ended') this.outcome = 'time';
    }
    for (const target of this.targets) {
      target.y = Math.min(1, (this.elapsed - target.bornAt) * enemyTypes[target.kind].speed / 1000);
    }
    this.attacks = this.attacks.filter(attack => this.elapsed - attack.at < 650);
    this.breaches = this.breaches.filter(breach => this.elapsed - breach.at < 400);
  }

  private arrival(target: Target) { return target.bornAt + 1000 / enemyTypes[target.kind].speed; }

  pause() { this.tick(); this.session.pause(); }
  resume() { this.session.resume(); this.tick(); }
  finish() { this.tick(); if (this.session.active) this.end('manual'); }

  private end(outcome: NonNullable<Game['outcome']>) {
    this.outcome = outcome;
    if (this.session.active) this.session.end();
  }

  answer(code: string | null): Attack | false | null {
    this.tick();
    if (this.session.phase !== 'running' || !code) return null;
    const target = this.targets.filter(item => item.codes.includes(code))
      .sort((a, b) => b.y - a.y || a.id - b.id)[0];
    if (!target) {
      this.mistakes++;
      this.combo = 0;
      return false;
    }

    this.hits++;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const piercing = target.hp > 1 && this.ammo > 0;
    if (piercing) {
      this.ammo--;
      this.piercingUsed++;
    }
    target.hp = piercing ? 0 : target.hp - 1;
    const destroyed = target.hp === 0;
    const stockFull = destroyed && target.kind === 'reward' && this.ammo === ammoLimit;
    if (destroyed) {
      this.targets = this.targets.filter(item => item !== target);
      this.correct++;
      this.characters += Array.from(target.word).length;
      this.score += enemyTypes[target.kind].points;
      if (target.kind === 'reward' && !stockFull) this.ammo++;
    }
    const attack = {target: {...target}, at: this.elapsed, piercing, destroyed, stockFull};
    this.attacks.push(attack);
    if (destroyed) this.fill(this.elapsed);
    return attack;
  }

  sync(items: CourseWord[]) {
    this.tick();
    this.items = items;
    const byWord = new Map(items.map(item => [item.word, item.codes]));
    this.targets = this.targets.filter(target => byWord.has(target.word));
    for (const target of this.targets) target.codes = [...byWord.get(target.word)!];
    if (this.session.active && !items.length) this.end('empty');
    else if (this.session.phase === 'running') this.fill(this.elapsed);
  }

  statistics() {
    const answered = this.hits + this.mistakes;
    return {
      correct: this.correct, characters: this.characters, mistakes: this.mistakes,
      accuracy: answered ? this.hits / answered : null,
      speed: this.usedMs ? this.characters / (this.usedMs / 60000) : 0,
    };
  }
}
