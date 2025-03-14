const { app, BrowserWindow, ipcMain, dialog, Tray, nativeImage, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const csv = require('csv-parser')
const winston = require('winston')
const os = require('os')

let mainWindow = null
let tray = null
let trayWindow = null
let logger = null

// 初始化日志系统
function initLogger() {
  // macOS 标准日志目录: ~/Library/Logs/<应用名称>/
  const logPath = path.join(os.homedir(), 'Library/Logs', app.getName())
  if (!fs.existsSync(logPath)) {
    fs.mkdirSync(logPath, { recursive: true })
  }

  logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        // 添加进程信息到日志
        const processInfo = meta.processType || 'main'
        delete meta.processType
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : ''
        return `${timestamp} [${processInfo}] ${level}: ${message} ${metaStr}`
      })
    ),
    transports: [
      // 文件日志
      new winston.transports.File({
        filename: path.join(logPath, 'typist.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      }),
      // 控制台输出
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ]
  })

  // 记录应用基本信息
  logger.info('Application initialized', {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    electronVersion: process.versions.electron
  })

  // 处理来自渲染进程的日志
  ipcMain.on('log-message', (event, { level, message, meta = {} }) => {
    // 添加发送方窗口信息
    const sender = event.sender
    const window = BrowserWindow.fromWebContents(sender)
    const windowType = window === mainWindow ? 'main-window' : 
                      window === trayWindow ? 'tray-window' : 'unknown-window'

    // 添加进程信息
    meta.processType = `renderer:${windowType}`
    
    // 记录日志
    if (logger[level]) {
      logger[level](message, meta)
    }
  })
}

// 确保用户数据目录存在
function ensureUserDataDirectory() {
  const userDataPath = path.join(app.getPath('userData'), 'data')
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }
  
  // 检查并复制初始数据文件
  const wordsPath = path.join(userDataPath, 'words.csv')
  if (!fs.existsSync(wordsPath)) {
    // 如果是打包后的应用
    if (app.isPackaged) {
      const sourceWordsPath = path.join(process.resourcesPath, 'data', 'words.csv')
      if (fs.existsSync(sourceWordsPath)) {
        fs.copyFileSync(sourceWordsPath, wordsPath)
      } else {
        // 创建空的words.csv文件
        fs.writeFileSync(wordsPath, 'word,code\n')
      }
    } else {
      // 开发环境
      const sourceWordsPath = path.join(__dirname, 'data', 'words.csv')
      if (fs.existsSync(sourceWordsPath)) {
        fs.copyFileSync(sourceWordsPath, wordsPath)
      } else {
        // 创建空的words.csv文件
        fs.writeFileSync(wordsPath, 'word,code\n')
      }
    }
  }
}

// 获取数据文件路径
function getDataPath(fileName) {
  // 如果是课程数据，从资源目录读取
  if (fileName !== 'words.csv') {
    const filePath = app.isPackaged
      ? path.join(process.resourcesPath, 'data', fileName)
      : path.join(__dirname, 'data', fileName)
    logger.debug(`Getting data path for ${fileName}: ${filePath}`)
    return filePath
  }
  // 如果是生词本，从用户数据目录读取
  const userDataPath = path.join(app.getPath('userData'), 'data', fileName)
  logger.debug(`Getting user data path for ${fileName}: ${userDataPath}`)
  return userDataPath
}

// 读取 CSV 文件
async function readData(lesson) {
  const fileName = `${lesson}.csv`
  
  if (!fileName) {
    logger.error(`Invalid lesson: ${lesson}`)
    throw new Error(`Invalid lesson: ${lesson}`)
  }

  try {
    return new Promise((resolve, reject) => {
      const results = []
      fs.createReadStream(getDataPath(fileName))
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          logger.info(`Successfully read data from ${fileName}`)
          resolve(results)
        })
        .on('error', (error) => {
          logger.error(`Error reading ${fileName}:`, error)
          reject(error)
        })
    })
  } catch (error) {
    logger.error('Error reading lesson data:', error)
    throw error
  }
}

// 导入到生词本
async function importWords(words) {
  try {
    return new Promise((resolve, reject) => {
      const filePath = getDataPath('words.csv')
      logger.info(`Importing ${words.length} words to ${filePath}`)
      
      // 将单词转换为CSV行
      const csvLines = words.map(word => `${word.word},${word.code}`).join('\n')
      
      // 追加到文件末尾
      fs.appendFile(filePath, '\n' + csvLines, (err) => {
        if (err) {
          logger.error('Error importing words:', err)
          reject(err)
          return
        }
        logger.info('Successfully imported words')
        resolve()
      })
    })
  } catch (error) {
    logger.error('Error importing words:', error)
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
    const csvContent = fs.readFileSync(getDataPath('words.csv'), 'utf8')

    // 写入文件
    fs.writeFileSync(filePath, csvContent)

  } catch (error) {
    logger.error('Export error:', error)
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
    height: 300,
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
    logger.error('Tray window failed to load:', errorCode, errorDescription)
  })

  trayWindow.webContents.on('did-finish-load', () => {
    logger.info('Tray window loaded successfully')
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
  const iconPath = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const icon = nativeImage.createFromPath(path.join(__dirname, iconPath));
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 680,
    icon,
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

  // 处理窗口关闭事件
  mainWindow.on('close', (event) => {
    event.preventDefault()
    mainWindow.hide()
  })
}

// 当 Electron 完成初始化时创建窗口
app.whenReady().then(() => {
  initLogger()
  logger.info('Application starting...')
  ensureUserDataDirectory()
  createTray()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (mainWindow) {
      mainWindow.show()
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
  if (mainWindow) {
    mainWindow.removeAllListeners('close')
    mainWindow = null
  }
  if (tray) {
    tray.destroy()
  }
})

// 打开主窗口
ipcMain.handle('open-main-window', () => {
  if (mainWindow === null) {
    createWindow()
  } else {
    mainWindow.show()
  }
})

// 退出应用
ipcMain.handle('quit-app', () => {
  app.quit()
})

// 窗口控制
ipcMain.on('window-minimize', () => {
  mainWindow.minimize()
})

ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow.maximize()
  }
})

ipcMain.on('window-close', () => {
  if (mainWindow) {
    mainWindow.hide()
  }
})

// 隐藏托盘窗口
ipcMain.on('hide-tray-window', () => {
  if (trayWindow && !trayWindow.isDestroyed()) {
    trayWindow.hide()
  }
})
