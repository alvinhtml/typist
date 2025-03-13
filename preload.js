const { contextBridge, ipcRenderer } = require('electron')

console.log('Preload script is running...')

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // 文件读取 API
    readData: async (lesson) => ipcRenderer.invoke('read-data', lesson),
    // 导入词汇 API
    importWords: async (words) => ipcRenderer.invoke('import-words', words),
    // 导出生词本 API
    exportWords: async () => ipcRenderer.invoke('export-words'),
    // 窗口控制 API
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    hideTrayWindow: () => ipcRenderer.send('hide-tray-window'),
  })
  console.log('electronAPI exposed successfully')
} catch (error) {
  console.error('Failed to expose electronAPI:', error)
}
