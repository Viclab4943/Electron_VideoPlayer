# Flic Hub Script Setup

This folder contains the script that runs directly on your **Flic Hub LR** device. The script listens for button presses and sends commands to the Video Player application.

## Prerequisites

1. **Flic Hub LR** (not the original Flic Hub)
2. **Flic mobile app** (iOS or Android)
3. Flic buttons paired to your hub
4. Video Player app running on a computer on the same network

## Installation Steps

### Step 1: Enable SDK on Flic Hub

1. Open the **Flic app** on your phone
2. Go to **Hub** tab and select your Flic Hub LR
3. Tap **Settings** (gear icon)
4. Scroll down and enable **SDK Access**
5. Optionally set a username/password for SDK authentication

### Step 2: Upload the Script

1. In the Flic app, go to **Hub > SDK Console**
2. Tap **+** to create a new module
3. Name it `flic-hub` (or any name you prefer)
4. Copy the entire contents of `flic-hub.js` from this folder
5. Paste it into the SDK editor
6. **Important:** Update `SERVER_IP` to your computer's local IP address:
   ```javascript
   const SERVER_IP = "192.168.1.100";  // Your computer's IP
   ```
7. Tap **Save & Restart**

### Step 3: Configure Button Mappings (Optional)

By default, buttons are mapped to videos in the order they were paired. To explicitly map buttons:

1. Find each button's Bluetooth address in the Flic app (button settings)
2. Add mappings to the `BUTTON_MAP` object in the script:
   ```javascript
   const BUTTON_MAP = {
       "80:E4:DA:AA:BB:CC": 1,  // This button triggers video1
       "80:E4:DA:DD:EE:FF": 2,  // This button triggers video2
   };
   ```

### Step 4: Configure Video Player App

In the Video Player launcher window:

1. Look for the **Flic Hub** section in the sidebar
2. Enter your Flic Hub's IP address
3. Enter SDK username/password (if you set one in Step 1)
4. Enable "Auto-sync IP on launch"
5. Click **Save**
6. Click **Test** to verify the connection

## Button Actions

| Action | Result |
|--------|--------|
| **Single Click** | Play video WITH sound |
| **Double Click** | Play video MUTED |
| **Hold** | Return to default/idle video |

## How Auto-Sync Works

When "Auto-sync IP on launch" is enabled, the Video Player app will:

1. Detect your computer's local IP address
2. Connect to the Flic Hub's SDK WebSocket
3. Update `SERVER_IP` in the hub script automatically
4. Restart the hub script

This means if your computer's IP changes (DHCP), the app will update the hub script automatically on next launch.

## Troubleshooting

### "Server health: UNREACHABLE"
- Check that Video Player is running and the player window is open
- Verify the computer IP address is correct
- Check firewall settings (port 5555 must be accessible)

### Button presses not working
- Check the SDK Console log in the Flic app for errors
- Verify button mappings if using custom mappings
- Ensure buttons are connected (solid LED, not blinking)

### Auto-sync not working
- Verify Hub IP address is correct in Video Player settings
- Check SDK username/password credentials
- Try the "Test" button to verify connection

## Network Requirements

- Flic Hub and computer must be on the same local network
- Port 5555 (HTTP API) must be accessible
- Port 9999 (SDK WebSocket) used only for auto-sync feature

## Script Details

The script runs continuously on the Flic Hub and:
- Listens for button events via `buttonManager`
- Sends HTTP POST requests to `/changeVideo` and `/close` endpoints
- Performs health checks every 60 seconds
- Logs all activity to the SDK Console
