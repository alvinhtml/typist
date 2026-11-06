<script setup lang="ts">
import {theme,setTheme,type Theme} from './theme';
</script>
<template>
  <label class="theme-switch" title="界面主题">
    <svg v-if="theme==='system'" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
    <svg v-else-if="theme==='light'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/></svg>
    <span class="theme-chevron" aria-hidden="true">⌄</span>
    <select aria-label="界面主题" :value="theme" @change="setTheme(($event.target as HTMLSelectElement).value as Theme)"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select>
  </label>
</template>
