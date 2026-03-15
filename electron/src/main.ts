// ============================================================================
// Naotu Electron — 主进程入口
// ============================================================================
// 职责：
//   1. 创建 BrowserWindow（加载本地 Next.js 前端）
//   2. 注册 IPC handlers（钱包 / 签名 / 通知）
//   3. 启动后端 Hono 服务（内嵌同进程或子进程）
//   4. 处理桌面端 OAuth 流程
//   5. 管理应用生命周期
// ============================================================================

import {
    app,
    BrowserWindow,
    ipcMain,
    Menu,
    shell,
    session,
    dialog,
} from 'electron';
import * as path from 'node:path';
import { registerIpcHandlers } from './ipc/handlers.js';
import { IPC_CHANNELS } from './ipc/channels.js';
import { startDesktopOAuth, injectSessionCookie } from './auth/oauth-desktop.js';
import { showNotification } from './services/notification.js';

// ─── 路径工具 ──────────────────────────────────────────────────────
// CommonJS 模式下 __dirname 为内置全局变量，无需手动定义

const isDev = !app.isPackaged;

// ─── 配置 ──────────────────────────────────────────────────────────

const FRONTEND_PORT  = Number(process.env.FRONTEND_PORT)  || 3000;
const BACKEND_PORT   = Number(process.env.BACKEND_PORT)    || 3001;
const FRONTEND_URL   = `http://localhost:${FRONTEND_PORT}`;
const BACKEND_URL    = `http://localhost:${BACKEND_PORT}`;

// ─── 后端子进程 ──────────────────────────────────────────────────

let backendProcess: import('node:child_process').ChildProcess | null = null;
let frontendProcess: import('node:child_process').ChildProcess | null = null;

async function startBackend(): Promise<void> {
    const { fork } = await import('node:child_process');

    if (isDev) {
        // 开发态：使用 ELECTRON_RUN_AS_NODE + --import tsx 运行后端 TS 源码
        // fork 自动建立 IPC 通道（用于 reminder:notify 推送），
        // ELECTRON_RUN_AS_NODE=1 让 Electron 二进制以 Node.js 模式运行子进程。
        const backendDir = path.resolve(__dirname, '..', '..', 'backend');
        backendProcess = fork(
            'src/index.ts',
            [],
            {
                cwd: backendDir,
                execArgv: ['--import', 'tsx'],
                env: {
                    ...process.env,
                    ELECTRON_RUN_AS_NODE: '1',
                    NODE_ENV: 'development',
                    BACKEND_PORT: String(BACKEND_PORT),
                    FRONTEND_URL,
                },
                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
            }
        );
    } else {
        // 生产态：后端已打包到 extraResources 目录
        const resourcesPath = process.resourcesPath;
        const backendEntry  = path.join(resourcesPath, 'backend', 'dist', 'index.js');
        backendProcess = fork(backendEntry, [], {
            cwd: path.join(resourcesPath, 'backend'),
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: '1',
                NODE_ENV: 'production',
                BACKEND_PORT: String(BACKEND_PORT),
                FRONTEND_URL,
            },
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        });
    }

    // 日志管道
    backendProcess.stdout?.on('data', (data: Buffer) => {
        console.log(`[Backend] ${data.toString().trim()}`);
    });
    backendProcess.stderr?.on('data', (data: Buffer) => {
        console.error(`[Backend:err] ${data.toString().trim()}`);
    });
    backendProcess.on('exit', (code) => {
        console.log(`[Backend] Exited with code ${code}`);
    });

    // 监听后端子进程的 IPC 消息（提醒推送等）
    backendProcess.on('message', (msg: { type?: string; payload?: { title?: string; body?: string; route?: string } }) => {
        if (msg?.type === 'reminder:notify' && msg.payload) {
            showNotification({
                title: msg.payload.title ?? '待办提醒',
                body:  msg.payload.body ?? '',
                route: msg.payload.route,
            });
        }
    });
}

async function startFrontend(): Promise<void> {
    if (isDev) {
        const { spawn } = await import('node:child_process');
        const frontendDir = path.resolve(__dirname, '..', '..', 'frontend');

        frontendProcess = spawn('pnpm', ['exec', 'next', 'dev', '--turbopack', '--port', String(FRONTEND_PORT)], {
            cwd: frontendDir,
            env: {
                ...process.env,
                BACKEND_INTERNAL_URL: BACKEND_URL,
            },
            stdio: 'pipe',
            shell: true,
        });

        frontendProcess.stdout?.on('data', (data: Buffer) => {
            console.log(`[Frontend] ${data.toString().trim()}`);
        });
        frontendProcess.stderr?.on('data', (data: Buffer) => {
            // Next.js 把部分正常日志输出到 stderr
            console.log(`[Frontend] ${data.toString().trim()}`);
        });
        frontendProcess.on('exit', (code) => {
            console.log(`[Frontend] Exited with code ${code}`);
        });
    } else {
        // 生产态：使用 Next.js standalone server
        const { fork } = await import('node:child_process');
        const resourcesPath = process.resourcesPath;
        const standaloneEntry = path.join(resourcesPath, 'frontend', '.next', 'standalone', 'server.js');

        frontendProcess = fork(standaloneEntry, [], {
            cwd: path.join(resourcesPath, 'frontend', '.next', 'standalone'),
            env: {
                ...process.env,
                PORT: String(FRONTEND_PORT),
                HOSTNAME: 'localhost',
                BACKEND_INTERNAL_URL: BACKEND_URL,
            },
            stdio: 'pipe',
        });

        frontendProcess.stdout?.on('data', (data: Buffer) => {
            console.log(`[Frontend] ${data.toString().trim()}`);
        });
        frontendProcess.stderr?.on('data', (data: Buffer) => {
            console.log(`[Frontend] ${data.toString().trim()}`);
        });
        frontendProcess.on('exit', (code) => {
            console.log(`[Frontend] Exited with code ${code}`);
        });
    }
}

// ─── 等待服务就绪 ──────────────────────────────────────────────

async function waitForServer(urlToCheck: string, timeoutMs = 30_000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const response = await fetch(urlToCheck);
            if (response.ok || response.status === 404 || response.status === 302) {
                return; // 服务已启动
            }
        } catch {
            // 连接失败，继续等待
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    console.warn(`[Main] Timeout waiting for ${urlToCheck}`);
}

// ─── 主窗口 ──────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
    mainWindow = new BrowserWindow({
        width:  1440,
        height: 900,
        minWidth:  960,
        minHeight: 640,
        title: 'Naotu 脑图',
        // ── 安全配置（关键） ──
        webPreferences: {
            preload:            path.join(__dirname, 'preload.js'),
            contextIsolation:   true,      // 必须开启：隔离 preload 与页面 JS
            nodeIntegration:    false,      // 必须关闭：renderer 不可直接用 Node
            sandbox:            true,       // 启用沙箱
            webSecurity:        true,
            allowRunningInsecureContent: false,
        },
        show: false,                        // 等 ready-to-show 再显示，避免白屏
        backgroundColor: '#0a0a0a',
    });

    // 加载前端
    mainWindow.loadURL(FRONTEND_URL);

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    // 外部链接用系统浏览器打开
    mainWindow.webContents.setWindowOpenHandler(({ url: linkUrl }) => {
        if (linkUrl.startsWith('http')) {
            shell.openExternal(linkUrl);
        }
        return { action: 'deny' };
    });

    // DevTools（仅开发态）
    if (isDev) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    return mainWindow;
}

// ─── OAuth IPC（renderer 触发 Google 登录） ──────────────────────

function registerOAuthHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.AUTH_GOOGLE_LOGIN, async () => {
        const result = await startDesktopOAuth({
            backendUrl:  BACKEND_URL,
            frontendUrl: FRONTEND_URL,
        });

        if (result.success && result.sessionToken && mainWindow) {
            await injectSessionCookie(mainWindow, BACKEND_URL, result.sessionToken);
            await injectSessionCookie(mainWindow, FRONTEND_URL, result.sessionToken);
            // 通知 renderer 刷新 session 状态
            mainWindow.webContents.send(IPC_CHANNELS.AUTH_LOGIN_SUCCESS);
            return { success: true };
        }

        return { success: false, error: result.error };
    });
}

// ─── 应用菜单 ──────────────────────────────────────────────────

function buildAppMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: '文件',
            submenu: [
                { label: '新建脑图', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu:newMap') },
                { type: 'separator' },
                { role: 'quit', label: '退出' },
            ],
        },
        {
            label: '编辑',
            submenu: [
                { role: 'undo', label: '撤销' },
                { role: 'redo', label: '重做' },
                { type: 'separator' },
                { role: 'cut', label: '剪切' },
                { role: 'copy', label: '复制' },
                { role: 'paste', label: '粘贴' },
                { role: 'selectAll', label: '全选' },
            ],
        },
        {
            label: '视图',
            submenu: [
                { role: 'reload', label: '刷新' },
                { role: 'forceReload', label: '强制刷新' },
                { role: 'toggleDevTools', label: '开发者工具' },
                { type: 'separator' },
                { role: 'zoomIn', label: '放大' },
                { role: 'zoomOut', label: '缩小' },
                { role: 'resetZoom', label: '重置缩放' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: '全屏' },
            ],
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '测试系统通知',
                    click: () => {
                        showNotification({
                            title: 'Naotu 通知测试',
                            body: `当前时间：${new Date().toLocaleString()}`,
                            route: '/dashboard',
                        });
                    },
                },
                { type: 'separator' },
                {
                    label: '关于 Naotu',
                    click: () => {
                        dialog.showMessageBox({
                            type: 'info',
                            title: '关于 Naotu',
                            message: `Naotu 脑图 v${app.getVersion()}`,
                            detail: '个人知识思维导图管理系统\n桌面版',
                        });
                    },
                },
            ],
        },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── 应用生命周期 ──────────────────────────────────────────────

app.whenReady().then(async () => {
    console.log('[Main] App ready, starting services...');

    // 1. 启动后端和前端 dev servers（开发态）
    if (isDev) {
        console.log('[Main] Dev mode: starting backend & frontend...');
        await startBackend();
        await startFrontend();

        // 等待后端和前端就绪
        console.log('[Main] Waiting for backend...');
        await waitForServer(`${BACKEND_URL}/health`);
        console.log('[Main] Backend ready');

        console.log('[Main] Waiting for frontend...');
        await waitForServer(FRONTEND_URL, 60_000);
        console.log('[Main] Frontend ready');
    }

    // 2. 注册 IPC handlers
    registerIpcHandlers();
    registerOAuthHandlers();

    // 3. 应用菜单
    buildAppMenu();

    // 4. CSP 头注入（安全加固）
    // 仅对本地前后端页面注入，避免破坏第三方 OAuth 页面（如 Google）
    const frontendOrigin = new URL(FRONTEND_URL).origin;
    const backendOrigin  = new URL(BACKEND_URL).origin;
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const requestOrigin = (() => {
            try {
                return new URL(details.url).origin;
            } catch {
                return '';
            }
        })();

        if (requestOrigin !== frontendOrigin && requestOrigin !== backendOrigin) {
            callback({ responseHeaders: details.responseHeaders });
            return;
        }

        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    [
                        "default-src 'self'",
                        `connect-src 'self' ${FRONTEND_URL} ${BACKEND_URL} https://accounts.google.com https://lh3.googleusercontent.com`,
                        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   // Next.js HMR 需要（生产应收紧）
                        "style-src 'self' 'unsafe-inline'",
                        "img-src 'self' data: https://lh3.googleusercontent.com",
                        "font-src 'self'",
                    ].join('; '),
                ],
            },
        });
    });

    // 5. 创建主窗口
    createMainWindow();
});

// macOS：点击 dock 图标重新激活
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

// 所有窗口关闭 → 退出（Windows/Linux 行为）
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 退出前清理子进程
app.on('before-quit', () => {
    if (backendProcess && !backendProcess.killed) {
        backendProcess.kill();
    }
    if (frontendProcess && !frontendProcess.killed) {
        frontendProcess.kill();
    }
});

// ── 安全：主窗口只允许加载前端，OAuth popup 允许 Google 域名 ──
const ALLOWED_ORIGINS = new Set([
    new URL(FRONTEND_URL).origin,
    new URL(BACKEND_URL).origin,
    'https://accounts.google.com',
    'https://oauth2.googleapis.com',
]);

app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        // 主窗口只允许加载本地前端
        if (contents === mainWindow?.webContents) {
            if (parsedUrl.origin !== new URL(FRONTEND_URL).origin) {
                event.preventDefault();
            }
            return;
        }
        // OAuth popup 允许 Google 及本地域名，其他一律拦截
        if (!ALLOWED_ORIGINS.has(parsedUrl.origin) &&
            !parsedUrl.origin.endsWith('.google.com') &&
            !parsedUrl.origin.endsWith('.googleapis.com')) {
            event.preventDefault();
        }
    });
});
