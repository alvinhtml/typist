const { app, BrowserWindow, ipcMain, dialog, Tray, nativeImage, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const csv = require('csv-parser')

let mainWindow = null
let tray = null
let trayWindow = null

// 读取 CSV 文件
async function readData(lesson) {
  const fileName = `${lesson}.csv`
  
  if (!fileName) {
    throw new Error(`Invalid lesson: ${lesson}`)
  }

  try {
    return new Promise((resolve, reject) => {
      const results = []
      fs.createReadStream(path.join(__dirname, 'data', fileName))
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error))
    })
  } catch (error) {
    console.error('Error reading lesson data:', error)
    throw error
  }
}

// 导入到生词本
async function importWords(words) {
  try {
    return new Promise((resolve, reject) => {
      const filePath = path.join(__dirname, 'data', 'words.csv')
      
      // 将单词转换为CSV行
      const csvLines = words.map(word => `${word.word},${word.code}`).join('\n')
      
      // 追加到文件末尾
      fs.appendFile(filePath, '\n' + csvLines, (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    })
  } catch (error) {
    console.error('Error importing words:', error)
    throw error
  }
}

async function exportWords() {
  try {
    // 默认下载路径
    const defaultPath = `${process.env.HOME}/Downloads/words.csv`;
    
    // 用 Electron 的对话框让用户选择一个目录
    const { filePath } = await dialog.showSaveDialog({
      title: '导出生词本',
      defaultPath,
      filters: [
        { name: 'CSV Files', extensions: ['csv'] }
      ]
    });
  
    // 如果用户取消对话框，filePath 将为 undefined
    if (!filePath) {
      return
    }
  
    // 准备 CSV 内容
    const csvContent = fs.readFileSync(path.join(__dirname, 'data', 'words.csv'), 'utf8')

    // 写入文件
    fs.writeFileSync(filePath, csvContent)

  } catch (error) {
    console.error('Export error:', error)
    throw error
  }
}


// 添加 IPC 处理器来读取 CSV 文件
ipcMain.handle('read-data', async (event, lesson) => {
  return readData(lesson)
})

// 处理导入词汇
ipcMain.handle('import-words', async (event, words) => {
  return importWords(words)
})

// 处理导出词汇
ipcMain.handle('export-words', async (event) => {
  return exportWords() 
})


// 创建托盘窗口
function createTrayWindow() {
  trayWindow = new BrowserWindow({
    width: 320,
    height: 260,
    show: false,
    frame: false,
    backgroundColor: '#00000000',
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    type: 'panel',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // 在开发模式下使用本地服务器
  if (process.env.VITE_DEV_SERVER_URL) {
    trayWindow.loadURL(process.env.VITE_DEV_SERVER_URL + '/tray.html')
    // 开发模式下打开开发者工具
    // trayWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    trayWindow.loadFile(path.join(__dirname, 'dist', 'tray.html'))
  }

  // 添加调试事件监听
  trayWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Tray window failed to load:', errorCode, errorDescription)
  })

  trayWindow.webContents.on('did-finish-load', () => {
    console.log('Tray window loaded successfully')
    // 开发模式下打开开发者工具
    if (process.env.VITE_DEV_SERVER_URL) {
      trayWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // 当点击窗口外部时隐藏窗口
  trayWindow.on('blur', () => {
    if (trayWindow && !trayWindow.isDestroyed()) {
      trayWindow.hide()
    }
  })
}

// 创建托盘图标
function createTray() {
  // 创建托盘图标
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon-template.png'))
  icon.setTemplateImage(true)
  
  // 创建托盘
  tray = new Tray(icon)
  tray.setToolTip('快速导入生词')
  
  // 创建托盘窗口
  createTrayWindow()

  // 点击托盘图标时显示窗口
  tray.on('click', (event, bounds) => {
    const { x, y } = bounds
    const { height, width } = trayWindow.getBounds()
    
    // 在 macOS 上，托盘图标在顶部，窗口应该显示在下方
    const yPosition = process.platform === 'darwin' ? y + bounds.height : y - height
    
    // 设置窗口位置
    trayWindow.setBounds({
      x: Math.round(x - width / 2),
      y: Math.round(yPosition),
      width,
      height
    })

    // 显示/隐藏窗口
    if (trayWindow.isVisible()) {
      trayWindow.hide()
    } else {
      trayWindow.show()
      trayWindow.focus() // 确保窗口获得焦点
    }
  })
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 680,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    roundedCorners: true,
    vibrancy: 'light'
  })

  // 根据环境加载不同的页面
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'))
  }

  // 主窗口失去焦点时自动最小化
  mainWindow.on('blur', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.minimize()
    }
  })
}

// 当 Electron 完成初始化时创建窗口
app.whenReady().then(() => {
  createWindow()
  // createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 关闭
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 退出时清理托盘图标
app.on('before-quit', () => {
  if (tray) {
    tray.destroy()
  }
})

// 窗口控制
ipcMain.on('window-minimize', () => {
  mainWindow.minimize()
})

// 最大化/恢复窗口
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow.maximize()
  }
})

// 关闭窗口
ipcMain.on('window-close', () => {
  mainWindow.close()
})

// 隐藏托盘窗口
ipcMain.on('hide-tray-window', () => {
  if (trayWindow && !trayWindow.isDestroyed()) {
    trayWindow.hide()
  }
})
