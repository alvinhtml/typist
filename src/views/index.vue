<template>
  <Header></Header>
  <div class="main-container index-container">
    <div class="menu">
      <router-link to="/practice" class="menu-item">
        <div class="menu-item-content">
          <i class="fas fa-keyboard"></i>
          <span>五笔打字</span>
        </div>
      </router-link>
      
      <router-link to="/practive" class="menu-item">
        <div class="menu-item-content">
          <i class="fas fa-book"></i>
          <span>生词练习</span>
        </div>
      </router-link>
      
      <router-link to="/game" class="menu-item">
        <div class="menu-item-content">
          <i class="fas fa-gamepad"></i>
          <span>打字游戏</span>
        </div>
      </router-link>
      
      <router-link to="/import" class="menu-item">
        <div class="menu-item-content">
          <i class="fas fa-file-import"></i>
          <span>生词导入</span>
        </div>
      </router-link>
    </div>

    <div class="app-footer">
      <span> 2025 Typist</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import Header from '@/components/Header.vue';
// 组件逻辑
</script>

<style scoped>
.menu-icon {
  font-size: 1.25rem;
  color: #2c3e50;
  cursor: pointer;
  padding: 0.5rem;
}

.menu {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1.25rem;
  padding: 2rem;
  max-width: 400px;
  margin: 0 auto;
  width: 100%;
}

.menu-item {
  width: 100%;
  text-decoration: none;
  transition: transform 0.2s ease;
}

.menu-item:hover {
  transform: translateY(-2px);
}

.menu-item-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  color: #2c3e50;
  font-size: 1.1rem;
  font-weight: 500;
}

.menu-item-content i {
  font-size: 1.25rem;
  width: 24px;
  text-align: center;
  color: #3498db;
}

.menu-item:hover .menu-item-content {
  background-color: #ffffff;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.app-footer {
  text-align: center;
  padding: 1rem;
  color: #ddd;
  font-size: 0.9rem;
}

@media (max-width: 480px) {
  .menu {
    padding: 1rem;
  }
  
  .menu-item-content {
    padding: 0.875rem 1.25rem;
  }
}
</style>

<style>
/* 在 index.html 中添加 Font Awesome CDN */
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css');

/* 添加全局字体 */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
