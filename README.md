# Light Gesture

Light Gesture is a browser-based gesture control system for RGBW lighting. It uses a webcam, MediaPipe hand tracking, and a local Node.js bridge to recognize hand gestures and trigger matching lighting scenes.

The current version is designed for LUX Dynamics and runs under the interface name **HueMotion**. The browser interface shows the live camera feed, detected gesture, selected lighting scene, RGBW output preview, and Casambi trigger status.

## Project Overview

HueMotion allows a user to control RGBW lighting scenes using hand gestures instead of a switch, keypad, or mobile app. The system detects supported gestures in real time and maps each gesture to a lighting scene.

The app can be used in two modes:

1. **Preview mode**
   The browser detects gestures and updates the on-screen RGBW preview only.

2. **Casambi trigger mode**
   The browser sends the detected gesture to a local Node.js server, and the server sends the matching scene command to a Casambi network.

Casambi triggers are off by default so the system can be tested safely before controlling real lights.

## Features

* Live webcam hand tracking
* Gesture recognition using MediaPipe
* Real-time RGBW output preview
* LUX Dynamics branded interface
* Gesture stabilization to reduce false detections
* Trigger cooldown to prevent repeated scene commands
* Local Node.js server
* Casambi WebSocket bridge
* Scene control through Casambi scene IDs
* Safety check for approved gesture keys only
* Camera start and stop controls
* Optional real lighting control through Enable Casambi

## Supported Gestures

| Gesture    | Lighting Scene | RGBW Preview    | Control Key |
| ---------- | -------------- | --------------- | ----------- |
| Heart      | Red            | R 100%          | `r`         |
| Crying     | Blue           | B 100%          | `b`         |
| Jazz Hands | Yellow         | R 100%, G 100%  | `y`         |
| Open Palm  | White          | W 100%          | `w`         |
| Thumbs Up  | Green          | G 100%          | `g`         |
| Peace Sign | Purple         | R 100%, B 100%  | `p`         |
| Shaka      | Gradient       | Cycle preview   | `x`         |
| Hold Fist  | Off            | All channels 0% | `o`         |

## Project Files

| File                | Purpose                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `server.casambi.js` | Runs the local server, serves the web interface, handles gesture-to-scene requests, and sends Casambi scene commands. |
| `package.json`      | Lists required Node.js dependencies.                                                                                  |
| `package-lock.json` | Locks dependency versions.                                                                                            |
| `.env`              | Stores private Casambi configuration values. This file should not be committed.                                       |
| `logo.jpg`          | LUX Dynamics logo shown in the browser interface.                                                                     |
| `README.md`         | Project documentation.                                                                                                |

## Requirements

Required software and hardware:

* Node.js
* npm
* A modern browser such as Chrome or Edge
* Webcam
* Internet access
* Casambi account access
* Casambi network with configured scenes

The browser needs internet access because MediaPipe files are loaded from an online CDN.

## Installation

Clone or download the project folder.

Open a terminal in the project folder.

Install dependencies:

```bash
npm install
```

Make sure the project folder includes:

```text
server.casambi.js
package.json
package-lock.json
.env
logo.jpg
```

## Environment Configuration

Create a local `.env` file in the project folder.

Do not commit this file.

Use this format:

```text
PORT=3000

CASAMBI_BASE_URL=https://door.casambi.com
CASAMBI_WS_URL=wss://door.casambi.com/v1/bridge/

CASAMBI_API_KEY=your_api_key_here
CASAMBI_EMAIL=your_email_here
CASAMBI_PASSWORD=your_password_here
CASAMBI_NETWORK_ID=your_network_id_here
CASAMBI_WIRE=1

CASAMBI_SCENE_RED=1
CASAMBI_SCENE_GREEN=2
CASAMBI_SCENE_BLUE=3
CASAMBI_SCENE_YELLOW=4
CASAMBI_SCENE_WHITE=5
CASAMBI_SCENE_PURPLE=10
CASAMBI_SCENE_OFF=7
CASAMBI_SCENE_GRADIENT=12
```

Each `CASAMBI_SCENE_*` value must match the correct scene ID in the Casambi network.

## Recommended `.gitignore`

Add a `.gitignore` file if one is not already present.

```text
.env
node_modules/
.DS_Store
```

The `.env` file contains private credentials and should stay local.

## Running the App

Start the local server:

```bash
node server.casambi.js
```

Open the app in a browser:

```text
http://localhost:3000
```

The browser should show the HueMotion interface.

## How to Use

1. Start the server with `node server.casambi.js`.
2. Open `http://localhost:3000`.
3. Click **Start**.
4. Allow camera access.
5. Perform a supported gesture.
6. Confirm that the detected gesture and RGBW preview update.
7. Click **Enable Casambi** only when real lighting control is needed.
8. Perform the gesture again to send the scene to Casambi.
9. Click **Disable Casambi** or **Stop** when finished.

## Interface Sections

The HueMotion interface includes:

| Section                | Description                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| Live Camera            | Shows the webcam feed and hand tracking overlay.                     |
| Detected Gesture       | Displays the current recognized gesture.                             |
| Lighting Scene         | Displays the scene linked to the gesture.                            |
| Status                 | Shows whether the system is waiting, starting, tracking, or stopped. |
| Casambi Trigger Status | Shows whether Casambi triggers are enabled or disabled.              |
| RGBW Output            | Shows the red, green, blue, and white channel preview.               |
| Gesture Controls       | Shows all supported gesture-to-scene mappings.                       |

## Local Control Endpoint

The server includes this endpoint:

```text
/control?key=<key>
```

Allowed keys:

```text
r, g, b, y, w, p, o, x
```

Example:

```text
http://localhost:3000/control?key=r
```

A successful response looks similar to:

```json
{
  "ok": true,
  "key": "r",
  "scene": "Red",
  "sent": {
    "wire": 1,
    "method": "controlScene",
    "id": 1,
    "level": 1
  }
}
```

An invalid key returns:

```json
{
  "ok": false,
  "error": "Invalid key"
}
```

## How the Casambi Bridge Works

When a supported gesture is detected, the browser maps the gesture to a control key.

For example:

```text
Heart -> r -> Red Scene
```

If Casambi triggers are enabled, the browser calls the local control endpoint:

```text
/control?key=r
```

The Node.js server checks that the key is approved. If the key is valid, the server finds the matching scene ID from `.env`.

The server then opens or reuses a Casambi WebSocket connection and sends a scene control message:

```js
{
  wire: CASAMBI_WIRE,
  method: "controlScene",
  id: sceneId,
  level: 1
}
```

The `sceneId` comes from the matching `CASAMBI_SCENE_*` value.

## Gesture Detection Notes

The browser uses MediaPipe hand landmarks to classify gestures. It checks finger positions, hand distance, and hand movement.

Some gestures can be detected with one hand:

* Open Palm
* Thumbs Up
* Peace Sign
* Shaka
* Fist

Some gestures use two hands:

* Heart
* Crying
* Jazz Hands

The app includes stabilization so a gesture must be detected for multiple frames before it becomes the active gesture. This helps prevent accidental scene changes.

The app also includes a trigger cooldown so the same gesture does not repeatedly send the same command too quickly.

## Safety Behavior

Casambi triggers are disabled by default.

The browser preview can be tested without changing real lights.

Only approved control keys are accepted by the server.

The Off gesture requires a hold before it sends the Off scene.

The system blocks some accidental Off triggers immediately after specific scenes to reduce false shutoffs.

## Troubleshooting

### Page does not open

Make sure the server is running.

Run:

```bash
node server.casambi.js
```

Then open:

```text
http://localhost:3000
```

Do not open the JavaScript file directly.

### Logo does not appear

Make sure the logo file is named:

```text
logo.jpg
```

The file must be in the same folder as the server file.

### Camera does not start

Check browser camera permissions.

Use Chrome or Edge.

Close other apps that may be using the camera.

Reload the page and click **Start** again.

### Hand tracking does not work

Make sure the computer has internet access.

MediaPipe is loaded from an online CDN.

Check that JavaScript is enabled in the browser.

### Gestures are not detected clearly

Use brighter lighting.

Keep hands fully inside the camera frame.

Avoid fast movement.

Avoid dark or cluttered backgrounds.

Hold each gesture for a moment.

### Casambi triggers do not work

Check that the `.env` file exists.

Confirm these values are present:

```text
CASAMBI_API_KEY
CASAMBI_EMAIL
CASAMBI_PASSWORD
CASAMBI_NETWORK_ID
```

Confirm that the Casambi account has access to the configured network.

Confirm that the scene IDs in `.env` match the Casambi scene IDs.

Restart the server after changing `.env`.

### Wrong scene triggers

Check the scene ID assigned to each `CASAMBI_SCENE_*` variable.

For example, if Heart should trigger Red, confirm that:

```text
CASAMBI_SCENE_RED
```

matches the actual Red scene ID in Casambi.

### WebSocket error

Restart the server.

Check internet access.

Check Casambi credentials.

Check the network ID.

Try triggering again after a few seconds because the first request may need to create the session and open the wire.

## Security Notes

Never commit `.env`.

Never publish the Casambi API key.

Never publish the Casambi password.

Rotate credentials if the `.env` file is shared, uploaded, or committed by mistake.

Keep the server local unless remote access is intentionally configured and secured.

The control endpoint should only accept approved lighting keys.

## Development Notes

The current implementation keeps the server, interface HTML, CSS, and browser JavaScript inside one server file. This makes the demo easy to run, but it can become difficult to maintain.

For future development, the project can be split into this structure:

```text
Light-Gesture/
  server.casambi.js
  public/
    index.html
    styles.css
    app.js
    logo.jpg
  package.json
  package-lock.json
  .env.example
  .gitignore
  README.md
```

A safe `.env.example` file can be committed, but the real `.env` file should stay private.

## Legacy ESA2 Version

An earlier version of this project used ESA2 and AutoHotkey. That version sent keyboard shortcuts to ESA2 instead of sending direct Casambi scene commands.

The legacy ESA2 keys were:

```text
r = Red
g = Green
b = Blue
y = Yellow
w = White
p = Purple
o = Off
```

The current Casambi version uses the same basic gesture concept but sends scene commands through the Casambi bridge instead of AutoHotkey.

## Credits

Developed by Kailani Puava Alarcon.

Created for LUX Dynamics.
