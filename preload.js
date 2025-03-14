const { contextBridge, ipcRenderer } = require('electron')

console.log('Preload script is running...')

try {
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
    hideTrayWindow: () => ipcRenderer.send('hide-tray-window')
  })
  console.log('electronAPI exposed successfully')
} catch (error) {
  console.error('Failed to expose electronAPI:', error)
}
