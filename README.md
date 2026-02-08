🎬 VIDEO PLAYER - USER GUIDE
===============================================

SETUP:
1. Install the app
2. Add videos to the "videos" folder:
   - default.mp4 → Plays on loop (muted)
   - video1.mp4 → Button 1
   - video2.mp4 → Button 2
   - video3.mp4 → Button 3
   - video4.mp4 → Button 4
   - video5.mp4 → Button 5
   ... add as many as you want!

Videos can be: .mp4, .mov, .avi, .mkv, .webm, etc.

BUTTON BEHAVIOR:
- Single click → Play video WITH sound
- Double click → Play video WITHOUT sound (muted)

All action videos return to default when finished.

EXITING THE APP:
- Press ESC → Exit fullscreen
- Press Cmd+Q (Mac) or Ctrl+Q (Win) → Quit app

FLIC BUTTON CONFIG:
Send POST to: http://YOUR_IP:5555/changeVideo
Body: {"video-id": 1, "click-type": "click"}
     {"video-id": 1, "click-type": "double_click"}

KEYBOARD TESTING:
- 1, 2, 3, 4, 5 → Play videos with sound
- Shift+1, Shift+2 → Play muted
- 0 → Return to default
- Space → Pause/Resume

===============================================
