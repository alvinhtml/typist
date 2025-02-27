import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Tray from './Tray.vue'

const app = createApp(Tray)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
