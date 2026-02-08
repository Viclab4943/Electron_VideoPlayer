const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(express.json());

const VIDEOS_DIR = path.join(__dirname, 'videos');
const CACHE_DIR = path.join(__dirname, 'video_cache');

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

// WebSocket server
const wss = new WebSocket.Server({ port: 8765 });
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('🔌 Client connected. Total:', clients.size);
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log('🔌 Client disconnected. Total:', clients.size);
    });
});

function broadcast(data) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
    console.log('📡 Broadcasted:', data);
}

// Auto-discover all videos in the videos folder
function getAvailableVideos() {
    const extensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv', '.flv'];
    const videoMap = {};
    
    if (!fs.existsSync(VIDEOS_DIR)) return videoMap;
    
    const files = fs.readdirSync(VIDEOS_DIR);
    
    files.forEach(file => {
        const ext = path.extname(file).toLowerCase();
        if (extensions.includes(ext)) {
            const basename = path.basename(file, ext);
            
            // Map filenames to IDs
            if (basename.toLowerCase() === 'default') {
                videoMap['default'] = path.join(VIDEOS_DIR, file);
            } else if (basename.toLowerCase().startsWith('video')) {
                // Extract number from "video1", "video2", etc.
                const match = basename.match(/video(\d+)/i);
                if (match) {
                    const num = match[1];
                    videoMap[num] = path.join(VIDEOS_DIR, file);
                }
            }
        }
    });
    
    return videoMap;
}

function findVideoFile(videoName) {
    const extensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv', '.flv'];
    
    for (const ext of extensions) {
        const filePath = path.join(VIDEOS_DIR, videoName + ext);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }
    
    const files = fs.readdirSync(VIDEOS_DIR);
    for (const file of files) {
        const basename = path.basename(file, path.extname(file));
        if (basename.toLowerCase() === videoName.toLowerCase()) {
            return path.join(VIDEOS_DIR, file);
        }
    }
    
    return null;
}

function convertVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(outputPath)) {
            console.log('✓ Using cached:', path.basename(outputPath));
            resolve(outputPath);
            return;
        }

        console.log('⏳ Converting:', path.basename(inputPath));
        const startTime = Date.now();

        ffmpeg(inputPath)
            .outputOptions([
                '-c:v libx264',
                '-preset ultrafast',
                '-crf 23',
                '-c:a aac',
                '-b:a 128k',
                '-movflags +faststart'
            ])
            .output(outputPath)
            .on('end', () => {
                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`✓ Converted in ${duration}s:`, path.basename(outputPath));
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('✗ Conversion failed:', err.message);
                reject(err);
            })
            .run();
    });
}

async function preconvertVideos() {
    console.log('\n' + '='.repeat(50));
    console.log('🎬 Pre-converting videos...');
    console.log('='.repeat(50));
    
    const availableVideos = getAvailableVideos();
    
    for (const [id, sourcePath] of Object.entries(availableVideos)) {
        const cachePath = path.join(CACHE_DIR, `${id}.mp4`);
        
        try {
            await convertVideo(sourcePath, cachePath);
        } catch (err) {
            console.error(`Failed to convert video ${id}:`, err.message);
        }
    }
    
    console.log('='.repeat(50));
    console.log('✓ All videos ready!');
    console.log('Available videos:', Object.keys(availableVideos).join(', '));
    console.log('='.repeat(50) + '\n');
}

// Serve video files
app.get('/videos/:id', async (req, res) => {
    const videoId = req.params.id;
    
    // Map ID to filename
    let videoName;
    if (videoId === 'default') {
        videoName = 'default';
    } else {
        videoName = `video${videoId}`;
    }

    const cachePath = path.join(CACHE_DIR, `${videoId}.mp4`);
    
    if (fs.existsSync(cachePath)) {
        res.sendFile(cachePath);
    } else {
        const sourcePath = findVideoFile(videoName);
        
        if (!sourcePath) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        try {
            await convertVideo(sourcePath, cachePath);
            res.sendFile(cachePath);
        } catch (err) {
            res.status(500).json({ error: 'Conversion failed' });
        }
    }
});

// Get list of available videos
app.get('/api/videos', (req, res) => {
    const availableVideos = getAvailableVideos();
    const videoIds = Object.keys(availableVideos).filter(id => id !== 'default');
    res.json({ 
        videos: videoIds,
        count: videoIds.length 
    });
});

// API Routes - with click type support
app.post('/changeVideo', (req, res) => {
    const videoId = req.body['video-id'];
    const clickType = req.body['click-type'] || 'click';
    
    console.log(`🎬 Change video: ${videoId}, click type: ${clickType}`);
    
    broadcast({ 
        action: 'changeVideo', 
        videoId: String(videoId),
        clickType: clickType 
    });
    
    res.json({ status: 'success', 'video-id': videoId, 'click-type': clickType });
});

app.post('/close', (req, res) => {
    console.log('🔄 Returning to default');
    broadcast({ action: 'close' });
    res.json({ status: 'success' });
});

app.post('/pause', (req, res) => {
    console.log('⏸️  Pause/Resume');
    broadcast({ action: 'pause' });
    res.json({ status: 'success' });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'running', 
        connected_clients: clients.size 
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'player.html'));
});

const PORT = 5555;
app.listen(PORT, () => {
    console.log(`\n🌐 Server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket server on ws://localhost:8765\n`);
    preconvertVideos();
});