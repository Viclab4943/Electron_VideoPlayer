const { app, BrowserWindow } = require('electron');
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

    // Load the video player
    mainWindow.loadURL('http://localhost:5555');
    
    // Remove menu bar
    mainWindow.setMenu(null);
    
    // Optional: Open DevTools for debugging (remove in production)
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Prevent accidental navigation
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('http://localhost:5555')) {
            event.preventDefault();
        }
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
    // Start the web server
    startServer();
    
    // Wait for server to start, then create window
    setTimeout(() => {
        createWindow();
    }, 3000);
});

app.on('window-all-closed', () => {
    // Kill server process
    if (serverProcess) {
        serverProcess.kill();
    }
    app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Cleanup on quit
app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});