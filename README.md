# Light Gesture

Light Gesture is a browser-based gesture control demo for RGBW lighting. It uses a webcam and MediaPipe hand tracking to recognize hand gestures, preview the matching RGBW output in the browser, and optionally trigger lighting scenes in ESA2 through AutoHotkey.

## Project Overview

This project was built for a LUX Dynamics gesture-controlled lighting demonstration. The web interface detects specific hand gestures and maps each gesture to a lighting response. When DMX triggers are enabled, the app sends keyboard commands to ESA2 so the lighting scene can change automatically.

## Features

- Live webcam hand tracking
- Gesture recognition using MediaPipe
- RGBW output preview in the browser
- Optional DMX / ESA2 scene triggering
- AutoHotkey bridge for sending scene keys to ESA2
- Simple local server using Node.js
- No npm package installation required
- Local control endpoint for triggering approved lighting keys

## Gesture Controls

| Gesture | Lighting Scene | RGBW Output | ESA2 Key |
|---|---:|---:|---:|
| Heart | Red | R 100% | `r` |
| Crying | Blue | B 100% | `b` |
| Jazz Hands | Yellow | R 100%, G 100% | `y` |
| Open Palm | White | W 100% | `w` |
| Thumbs Up | Green | G 100% | `g` |
| Peace Sign | Purple | R 100%, B 100% | `p` |
| Fist | Off | All channels 0% | `o` |

## Project Files

| File | Purpose |
|---|---|
| `server.js` | Runs the local web server, displays the gesture control page, loads MediaPipe, handles webcam gesture recognition, and sends approved control keys to AutoHotkey |
| `send_key.ahk` | AutoHotkey script that sends approved keyboard shortcuts to ESA2 |
| `logo.jpg` | LUX Dynamics logo used in the web interface |
| `keys.dlm` | Lighting control file included with the project |
| `README.md` | Project documentation |

## Requirements

This project is intended to run on Windows because ESA2 and AutoHotkey are used for the lighting control bridge.

Required software and hardware:

- Node.js
- AutoHotkey v2.0
- ESA2 / Easy Stand Alone 2
- A modern browser such as Chrome or Edge
- A webcam
- Internet access for loading MediaPipe files from the CDN

## Setup Instructions

### 1. Install Node.js

Install Node.js on the computer.

After installing, open Command Prompt or PowerShell and check that Node.js is available:

```bash
node -v
```

If a version number appears, Node.js is installed correctly.

### 2. Install AutoHotkey v2

Install AutoHotkey v2.0.

The project searches for AutoHotkey in these common locations:

```text
C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe
C:\Program Files\AutoHotkey\AutoHotkey64.exe
C:\Program Files (x86)\AutoHotkey\AutoHotkey.exe
```

If AutoHotkey is installed somewhere else, update the `getAutoHotkeyPath()` function in `server.js`.

### 3. Open ESA2

Open ESA2 / Easy Stand Alone 2 before using DMX triggers.

Make sure the ESA2 lighting project is configured so these keyboard shortcuts activate the correct lighting scenes:

```text
r = Red
g = Green
b = Blue
y = Yellow
w = White
p = Purple
o = Off
```

### 4. Run the Local Server

Open Command Prompt or PowerShell in the project folder.

Run:

```bash
node server.js
```

The terminal should display:

```text
LUX Gesture Demo running at:
http://localhost:3000
```

### 5. Open the Web App

Open this address in a browser:

```text
http://localhost:3000
```

Click **Start Camera** and allow camera access when prompted.

## How to Use the Demo

1. Open ESA2.
2. Run the local server with `node server.js`.
3. Open `http://localhost:3000` in the browser.
4. Click **Start Camera**.
5. Allow webcam access.
6. Perform one of the supported gestures.
7. Confirm that the browser detects the gesture and updates the RGBW preview.
8. Click **Enable DMX Triggers** to allow the app to send lighting scene commands to ESA2.

DMX triggers are off by default. This allows the gesture recognition system to be tested safely before controlling the lights.

## How It Works

The app runs through a local Node.js server on port `3000`. The server displays an HTML page that contains the webcam interface, gesture display, lighting scene display, RGBW preview, and DMX trigger controls.

The browser loads MediaPipe hand tracking through a CDN and analyzes webcam frames in real time. The JavaScript code checks hand landmark positions to classify gestures such as Heart, Crying, Jazz Hands, Open Palm, Thumbs Up, Peace Sign, and Fist.

When a gesture is recognized, the browser updates the visible lighting scene and RGBW output preview. If DMX triggers are enabled, the browser sends a request to the local server using the `/control` route.

Example control request:

```text
/control?key=r
```

The server checks that the key is approved. If the key is valid, the server runs `send_key.ahk` and passes the selected key to the AutoHotkey script.

The AutoHotkey script searches for an ESA2 window. It looks for a window title or process name containing:

```text
esa
easy stand alone
```

If ESA2 is found, AutoHotkey sends the matching keyboard shortcut to ESA2 in the background.

## Local Control Endpoint

The server includes this local control endpoint:

```text
/control?key=<key>
```

Allowed keys:

```text
r, g, b, y, w, p, o
```

Example:

```text
http://localhost:3000/control?key=r
```

A successful request returns JSON similar to:

```json
{
  "ok": true,
  "key": "r",
  "scene": "Red"
}
```

An invalid key returns:

```json
{
  "ok": false,
  "error": "Invalid key"
}
```

## Gesture Detection Notes

The app uses MediaPipe hand landmarks to classify gestures.

Some gestures can be detected with one hand:

- Open Palm
- Thumbs Up
- Peace Sign

Some gestures use two hands:

- Heart
- Crying
- Jazz Hands
- Fist

The app includes gesture stabilization so a gesture must be detected for multiple frames before it becomes the active scene. This helps reduce false triggers. The app also includes a cooldown so the same gesture does not repeatedly send the same ESA2 command too quickly.

## Troubleshooting

### Camera does not start

Make sure the browser has permission to use the webcam.

Use the local server address:

```text
http://localhost:3000
```

Do not open the project by double-clicking the JavaScript file. The app should be run through the local Node.js server.

### The page opens, but hand tracking does not work

Make sure the computer has internet access. MediaPipe files are loaded online from a CDN.

Also check that the browser supports webcam access and JavaScript modules.

### Gestures are not detected clearly

Use good lighting and keep your hands clearly visible in the camera frame.

Try these steps:

- Face the camera directly
- Keep hands inside the video frame
- Avoid very dark backgrounds
- Avoid moving too fast
- Hold the gesture for a moment

### ESA2 does not respond

Check that ESA2 is open before enabling DMX triggers.

Make sure the ESA2 project has keyboard shortcuts assigned to these keys:

```text
r, g, b, y, w, p, o
```

Also confirm that AutoHotkey v2.0 is installed.

### AutoHotkey cannot be found

The server looks for AutoHotkey in common install locations. If AutoHotkey is installed somewhere else, edit the `getAutoHotkeyPath()` function in `server.js`.

### Wrong lighting scene is triggered

Check the keyboard shortcut settings inside ESA2. The shortcut keys in ESA2 must match the gesture key mapping used by this project.

### Browser preview works, but lights do not change

Confirm these items:

- ESA2 is open
- AutoHotkey v2.0 is installed
- DMX triggers are enabled in the browser
- ESA2 has the correct keyboard shortcuts
- The lighting controller is connected and working in ESA2

## Security Notes

The local server only accepts approved lighting control keys:

```text
r, g, b, y, w, p, o
```

Any other key is rejected. This prevents the control endpoint from sending unintended keyboard commands.

## Development Notes

The project uses only built-in Node.js modules:

- `http`
- `child_process`
- `path`
- `fs`

No npm dependencies are required.

MediaPipe is loaded in the browser from online sources using JavaScript module imports.

The app runs locally at:

```text
http://localhost:3000
```

The default port is set in `server.js`:

```js
const PORT = 3000;
```

## Credits

Developed by Kailani Puava Alarcon.

Project created for LUX Dynamics.

## License

No license has been specified for this project.
