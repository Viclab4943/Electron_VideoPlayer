const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

let launcherWindow;
let playerWindow;
let serverProcess;

const VIDEOS_DIR = path.join(app.getPath('documents'), 'VideoPlayer', 'videos');
const CACHE_DIR = path.join(app.getPath('documents'), 'VideoPlayer', 'cache');
const CONFIG_FILE = path.join(app.getPath('userData'), 'video-config.json');

// Ensure videos and cache directories exist
if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function createLauncher() {
    // Show a one-time welcome dialog if videos folder was just created
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

    // Uncomment below to debug player issues - opens DevTools in a separate window
    // playerWindow.webContents.openDevTools({ mode: 'detach' });

    playerWindow.on('closed', () => {
        playerWindow = null;
        if (serverProcess) {
            serverProcess.kill();
            serverProcess = null;
        }
        if (!launcherWindow) {
            createLauncher();
        }
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

    const serverPath = getServerPath();
    console.log('Server path:', serverPath);

    // ELECTRON_RUN_AS_NODE=1 makes the Electron binary behave as plain Node.js
    // This avoids needing a separate node install in the packaged app
    serverProcess = spawn(process.execPath, [serverPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            CONFIG_FILE,
            VIDEOS_DIR,
            CACHE_DIR
        }
    });

    serverProcess.stdout.on('data', (data) => {
        console.log('[server]', data.toString().trim());
    });

    serverProcess.stderr.on('data', (data) => {
        console.error('[server error]', data.toString().trim());
    });

    serverProcess.on('error', (err) => {
        console.error('Failed to start server process:', err);
    });

    serverProcess.on('close', (code) => {
        console.log(`Server exited with code ${code}`);
    });
}

// Poll http://localhost:5555/health until server is ready, then open player
function waitForServer(callback, attempts = 0) {
    const MAX_ATTEMPTS = 30; // 15 seconds max
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
ipcMain.handle('get-videos-dir', () => {
    return VIDEOS_DIR;
});

ipcMain.handle('scan-videos', () => {
    const extensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv', '.flv'];
    const videos = [];

    if (!fs.existsSync(VIDEOS_DIR)) {
        return videos;
    }

    const files = fs.readdirSync(VIDEOS_DIR);
    
    files.forEach(file => {
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
        filters: [
            { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv', 'flv'] }
        ]
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
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
    } catch (err) {
        console.error('Error deleting video:', err);
    }
    return false;
});

ipcMain.handle('start-player', (event, config) => {
    console.log('Starting player...');
    
    if (launcherWindow) {
        launcherWindow.hide();
    }
    
    startServer(config);
    
    // Wait until server actually responds instead of a fixed timeout
    waitForServer(() => {
        createPlayer();
    });
});

ipcMain.handle('open-videos-folder', () => {
    const { shell } = require('electron');
    shell.openPath(VIDEOS_DIR);
});

app.whenReady().then(() => {
    createLauncher();
});

app.on('window-all-closed', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
    app.quit();
});

app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});
