🎬 VIDEO PLAYER - USER GUIDE
===============================================

SETUP:
1. Install the app (double-click the installer)
2. Open the "videos" folder inside the app
3. Add your videos:
   - default.mp4 → Plays on loop (muted)
   - video1.mp4 → Button 1
   - video2.mp4 → Button 2
   - video3.mp4 → Button 3

Videos can be any format: .mp4, .mov, .avi, .mkv, etc.

RUNNING:
- Double-click "Video Player" to start
- App opens in fullscreen automatically
- Default video plays on loop
- Press buttons to trigger action videos
- Action videos return to default when done

FLIC BUTTON SETUP:
Configure your Flic Hub to send POST requests to:
http://YOUR_COMPUTER_IP:5555

Endpoints:
- /changeVideo → Play action video
- /close → Return to default

TROUBLESHOOTING:
- Videos not converting? FFmpeg is bundled!
- App won't start? Check videos folder exists
- Buttons not working? Check Flic Hub IP config

KEYBOARD SHORTCUTS (for testing):
- Press 1, 2, 3 → Play action videos
- Press 0 → Return to default
- Press Space → Pause/Resume

===============================================
