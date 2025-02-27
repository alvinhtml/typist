const { contextBridge, ipcRenderer } = require('electron')

console.log('Preload script is running...')

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // 文件读取 API
    readData: async (lesson) => {
      console.log('Calling readData with lesson:', lesson)
      try {
        const result = await ipcRenderer.invoke('read-data', lesson)
        console.log('readData result:', result)
        return result
      } catch (error) {
        console.error('Error in readData:', error)
        throw error
      }
    },
    // 导入词汇 API
    importWords: async (words) => { 
      console.log('Calling importWords with words:', words)
      try {
        await ipcRenderer.invoke('import-words', words)
      } catch (error) {
        console.error('Error in importWords:', error)
        throw error
      }
    },
    // 窗口控制 API
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    hideTrayWindow: () => ipcRenderer.send('hide-tray-window')
  })
  console.log('electronAPI exposed successfully')
} catch (error) {
  console.error('Failed to expose electronAPI:', error)
}
