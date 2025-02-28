<template>
  <div class="header">
    <div class="btn" @click="handleBack">
      <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M659.748571 245.272381l-51.687619-51.687619-318.439619 318.585905 318.415238 318.268952 51.712-51.736381-266.703238-266.556952z"></path></svg>
    </div>
    <div class="header-center">
      <slot></slot>
    </div>
    <div class="header-right">
      <slot name="right"></slot>
    </div>
    <div class="btn">
      <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M128 213.34016l768 0q17.67424 0 30.16704 12.4928t12.4928 30.16704-12.4928 30.16704-30.16704 12.4928l-768 0q-17.67424 0-30.16704-12.4928t-12.4928-30.16704 12.4928-30.16704 30.16704-12.4928zM128 725.34016l768 0q17.67424 0 30.16704 12.4928t12.4928 30.16704-12.4928 30.16704-30.16704 12.4928l-768 0q-17.67424 0-30.16704-12.4928t-12.4928-30.16704 12.4928-30.16704 30.16704-12.4928zM128 469.34016l768 0q17.67424 0 30.16704 12.4928t12.4928 30.16704-12.4928 30.16704-30.16704 12.4928l-768 0q-17.67424 0-30.16704-12.4928t-12.4928-30.16704 12.4928-30.16704 30.16704-12.4928z"></path></svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()


const handleBack = () => {
  console.log(route.path.split('/'), route.path.split('/').slice(0, -1).join('/'))
  router.push({ path: route.path.split('/').slice(0, -1).join('/') || '/' })
}
</script>
<style lang="scss">
.header {
  padding: 0 8px 0 72px;
  flex: 0 0 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 999;
  -webkit-app-region: drag;

  .select {
    -webkit-app-region: no-drag;
    margin-right: 24px;
    margin-left: 4px;
  }

  .btn {
    flex: 0 0 24px;
    width: 24px;
    height: 24px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(255, 255, 255, 0);
    -webkit-app-region: no-drag;

    &:hover {
      svg {
        fill: rgba(255, 255, 255, 1);
      }
    }

    svg {
      width: 16px;
      height: 16px;
      fill: rgba(255, 255, 255, 0.7);
    }
  }

  .header-center {
    flex: 1 1 auto;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    font-size: 12px;
  }
  .header-right {
    flex: 1 1 auto;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    font-size: 12px;
  }

  .text {
    color: #ffffff;
  }
}
</style>