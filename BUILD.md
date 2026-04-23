# Building Video Player

This guide explains how to build the Video Player application for Windows, macOS, and Linux.

## Prerequisites

### All Platforms
- **Node.js 18+** - Download from https://nodejs.org/
- **Git** - Download from https://git-scm.com/

### Windows-Specific
- **Windows 10/11** (64-bit)
- No additional tools required for basic builds

### macOS-Specific
- **Xcode Command Line Tools**: `xcode-select --install`

### Linux-Specific
- **Build essentials**: `sudo apt install build-essential`
- **RPM tools** (for rpm builds): `sudo apt install rpm`
- **Fakeroot**: `sudo apt install fakeroot`

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Viclab4943/Electron_VideoPlayer.git
cd Electron_VideoPlayer

# Install dependencies
npm install

# Build for your current platform
npm run build
```

---

## Building for Windows (.exe)

### Option 1: Build on Windows (Recommended)

```bash
# Install dependencies
npm install

# Build Windows installers
npm run build:win
```

**Output files** (in `dist/` folder):
- `Video Player Setup x.x.x.exe` - NSIS installer (recommended)
- `Video Player x.x.x.exe` - Portable version (no install needed)

### Option 2: Build on macOS/Linux (Cross-compile)

Cross-compiling for Windows requires Wine:

**macOS:**
```bash
brew install --cask wine-stable
npm run build:win
```

**Linux:**
```bash
sudo apt install wine64
npm run build:win
```

### Option 3: Use GitHub Actions (Easiest)

The repository has automated builds. To trigger:

1. Push a tag: `git tag v1.0.5 && git push --tags`
2. Or go to **Actions > Build Video Player > Run workflow**

Download the built `.exe` from the Actions artifacts or Releases page.

---

## Building for macOS (.dmg)

```bash
npm run build:mac
```

**Output files:**
- `Video Player-x.x.x-arm64.dmg` - Apple Silicon
- `Video Player-x.x.x-x64.dmg` - Intel Macs
- `Video Player-x.x.x-arm64-mac.zip` - For auto-updates

**Note:** macOS builds are not code-signed by default. Users may need to right-click > Open on first launch.

---

## Building for Linux (.AppImage, .deb)

```bash
npm run build:linux
```

**Output files:**
- `Video Player-x.x.x.AppImage` - Universal Linux package
- `video-player_x.x.x_amd64.deb` - Debian/Ubuntu package

---

## Build Configuration

Build settings are in `package.json` under the `"build"` key:

```json
{
  "build": {
    "appId": "com.viclab4943.videoplayer",
    "productName": "Video Player",
    "win": {
      "target": ["nsis", "portable"]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

### Common Customizations

**Change app icon:**
Replace `icon.png` (256x256 minimum, PNG format)

**Windows installer options:**
```json
"nsis": {
  "oneClick": true,           // One-click install (no wizard)
  "perMachine": true,         // Install for all users
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true
}
```

---

## Releasing Updates

### Automatic Updates (Windows)

The app uses `electron-updater` for auto-updates on Windows:

1. Bump version in `package.json`
2. Commit changes
3. Create and push a tag:
   ```bash
   git add -A
   git commit -m "Release v1.0.5"
   git tag v1.0.5
   git push && git push --tags
   ```
4. GitHub Actions will build and publish to Releases
5. Running apps will auto-detect and offer the update

### Manual Release

1. Build locally: `npm run build:win`
2. Go to GitHub > Releases > Create new release
3. Upload the `.exe` files from `dist/`
4. Publish the release

---

## Troubleshooting

### "npm install" fails

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### "electron-builder" not found

```bash
npm install electron-builder --save-dev
```

### Windows build fails on macOS/Linux

Install Wine (see cross-compile section above), or use GitHub Actions.

### FFmpeg not bundled correctly

The build config unpacks ffmpeg-static. Verify in `package.json`:
```json
"asarUnpack": ["node_modules/ffmpeg-static/**/*"],
"extraResources": [{
  "from": "node_modules/ffmpeg-static",
  "to": "ffmpeg"
}]
```

### App won't start after building

Run in dev mode to see errors:
```bash
npm start
```

Or check the packaged app logs:
- **Windows:** `%APPDATA%/videoplayer/logs/`
- **macOS:** `~/Library/Logs/videoplayer/`
- **Linux:** `~/.config/videoplayer/logs/`

---

## Development

```bash
# Run in development mode
npm start

# Run with DevTools open
npm start -- --inspect
```

---

## Project Structure

```
VideoPlayerApp/
├── launcher.js      # Main Electron process
├── launcher.html    # Configuration UI
├── player.html      # Fullscreen video player
├── server.js        # Express API + WebSocket server
├── preload.js       # IPC bridge for security
├── flic-hub/        # Flic Hub integration
│   ├── flic-hub.js  # Script for Flic Hub device
│   └── README.md    # Flic setup instructions
├── package.json     # Dependencies & build config
└── BUILD.md         # This file
```

---

## GitHub Actions Workflow

The `.github/workflows/build.yml` automatically:

1. Builds for Windows, macOS, and Linux on every push
2. Publishes to GitHub Releases when a `v*` tag is pushed
3. Uploads artifacts for 30 days on branch pushes

To manually trigger a build:
1. Go to **Actions** tab
2. Select **Build Video Player**
3. Click **Run workflow**
