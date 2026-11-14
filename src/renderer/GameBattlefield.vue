<script setup lang="ts">
/// <reference types="vite/client" />
import { computed, onMounted } from 'vue';
import { enemyTypes, shotFlightMs, type Game, type Target } from '../shared/game';
import background from '../assets/game/scene/background/orbital-nebula-v2.png';
import foreground from '../assets/game/scene/foreground/asteroids-v2.png';
import shield from '../assets/game/scene/shield/arc-v2.png';
import ripple from '../assets/game/scene/shield/impact-sheet-v2.png';
import explosion from '../assets/game/combat/v2/explosion-sheet.png';
import effects from '../assets/game/combat/v2/effects-atlas-clean.png';

const props = defineProps<{ game: Game; version: number; aim: Target | null; preview: boolean }>();
const hulls = import.meta.glob<string>('../assets/game/display/*ship*.png', { eager: true, import: 'default', query: '?url' });
const enemies = import.meta.glob<string>('../assets/game/display/enemy_*.png', { eager: true, import: 'default', query: '?url' });
const player = hulls['../assets/game/display/player_ship.png'];
const texture = (path: string) => `url("${path}")`;

onMounted(() => {
  for (const url of [foreground, shield, ripple, explosion, effects, player, ...Object.values(enemies)]) new Image().src = url;
});

// Follow the shield arc across the full width of the battlefield.
const rim = (x: number) => 28 * (2 * x - 1) ** 2;
const position = (target: Target) => ({
  left: `${target.x * 100}%`,
  top: `calc(${target.y * 100}% + ${rim(target.x) * target.y}px)`,
});
const aimStyle = (target: Target) => ({
  '--dx': `${target.x * 100 - 50}cqw`,
  '--dy': `calc(${(1 - target.y) * 100}cqh + var(--player-offset) - ${rim(target.x) * target.y}px)`,
});
function atlas(url: string, index: number) {
  return { backgroundImage: texture(url), backgroundPosition: `${(index % 4) * 100 / 3}% ${index < 4 ? 0 : 100}%` };
}
const plume = atlas(effects, 4);
const smoke = atlas(effects, 5);
const cracks = atlas(effects, 6);
const muzzle = atlas(effects, 2);

const scene = computed(() => {
  void props.version;
  const game = props.game;
  const now = game.usedMs;
  const shots = game.attacks.map(attack => {
    const age = now - attack.at;
    const target = game.targets.find(item => item.id === attack.target.id) ?? attack.target;
    const progress = Math.min(1, age / shotFlightMs);
    const impact = age - shotFlightMs;
    const large = enemyTypes[target.kind].hp > 1;
    const frameMs = large ? 59 : 46;
    const frame = Math.floor(impact / frameMs);
    return {
      key: `${attack.target.id}-${attack.target.hp}`,
      bullet: impact < 0,
      piercing: attack.piercing,
      blast: attack.destroyed && impact >= 0,
      large,
      visible: impact < (attack.destroyed ? 8 * frameMs : 145),
      points: attack.destroyed && impact >= 0 ? enemyTypes[target.kind].points : 0,
      rise: Math.max(0, impact) * .08,
      opacity: Math.min(1, Math.max(0, (505 - impact) / 120)),
      art: impact < 0 ? atlas(effects, attack.piercing ? 1 : 0)
        : attack.destroyed ? atlas(explosion, Math.min(7, frame)) : atlas(effects, 3),
      style: {
        left: `${50 + (target.x * 100 - 50) * progress}%`,
        top: `calc(${100 - (1 - target.y) * 100 * progress}% + var(--player-offset) * ${1 - progress} + ${rim(target.x) * target.y * progress}px - var(--muzzle-offset) * ${1 - progress})`,
        ...aimStyle(target),
      },
    };
  });
  return {
    targets: game.targets,
    shots,
    firing: game.attacks.some(attack => now - attack.at < 75),
    impacts: game.breaches.filter(({ target }) => target.kind !== 'reward').map(({ target, at }) => ({
      id: target.id, ...position({ ...target, y: 1 }),
      art: atlas(ripple, Math.min(7, Math.floor((now - at) / 50))),
    })),
    barrier: game.defense <= 3 ? 'critical' : game.defense <= 6 ? 'damaged' : 'normal',
    running: game.session.phase === 'running',
    spent: game.session.phase === 'ended',
  };
});
</script>

<template>
  <div class="game-arena" aria-label="太空战场" :class="{ 'is-running': scene.running }" :style="{ backgroundImage: texture(background) }">
    <img class="asteroids" :src="foreground" alt="">
    <div class="flight-area">
      <img class="defense-line" :data-defense="preview ? 'normal' : scene.barrier" :src="shield" alt="">
      <div class="player" :style="!preview && aim ? aimStyle(aim) : undefined">
        <span class="atlas exhaust" :style="plume"></span><span class="atlas exhaust" :style="plume"></span>
        <img class="player-ship" :src="player" alt="">
        <span v-if="!preview && scene.firing" class="atlas muzzle" :style="muzzle"></span>
      </div>
      <template v-if="!preview && !scene.spent">
        <div v-for="target in scene.targets" :key="target.id" class="game-target"
          :data-word="target.word" :data-hp="target.hp" :data-kind="target.kind" :style="position(target)">
          <div class="enemy-hull">
            <span class="atlas exhaust" :style="plume"></span><span class="atlas exhaust" :style="plume"></span>
            <img class="enemy-ship" :src="enemies[`../assets/game/display/enemy_${target.kind}.png`]" alt="">
            <span v-if="target.hp < enemyTypes[target.kind].hp" class="atlas enemy-damage" :style="cracks"></span>
            <span v-if="target.hp < enemyTypes[target.kind].hp" class="atlas enemy-smoke"
              :class="{ severe: enemyTypes[target.kind].hp - target.hp > 1 }" :style="smoke"></span>
          </div>
          <div class="enemy-core"><strong>{{ target.word }}</strong></div>
          <span class="enemy-hp" :aria-label="`耐久 ${target.hp} / ${enemyTypes[target.kind].hp}`">
            <i v-for="point in enemyTypes[target.kind].hp" :key="point" :class="{ depleted: point > target.hp }"></i>
          </span>
        </div>
        <span v-for="impact in scene.impacts" :key="impact.id" class="atlas shield-impact" :style="[impact.art, { left: impact.left, top: impact.top }]"></span>
        <template v-for="shot in scene.shots" :key="shot.key">
          <span v-if="shot.visible" class="atlas shot" :class="{ bullet: shot.bullet, piercing: shot.piercing, blast: shot.blast, large: shot.large }" :style="[shot.art, shot.style]"></span>
          <span v-if="shot.points" class="shot-points" :style="[shot.style, { marginTop: `-${shot.rise}px`, opacity: shot.opacity }]">+{{ shot.points }}</span>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped src="./game-battlefield.css"></style>
