import { ref, watch } from 'vue';
import countdownGo from '../assets/game/audio/countdown-go.wav?url';
import countdownTick from '../assets/game/audio/countdown-tick.wav?url';
import enemyHit from '../assets/game/audio/enemy-hit.wav?url';
import inputConfirm from '../assets/game/audio/input-confirm.wav?url';
import laserFire from '../assets/game/audio/laser-fire.wav?url';
import orbitalLoop from '../assets/game/audio/orbital-loop.wav?url';
import shieldDamage from '../assets/game/audio/shield-damage.wav?url';

function volumePreference(name: string, fallback: number) {
  const key = `typist.audio.${name}`;
  let initial = fallback;
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null && /^\d{1,3}$/.test(saved) && Number(saved) <= 100) initial = Number(saved);
  } catch { /* Use the default when local storage is unavailable. */ }
  const value = ref(initial);
  watch(value, volume => {
    try { localStorage.setItem(key, String(volume)); }
    catch { /* The volume still applies for the current app session. */ }
  }, { flush: 'sync' });
  return value;
}

export const musicVolume = volumePreference('music', 35);
export const effectsVolume = volumePreference('effects', 65);

export function createGameAudio() {
  const music = new Audio(orbitalLoop);
  music.loop = true;
  const effects = {
    countdownGo: new Audio(countdownGo),
    countdownTick: new Audio(countdownTick),
    enemyHit: new Audio(enemyHit),
    inputConfirm: new Audio(inputConfirm),
    laserFire: new Audio(laserFire),
    shieldDamage: new Audio(shieldDamage),
  };
  const effectTracks = Object.values(effects);
  const playingMusic = ref(false);

  function play(track: HTMLAudioElement) {
    void track.play().catch(() => { /* Audio device or playback policy cannot block a game. */ });
  }

  watch([playingMusic, musicVolume], ([playing, volume]) => {
    music.volume = volume / 100;
    if (playing && volume > 0) play(music);
    else music.pause();
  }, { flush: 'sync' });

  watch(effectsVolume, volume => {
    for (const track of effectTracks) track.volume = volume / 100;
  }, { immediate: true, flush: 'sync' });

  return {
    playEffect(effect: keyof typeof effects) {
      if (effectsVolume.value === 0) return;
      const track = effects[effect];
      track.currentTime = 0;
      play(track);
    },
    startMusic() { playingMusic.value = true; },
    stop(reset = false) {
      playingMusic.value = false;
      if (reset) music.currentTime = 0;
      for (const track of effectTracks) track.pause();
    },
  };
}
