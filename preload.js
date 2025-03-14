const { contextBridge, ipcRenderer } = require('electron')

console.log('Preload script is running...')

try {
  // 创建日志记录器
  const logger = {
    error: (message, meta = {}) => {
      ipcRenderer.send('log-message', { level: 'error', message, meta })
    },
    warn: (message, meta = {}) => {
      ipcRenderer.send('log-message', { level: 'warn', message, meta })
    },
    info: (message, meta = {}) => {
      ipcRenderer.send('log-message', { level: 'info', message, meta })
    },
    debug: (message, meta = {}) => {
      ipcRenderer.send('log-message', { level: 'debug', message, meta })
    }
  }

  contextBridge.exposeInMainWorld('electronAPI', {
    // 文件读取 API
    readData: (lesson) => ipcRenderer.invoke('read-data', lesson),
    // 导入词汇 API
    importWords: (words) => ipcRenderer.invoke('import-words', words),
    // 导出生词本 API
    exportWords: () => ipcRenderer.invoke('export-words'),
    // 窗口控制 API
    openMainWindow: () => ipcRenderer.invoke('open-main-window'),
    quitApp: () => ipcRenderer.invoke('quit-app'),
    closeWindow: () => ipcRenderer.send('window-close'),
    hideTrayWindow: () => ipcRenderer.send('hide-tray-window'),
    // 添加日志 API
    logger: logger
  })
  console.log('electronAPI exposed successfully')
} catch (error) {
  console.error('Failed to expose electronAPI:', error)
}
