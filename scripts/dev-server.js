const { createServer } = require('vite')
const electron = require('electron')
const { spawn } = require('child_process')
const path = require('path')

/** @type {import('vite').ViteDevServer} */
let viteServer = null

async function startServer() {
  // 创建 Vite 开发服务器
  viteServer = await createServer({
    configFile: path.join(__dirname, '..', 'vite.config.ts'),
    mode: 'development'
  })

  await viteServer.listen()

  // 启动 Electron
  const electronProcess = spawn(electron, [path.join(__dirname, '..')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: `http://localhost:${viteServer.config.server.port}`
    }
  })

  electronProcess.on('close', () => {
    viteServer?.close()
    process.exit()
  })
}

startServer()
