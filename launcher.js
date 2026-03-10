const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const os = require('os');
const WebSocket = require('ws');
const { autoUpdater } = require('electron-updater');

let launcherWindow;
let playerWindow;
let serverProcess;

const VIDEOS_DIR = path.join(app.getPath('documents'), 'VideoPlayer', 'videos');
const CACHE_DIR = path.join(app.getPath('documents'), 'VideoPlayer', 'cache');
const CONFIG_FILE = path.join(app.getPath('userData'), 'video-config.json');

// Flic Hub config — update these to match your setup
const FLIC_HUB_IP = '192.168.68.193';
const FLIC_HUB_WS = `ws://${FLIC_HUB_IP}:9999/`;
const FLIC_SDK_USERNAME = 'YOUR_USERNAME';
const FLIC_SDK_PASSWORD = 'YOUR_PASSWORD';
const FLIC_SCRIPT_NAME = 'flic-hub.js';

// Ensure directories exist
if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// Get local IP on same subnet as Flic Hub
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    const hubSubnet = FLIC_HUB_IP.split('.').slice(0, 3).join('.');
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                if (iface.address.startsWith(hubSubnet)) return iface.address;
            }
        }
    }
    // Fallback: any non-internal IPv4
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return null;
}

// Silently sync IP to Flic Hub — runs in background, never blocks the app
function syncFlicHubIP() {
    const localIP = getLocalIP();
    if (!localIP) {
        console.log('[flic-sync] No local IP found, skipping sync.');
        return;
    }

    console.log(`[flic-sync] Local IP: ${localIP} — connecting to hub...`);

    let ws;
    try {
        ws = new WebSocket(FLIC_HUB_WS);
    } catch (e) {
        console.log('[flic-sync] Could not connect to Flic Hub:', e.message);
        return;
    }

    let step = 'connect';

    const timeout = setTimeout(() => {
        console.log('[flic-sync] Timed out — hub may be unreachable.');
        try { ws.close(); } catch (e) {}
    }, 15000);

    ws.on('open', () => {
        console.log('[flic-sync] Connected to hub.');
    });

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch (e) { return; }

        if (step === 'connect') {
            step = 'login';
            ws.send(JSON.stringify({
                type: 'login',
                username: FLIC_SDK_USERNAME,
                password: FLIC_SDK_PASSWORD
            }));
            return;
        }

        if (step === 'login') {
            if (msg.type === 'loginResponse' && msg.success) {
                console.log('[flic-sync] Logged in. Fetching script...');
                step = 'getFile';
                ws.send(JSON.stringify({ type: 'getFile', name: FLIC_SCRIPT_NAME }));
            } else {
                console.log('[flic-sync] Login failed — check credentials in launcher.js');
                clearTimeout(timeout);
                ws.close();
            }
            return;
        }

        if (step === 'getFile') {
            if (msg.type === 'getFileResponse' && msg.success) {
                const oldContent = msg.content;
                const newContent = oldContent.replace(
                    /const SERVER_IP\s*=\s*["'][^"']+["']/,
                    `const SERVER_IP = "${localIP}"`
                );

                if (newContent === oldContent) {
                    console.log('[flic-sync] IP already up to date.');
                    clearTimeout(timeout);
                    ws.close();
                    return;
                }

                console.log(`[flic-sync] Updating SERVER_IP to ${localIP}...`);
                step = 'setFile';
                ws.send(JSON.stringify({
                    type: 'setFile',
                    name: FLIC_SCRIPT_NAME,
                    content: newContent
                }));
            } else {
                console.log('[flic-sync] Failed to get script from hub.');
                clearTimeout(timeout);
                ws.close();
            }
            return;
        }

        if (step === 'setFile') {
            if (msg.type === 'setFileResponse' && msg.success) {
                console.log('[flic-sync] Script updated. Restarting hub script...');
                step = 'restart';
                ws.send(JSON.stringify({ type: 'restartScript' }));
            } else {
                console.log('[flic-sync] Failed to save script.');
                clearTimeout(timeout);
                ws.close();
            }
            return;
        }

        if (step === 'restart') {
            console.log(`[flic-sync] Done. Flic Hub now points to ${localIP}:5555`);
            clearTimeout(timeout);
            ws.close();
        }
    });

    ws.on('error', (err) => {
        console.log('[flic-sync] Connection error:', err.message);
        clearTimeout(timeout);
    });

    ws.on('close', () => {
        console.log('[flic-sync] Disconnected from hub.');
    });
}

function setupAutoUpdater() {
    // Only run auto-update on packaged Windows builds
    if (!app.isPackaged || process.platform !== 'win32') return;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
        console.log(`[updater] Update available: v${info.version}`);
        dialog.showMessageBox({
            type: 'info',
            title: 'Update Available',
            message: `Version ${info.version} is available`,
            detail: 'Downloading update in the background. You will be notified when it is ready to install.',
            buttons: ['OK']
        });
    });

    autoUpdater.on('update-downloaded', () => {
        console.log('[updater] Update downloaded, ready to install.');
        dialog.showMessageBox({
            type: 'info',
            title: 'Update Ready',
            message: 'Update downloaded',
            detail: 'The update will be installed when you quit the app. Restart now to apply it?',
            buttons: ['Restart Now', 'Later']
        }).then(result => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });

    autoUpdater.on('error', (err) => {
        console.error('[updater] Error:', err.message);
    });

    // Check for updates silently on launch
    autoUpdater.checkForUpdatesAndNotify();
}

function createLauncher() {
    const isFirstLaunch = !fs.existsSync(path.join(VIDEOS_DIR, '.initialized'));
    if (isFirstLaunch) {
        fs.writeFileSync(path.join(VIDEOS_DIR, '.initialized'), '');
        dialog.showMessageBox({
            type: 'info',
            title: 'Welcome to Video Player',
            message: 'Videos folder created',
            detail: `Place your videos in:\n\n${VIDEOS_DIR}\n\nName them:\n  default.mp4 → loops when idle\n  video1.mp4 → Button 1\n  video2.mp4 → Button 2\n  etc.`,
            buttons: ['Open Folder', 'OK']
        }).then(result => {
            if (result.response === 0) {
                const { shell } = require('electron');
                shell.openPath(VIDEOS_DIR);
            }
        });
    }

    launcherWindow = new BrowserWindow({
        width: 800,
        height: 600,
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    launcherWindow.loadFile('launcher.html');
    launcherWindow.setMenu(null);

    launcherWindow.on('closed', () => {
        launcherWindow = null;
    });
}

function createPlayer() {
    playerWindow = new BrowserWindow({
        fullscreen: true,
        kiosk: true,
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        backgroundColor: '#000000'
    });

    playerWindow.loadURL('http://localhost:5555');
    playerWindow.setMenu(null);

    playerWindow.on('closed', () => {
        playerWindow = null;
        if (serverProcess) {
            serverProcess.kill();
            serverProcess = null;
        }
        if (!launcherWindow) createLauncher();
    });
}

function getServerPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'app.asar', 'server.js');
    }
    return path.join(__dirname, 'server.js');
}

function startServer(config) {
    console.log('Starting server...');
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

    serverProcess = spawn(process.execPath, [getServerPath()], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            CONFIG_FILE,
            VIDEOS_DIR,
            CACHE_DIR
        }
    });

    serverProcess.stdout.on('data', (d) => console.log('[server]', d.toString().trim()));
    serverProcess.stderr.on('data', (d) => console.error('[server error]', d.toString().trim()));
    serverProcess.on('error', (err) => console.error('Failed to start server:', err));
    serverProcess.on('close', (code) => console.log(`Server exited with code ${code}`));
}

function waitForServer(callback, attempts = 0) {
    const MAX_ATTEMPTS = 30;
    if (attempts >= MAX_ATTEMPTS) {
        console.error('Server did not start in time');
        dialog.showErrorBox('Server Error', 'The video server failed to start. Please try again.');
        if (launcherWindow) launcherWindow.show();
        return;
    }
    http.get('http://localhost:5555/health', (res) => {
        if (res.statusCode === 200) {
            console.log('Server is ready!');
            callback();
        } else {
            setTimeout(() => waitForServer(callback, attempts + 1), 500);
        }
    }).on('error', () => {
        setTimeout(() => waitForServer(callback, attempts + 1), 500);
    });
}

// IPC Handlers
ipcMain.handle('get-videos-dir', () => VIDEOS_DIR);

ipcMain.handle('scan-videos', () => {
    const extensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv', '.flv'];
    const videos = [];
    if (!fs.existsSync(VIDEOS_DIR)) return videos;
    fs.readdirSync(VIDEOS_DIR).forEach(file => {
        const ext = path.extname(file).toLowerCase();
        if (extensions.includes(ext)) {
            const fullPath = path.join(VIDEOS_DIR, file);
            const stats = fs.statSync(fullPath);
            videos.push({
                name: file,
                path: fullPath,
                size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB'
            });
        }
    });
    return videos;
});

ipcMain.handle('select-video-file', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv', 'flv'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        const sourcePath = result.filePaths[0];
        const fileName = path.basename(sourcePath);
        const destPath = path.join(VIDEOS_DIR, fileName);
        fs.copyFileSync(sourcePath, destPath);
        return { name: fileName, path: destPath };
    }
    return null;
});

ipcMain.handle('delete-video', async (event, filePath) => {
    try {
        if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); return true; }
    } catch (err) { console.error('Error deleting video:', err); }
    return false;
});

ipcMain.handle('start-player', (event, config) => {
    if (launcherWindow) launcherWindow.hide();
    startServer(config);
    waitForServer(() => createPlayer());
});

ipcMain.handle('open-videos-folder', () => {
    const { shell } = require('electron');
    shell.openPath(VIDEOS_DIR);
});

app.whenReady().then(() => {
    setupAutoUpdater();
    // Only sync Flic Hub IP on Windows builds
    if (process.platform === "win32") syncFlicHubIP();
    createLauncher();
});

app.on('window-all-closed', () => {
    if (serverProcess) serverProcess.kill();
    app.quit();
});

app.on('before-quit', () => {
    if (serverProcess) serverProcess.kill();
});
