<template>
  <Header></Header>
  <div class="main-container practice-menu">
    <div class="menu">
      <template v-for="(lesson, key) in lessons" :key="lesson">
        <router-link :to="`/practice/${key}`" class="menu-item">
          {{ lesson }}
        </router-link>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCommonStore } from '@/stores/common'
import Header from '@/components/Header.vue';

const commonStore = useCommonStore()

const lessons = computed(() => commonStore.lessons)
</script>

<style scoped>
.practice-menu {
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1;
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 300px;
  padding: 2rem;
}

.menu-item {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 3.5rem;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  text-decoration: none;
  color: #333;
  font-size: 1.1rem;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.menu-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  border-color: #d0d0d0;
}

.menu-item:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
</style>
