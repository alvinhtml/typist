<template>
  <Header></Header>
  <div class="game-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

import Header from '@/components/Header.vue';
</script>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  padding: 2rem;
}
</style>
