/**
 * Flic Hub Script for Video Player
 *
 * This script runs directly ON the Flic Hub LR device.
 * It listens for button presses and sends HTTP requests to the Video Player app.
 *
 * INSTALLATION:
 * 1. Open the Flic app on your phone
 * 2. Go to Flic Hub LR > SDK Console (enable SDK in Hub settings first)
 * 3. Create a new module named "flic-hub" (or any name you prefer)
 * 4. Paste this entire script into the editor
 * 5. Update SERVER_IP below to match your computer's IP address
 * 6. Click "Save & Restart"
 *
 * The Video Player app can automatically update SERVER_IP when it launches
 * if you configure the Flic Hub settings in the app's launcher window.
 */

// ============================================================================
// CONFIGURATION - Update this IP to your Video Player computer's local IP
// ============================================================================
const SERVER_IP = "192.168.1.100";
const SERVER_PORT = 5555;

// ============================================================================
// BUTTON MAPPINGS
// Map each button's Bluetooth address to a video number (1-15)
// You can find button addresses in the Flic app under each button's settings
// ============================================================================
const BUTTON_MAP = {
    // Example: "80:E4:DA:XX:XX:XX": 1,  // Button 1 -> video1
    // Add your button mappings here:
    // "80:E4:DA:AA:BB:CC": 1,
    // "80:E4:DA:DD:EE:FF": 2,
};

// ============================================================================
// SCRIPT LOGIC - No need to modify below this line
// ============================================================================

const http = require("http");
const buttonManager = require("buttons");

const SERVER_URL = `http://${SERVER_IP}:${SERVER_PORT}`;

// Log startup
console.log("===========================================");
console.log("Video Player Flic Hub Script Started");
console.log("Server URL: " + SERVER_URL);
console.log("Button mappings: " + Object.keys(BUTTON_MAP).length + " configured");
console.log("===========================================");

/**
 * Send HTTP POST request to Video Player server
 */
function sendRequest(endpoint, data, callback) {
    const postData = JSON.stringify(data);

    const options = {
        host: SERVER_IP,
        port: SERVER_PORT,
        path: endpoint,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": postData.length
        }
    };

    const req = http.request(options, function(res) {
        let body = "";
        res.on("data", function(chunk) {
            body += chunk;
        });
        res.on("end", function() {
            console.log("Response [" + res.statusCode + "]: " + body);
            if (callback) callback(null, res.statusCode, body);
        });
    });

    req.on("error", function(err) {
        console.log("Request error: " + err.message);
        if (callback) callback(err);
    });

    req.setTimeout(5000, function() {
        console.log("Request timeout");
        req.destroy();
    });

    req.write(postData);
    req.end();
}

/**
 * Trigger a video change
 * @param {number} videoNumber - The video slot number (1-15)
 * @param {string} clickType - "click" (with sound) or "double_click" (muted)
 */
function changeVideo(videoNumber, clickType) {
    console.log("Changing to video " + videoNumber + " (" + clickType + ")");
    sendRequest("/changeVideo", {
        video: videoNumber,
        click_type: clickType
    });
}

/**
 * Return to default video
 */
function returnToDefault() {
    console.log("Returning to default video");
    sendRequest("/close", {});
}

/**
 * Get video number for a button's Bluetooth address
 */
function getVideoNumber(bdAddr) {
    // Check explicit mapping first
    if (BUTTON_MAP[bdAddr]) {
        return BUTTON_MAP[bdAddr];
    }

    // Auto-assign based on button index (fallback)
    // This uses the order buttons were paired with the hub
    const buttons = buttonManager.getButtons();
    for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].bdAddr === bdAddr) {
            return i + 1; // video1, video2, etc.
        }
    }

    return 1; // Default to video 1
}

// ============================================================================
// BUTTON EVENT HANDLERS
// ============================================================================

buttonManager.on("buttonSingleOrDoubleClickOrHold", function(obj) {
    const button = buttonManager.getButton(obj.bdAddr);
    const buttonName = button ? button.name : obj.bdAddr;
    const videoNumber = getVideoNumber(obj.bdAddr);

    console.log("----------------------------------------");
    console.log("Button: " + buttonName);
    console.log("Event: " + obj.clickType);
    console.log("Video: " + videoNumber);

    switch (obj.clickType) {
        case "ButtonSingleClick":
            // Single click: Play video WITH sound
            changeVideo(videoNumber, "click");
            break;

        case "ButtonDoubleClick":
            // Double click: Play video MUTED
            changeVideo(videoNumber, "double_click");
            break;

        case "ButtonHold":
            // Hold: Return to default/idle video
            returnToDefault();
            break;

        default:
            console.log("Unknown click type: " + obj.clickType);
    }
});

// Log when buttons connect/disconnect
buttonManager.on("buttonConnected", function(obj) {
    const button = buttonManager.getButton(obj.bdAddr);
    console.log("Button connected: " + (button ? button.name : obj.bdAddr));
});

buttonManager.on("buttonDisconnected", function(obj) {
    const button = buttonManager.getButton(obj.bdAddr);
    console.log("Button disconnected: " + (button ? button.name : obj.bdAddr));
});

// Health check - ping server every 60 seconds
setInterval(function() {
    const req = http.request({
        host: SERVER_IP,
        port: SERVER_PORT,
        path: "/health",
        method: "GET",
        timeout: 3000
    }, function(res) {
        if (res.statusCode === 200) {
            console.log("Server health: OK");
        }
    });
    req.on("error", function() {
        console.log("Server health: UNREACHABLE");
    });
    req.end();
}, 60000);

console.log("Flic Hub script initialized. Waiting for button presses...");
