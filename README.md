# Light Gesture

Light Gesture is a browser-based gesture control demo for RGBW lighting. It uses a webcam and MediaPipe hand tracking to recognize hand gestures, preview the matching RGBW output in the browser, and optionally trigger lighting scenes in ESA2 through AutoHotkey.

## Project Overview

This project was built for a LUX Dynamics gesture-controlled lighting demonstration. The web interface detects specific hand gestures and maps each gesture to a lighting response. When DMX triggers are enabled, the app sends keyboard commands to ESA2 so the lighting scene can change automatically.

## Features

- Live webcam hand tracking
- Gesture recognition using MediaPipe
- RGBW output preview in the browser
- Optional DMX/ESA2 scene triggering
- AutoHotkey bridge for sending scene keys to ESA2
- Simple local server using Node.js
- No npm package installation required

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

## Files

| File | Purpose |
|---|---|
| `server.js` | Runs the local web server, serves the gesture page, and handles ESA2 control requests |
| `send_key.ahk` | Sends approved keyboard shortcuts to ESA2 using AutoHotkey |
| `logo.jpg` | Logo shown in the web interface |
| `keys.dlm` | Lighting control/show file included with the project |
| `README.md` | Project documentation |

## Requirements

This project is designed for Windows because ESA2 and AutoHotkey are used for the lighting trigger bridge.

Required software:

- Node.js
- AutoHotkey v2.0
- ESA2 / Easy Stand Alone 2
- A modern browser such as Chrome or Edge
- A webcam
- Internet access for loading MediaPipe files from the CDN

## Setup Instructions

### 1. Install Node.js

Install Node.js from the official Node.js website.

After installing, confirm that Node.js is available by opening Command Prompt or PowerShell and running:

```bash
node -v
