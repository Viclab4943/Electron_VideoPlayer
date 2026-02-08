const { app, BrowserWindow, globalShortcut } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let serverProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        fullscreen: true,
        kiosk: true,
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        backgroundColor: '#000000'
    });

    mainWindow.loadURL('http://localhost:5555');
    mainWindow.setMenu(null);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('http://localhost:5555')) {
            event.preventDefault();
        }
    });

    // Register keyboard shortcuts
    // ESC to exit fullscreen/kiosk
    globalShortcut.register('Escape', () => {
        if (mainWindow) {
            mainWindow.setKiosk(false);
            mainWindow.setFullScreen(false);
        }
    });

    // Command+Q or Ctrl+Q to quit
    globalShortcut.register('CommandOrControl+Q', () => {
        app.quit();
    });

    // Command+W or Ctrl+W to close window (exits app)
    globalShortcut.register('CommandOrControl+W', () => {
        app.quit();
    });
}

function startServer() {
    console.log('Starting server...');
    
    serverProcess = spawn('node', [path.join(__dirname, 'server.js')], {
        stdio: 'inherit'
    });

    serverProcess.on('error', (err) => {
        console.error('Failed to start server:', err);
    });

    serverProcess.on('close', (code) => {
        console.log(`Server process exited with code ${code}`);
    });
}

app.whenReady().then(() => {
    startServer();
    setTimeout(() => {
        createWindow();
    }, 3000);
});

app.on('window-all-closed', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
    // Unregister all shortcuts
    globalShortcut.unregisterAll();
    app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
    globalShortcut.unregisterAll();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});