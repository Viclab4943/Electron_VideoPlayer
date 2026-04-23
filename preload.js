const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getVideosDir: () => ipcRenderer.invoke('get-videos-dir'),
    scanVideos: () => ipcRenderer.invoke('scan-videos'),
    selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
    deleteVideo: (filePath) => ipcRenderer.invoke('delete-video', filePath),
    startPlayer: (config) => ipcRenderer.invoke('start-player', config),
    openVideosFolder: () => ipcRenderer.invoke('open-videos-folder'),
    // Flic Hub settings
    getFlicSettings: () => ipcRenderer.invoke('get-flic-settings'),
    saveFlicSettings: (settings) => ipcRenderer.invoke('save-flic-settings', settings),
    testFlicConnection: (ip) => ipcRenderer.invoke('test-flic-connection', ip)
});