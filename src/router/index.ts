import { createRouter, createWebHashHistory } from 'vue-router'
import Index from '../views/index.vue'

const routes = [
  {
    path: '/',
    name: 'Index',
    component: Index
  },
  {
    path: '/practice',
    name: 'PracticeMenu',
    component: () => import('../views/practice/index.vue')
  },
  {
    path: '/practice/:level',
    name: 'Practice',
    component: () => import('../views/practice/level.vue')
  },
  {
    path: '/game',
    name: 'Game',
    component: () => import('../views/game.vue')
  },
  {
    path: '/words',
    name: 'Words',
    component: () => import('../views/words.vue')
  },
  {
    path: '/import',
    name: 'Import',
    component: () => import('../views/import.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
