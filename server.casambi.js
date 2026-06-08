const http = require("http");
const path = require("path");
const fs = require("fs");
const WebSocket = require("ws");

loadDotEnv(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const CASAMBI_BASE_URL = process.env.CASAMBI_BASE_URL || "https://door.casambi.com";
const CASAMBI_WS_URL = process.env.CASAMBI_WS_URL || "wss://door.casambi.com/v1/bridge/";
const CASAMBI_API_KEY = process.env.CASAMBI_API_KEY || "";
const CASAMBI_EMAIL = process.env.CASAMBI_EMAIL || process.env.CASAMBI_LOGIN_EMAIL || "";
const CASAMBI_PASSWORD = process.env.CASAMBI_PASSWORD || process.env.CASAMBI_LOGIN_PASSWORD || "";
const CASAMBI_NETWORK_ID = process.env.CASAMBI_NETWORK_ID || "";
const CASAMBI_WIRE = Number(process.env.CASAMBI_WIRE || 1);

const allowedKeys = new Set(["r", "g", "b", "y", "w", "p", "o", "x"]);

const sceneNames = {
  r: "Red",
  g: "Green",
  b: "Blue",
  y: "Yellow",
  w: "White",
  p: "Purple",
  o: "Off",
  x: "Gradient"
};

const sceneEnvByKey = {
  r: "CASAMBI_SCENE_RED",
  g: "CASAMBI_SCENE_GREEN",
  b: "CASAMBI_SCENE_BLUE",
  y: "CASAMBI_SCENE_YELLOW",
  w: "CASAMBI_SCENE_WHITE",
  p: "CASAMBI_SCENE_PURPLE",
  o: "CASAMBI_SCENE_OFF",
  x: "CASAMBI_SCENE_GRADIENT"
};

let casambiSessionId = "";
let socket = null;
let socketOpenPromise = null;
let wireOpen = false;
let keepAliveTimer = null;

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalIndex = trimmed.indexOf("=");

    if (equalIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function jsonResponse(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });

  response.end(JSON.stringify(payload, null, 2));
}

function requireCasambiConfig() {
  const missing = [];

  if (!CASAMBI_API_KEY) {
    missing.push("CASAMBI_API_KEY");
  }

  if (!CASAMBI_EMAIL) {
    missing.push("CASAMBI_EMAIL");
  }

  if (!CASAMBI_PASSWORD) {
    missing.push("CASAMBI_PASSWORD");
  }

  if (!CASAMBI_NETWORK_ID) {
    missing.push("CASAMBI_NETWORK_ID");
  }

  if (missing.length > 0) {
    throw new Error("Missing .env values: " + missing.join(", "));
  }
}

function getSessionIdFromLogin(data) {
  if (!data) {
    return "";
  }

  if (data.sessionId) {
    return data.sessionId;
  }

  if (data[CASAMBI_NETWORK_ID] && data[CASAMBI_NETWORK_ID].sessionId) {
    return data[CASAMBI_NETWORK_ID].sessionId;
  }

  if (Array.isArray(data)) {
    const network = data.find(item => item && item.id === CASAMBI_NETWORK_ID);

    if (network && network.sessionId) {
      return network.sessionId;
    }
  }

  if (data.networks && Array.isArray(data.networks)) {
    const network = data.networks.find(item => item && item.id === CASAMBI_NETWORK_ID);

    if (network && network.sessionId) {
      return network.sessionId;
    }
  }

  return "";
}

async function createCasambiSession() {
  requireCasambiConfig();

  if (casambiSessionId) {
    return casambiSessionId;
  }

  const response = await fetch(CASAMBI_BASE_URL + "/v1/networks/session/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Casambi-Key": CASAMBI_API_KEY
    },
    body: JSON.stringify({
      email: CASAMBI_EMAIL,
      password: CASAMBI_PASSWORD
    })
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error("Casambi login failed: HTTP " + response.status + " " + text);
  }

  const data = JSON.parse(text);
  casambiSessionId = getSessionIdFromLogin(data);

  if (!casambiSessionId) {
    throw new Error("Could not find a session ID for CASAMBI_NETWORK_ID in the login response.");
  }

  return casambiSessionId;
}

async function ensureCasambiSocket() {
  const sessionId = await createCasambiSession();

  if (socket && socket.readyState === WebSocket.OPEN && wireOpen) {
    return;
  }

  if (socketOpenPromise) {
    return socketOpenPromise;
  }

  socketOpenPromise = new Promise((resolve, reject) => {
    wireOpen = false;
    socket = new WebSocket(CASAMBI_WS_URL, CASAMBI_API_KEY);

    const timeout = setTimeout(() => {
      socketOpenPromise = null;
      reject(new Error("Timed out opening Casambi WebSocket wire"));
    }, 15000);

    socket.on("open", () => {
      socket.send(JSON.stringify({
        method: "open",
        id: CASAMBI_NETWORK_ID,
        session: sessionId,
        ref: "huemotion",
        wire: CASAMBI_WIRE,
        type: 1
      }));
    });

    socket.on("message", message => {
      let data;

      try {
        data = JSON.parse(message.toString());
      } catch {
        return;
      }

      if (data.wireStatus === "openWireSucceed") {
        clearTimeout(timeout);
        wireOpen = true;
        socketOpenPromise = null;
        startKeepAlive();
        console.log("Casambi wire opened");
        resolve();
        return;
      }

      if (data.wireStatus && data.wireStatus !== "openWireSucceed") {
        clearTimeout(timeout);
        socketOpenPromise = null;
        reject(new Error("Casambi wire error: " + JSON.stringify(data)));
      }
    });

    socket.on("error", error => {
      clearTimeout(timeout);
      socketOpenPromise = null;
      wireOpen = false;
      reject(error);
    });

    socket.on("close", () => {
      socket = null;
      socketOpenPromise = null;
      wireOpen = false;
      stopKeepAlive();
      console.log("Casambi WebSocket closed");
    });
  });

  return socketOpenPromise;
}

function startKeepAlive() {
  stopKeepAlive();

  keepAliveTimer = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN && wireOpen) {
      socket.send(JSON.stringify({
        method: "ping",
        wire: CASAMBI_WIRE
      }));
    }
  }, 240000);
}

function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

function getSceneId(key) {
  const envName = sceneEnvByKey[key];
  const sceneId = Number(process.env[envName]);

  if (!Number.isInteger(sceneId)) {
    throw new Error("Missing or invalid " + envName + " in .env");
  }

  return sceneId;
}

function sendCasambiMessage(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN || !wireOpen) {
    throw new Error("Casambi WebSocket is not open");
  }

  socket.send(JSON.stringify(message));
}

async function sendKeyToCasambi(key, response) {
  if (!allowedKeys.has(key)) {
    jsonResponse(response, 400, {
      ok: false,
      error: "Invalid key"
    });

    return;
  }

  try {
    await ensureCasambiSocket();

    const message = {
      wire: CASAMBI_WIRE,
      method: "controlScene",
      id: getSceneId(key),
      level: 1
    };

    sendCasambiMessage(message);

    jsonResponse(response, 200, {
      ok: true,
      key: key,
      scene: sceneNames[key],
      sent: message
    });

    console.log("Sent scene: " + sceneNames[key]);
  } catch (error) {
    jsonResponse(response, 500, {
      ok: false,
      error: error.message
    });
  }
}

function getGesturePageHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HueMotion</title>

  <style>
    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      font-family: Arial, sans-serif;
      background: #050505;
      color: white;
    }

    body {
      padding: 10px;
    }

    .page {
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-rows: 72px 1fr;
      gap: 10px;
    }

    .top {
      display: grid;
      grid-template-columns: 220px 1fr 220px;
      align-items: center;
      background: #101010;
      border: 1px solid #333;
      border-radius: 14px;
      padding: 8px 14px;
      min-height: 0;
    }

    .logoWrap {
      height: 54px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }

    .logo {
      max-width: 190px;
      max-height: 54px;
      object-fit: contain;
      display: block;
    }

    .titleBox {
      text-align: center;
    }

    h1 {
      font-size: clamp(26px, 2.4vw, 40px);
      line-height: 1;
      margin: 0;
      letter-spacing: 1px;
    }

    .subtitle {
      color: #bfbfbf;
      font-size: clamp(12px, 1.1vw, 16px);
      margin-top: 5px;
    }

    .statusTop {
      color: #d6d6d6;
      font-size: 15px;
      text-align: right;
      white-space: nowrap;
    }

    .dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      background: #76b843;
      border-radius: 50%;
      margin-right: 7px;
    }

    .mainGrid {
      min-height: 0;
      display: grid;
      grid-template-columns: 1.55fr 0.85fr 1.05fr;
      gap: 10px;
    }

    .panel,
    .infoCard,
    .gestureCard,
    .channel {
      background: #101010;
      border: 1px solid #333;
      border-radius: 14px;
    }

    .panel {
      min-height: 0;
      padding: 12px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 0 20px rgba(118, 184, 67, 0.08);
    }

    .panelLabel {
      color: #76b843;
      font-weight: bold;
      letter-spacing: 1px;
      margin-bottom: 8px;
      font-size: 13px;
      flex: 0 0 auto;
    }

    .cameraPanel {
      overflow: hidden;
    }

    .cameraPanel.cameraOff .panelLabel {
      color: #ff4b4b;
    }

    .cameraPanel.cameraOff .dot {
      background: #ff4b4b;
    }

    .cameraPanel.cameraOff .videoFrame {
      border-color: #ff4b4b;
      box-shadow: 0 0 18px rgba(255, 75, 75, 0.35);
    }

    .videoFrame {
      min-height: 0;
      flex: 1 1 auto;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      border: 2px solid #333;
      border-radius: 12px;
      overflow: hidden;
    }

    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
      background: #000;
      display: block;
      z-index: 1;
    }

    .trackingCanvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      transform: scaleX(-1);
      pointer-events: none;
      z-index: 2;
    }

    .cameraOverlay {
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 24px;
      background: rgba(0, 0, 0, 0.68);
      color: white;
      font-size: clamp(28px, 3vw, 52px);
      line-height: 1.1;
      font-weight: bold;
      z-index: 5;
    }

    .cameraOverlay.show {
      display: flex;
    }

    .buttonRow {
      display: grid;
      grid-template-columns: 1fr 1fr 1.4fr;
      gap: 8px;
      margin-top: 10px;
      flex: 0 0 auto;
    }

    button {
      font-size: clamp(13px, 1vw, 18px);
      padding: 10px 12px;
      background: #76b843;
      color: black;
      border: none;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      min-width: 0;
    }

    #stopButton {
      background: #333;
      color: white;
      border: 1px solid #666;
    }

    #triggerButton {
      background: #111;
      color: white;
      border: 1px solid #76b843;
    }

    #triggerButton.enabled {
      background: #76b843;
      color: black;
    }

    .centerPanel {
      min-height: 0;
      display: grid;
      grid-template-rows: 1fr 1fr 1fr 1.35fr;
      gap: 10px;
    }

    .infoCard {
      min-height: 0;
      padding: 14px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .smallLabel {
      color: #a7a7a7;
      font-size: 12px;
      font-weight: bold;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }

    #gesture,
    #lightResponse,
    #status {
      font-size: clamp(24px, 2.3vw, 38px);
      line-height: 1.05;
      font-weight: bold;
    }

    #bridgeStatus {
      font-size: clamp(15px, 1.3vw, 21px);
      color: #d6d6d6;
      line-height: 1.2;
      margin-top: 4px;
    }

    .sceneRow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .sceneDot {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: gray;
      border: 2px solid #555;
      flex: 0 0 auto;
    }

    .sceneDot.gradient {
      background: linear-gradient(135deg, red, yellow, lime, cyan, blue, purple);
    }

    .rgbwCard {
      padding: 12px;
    }

    .rgbwGrid {
      min-height: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      flex: 1;
    }

    .channel {
      min-height: 0;
      padding: 8px;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .channelLetter {
      font-size: clamp(20px, 1.8vw, 30px);
      line-height: 1;
      font-weight: bold;
    }

    .channelName {
      font-size: 11px;
      color: #bfbfbf;
      margin-top: 4px;
    }

    .channelValue {
      font-size: clamp(13px, 1.1vw, 18px);
      margin-top: 5px;
    }

    #rChannel.active {
      background: #c60000;
    }

    #gChannel.active {
      background: #3a6f1f;
    }

    #bChannel.active {
      background: #003caa;
    }

    #wChannel.active {
      background: #eeeeee;
      color: black;
    }

    .gradientPreview {
      background: linear-gradient(135deg, red, yellow, lime, cyan, blue, purple) !important;
      color: white;
    }

    .gesturePanel {
      min-height: 0;
    }

    .gestureGrid {
      min-height: 0;
      flex: 1 1 auto;
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: repeat(4, 1fr);
      gap: 8px;
    }

    .gestureCard {
      min-height: 0;
      padding: 8px;
      display: grid;
      grid-template-columns: 50px 1fr;
      align-items: center;
      column-gap: 8px;
    }

    .gestureCard.active {
      border: 2px solid #76b843;
      box-shadow: 0 0 16px rgba(118, 184, 67, 0.35);
    }

    .iconBadge {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #181818;
      border: 1px solid #3a3a3a;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 23px;
      font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
    }

    .doubleIcon {
      width: 50px;
      height: 42px;
      border-radius: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1px;
      font-size: 17px;
      line-height: 1;
      letter-spacing: 0;
      padding: 0;
    }

    .gestureCard.active .iconBadge {
      border-color: #76b843;
      box-shadow: 0 0 12px rgba(118, 184, 67, 0.45);
      background: #202820;
    }

    .gestureName {
      font-size: clamp(14px, 1.15vw, 18px);
      line-height: 1.05;
      font-weight: bold;
      margin-bottom: 3px;
    }

    .gestureColor {
      color: #cfcfcf;
      font-size: clamp(12px, 0.95vw, 15px);
    }

    @media (max-width: 1100px) {
      body {
        overflow: auto;
      }

      .page {
        height: auto;
        min-height: 100%;
        grid-template-rows: auto auto;
      }

      .top {
        grid-template-columns: 1fr;
        gap: 8px;
        text-align: center;
      }

      .logoWrap,
      .statusTop {
        justify-content: center;
        text-align: center;
      }

      .mainGrid {
        grid-template-columns: 1fr;
      }

      .cameraPanel {
        min-height: 420px;
      }

      .centerPanel {
        grid-template-rows: auto;
      }
    }

    @media (max-height: 720px) and (min-width: 1101px) {
      .page {
        grid-template-rows: 62px 1fr;
      }

      .top {
        padding: 6px 12px;
      }

      .logoWrap {
        height: 46px;
      }

      .logo {
        max-height: 46px;
      }

      h1 {
        font-size: 28px;
      }

      .subtitle {
        font-size: 12px;
        margin-top: 3px;
      }

      .panel {
        padding: 10px;
      }

      .infoCard {
        padding: 10px;
      }

      .buttonRow {
        margin-top: 8px;
      }

      button {
        padding: 8px 10px;
      }

      .iconBadge {
        width: 36px;
        height: 36px;
        font-size: 20px;
      }

      .doubleIcon {
        width: 48px;
        height: 36px;
        font-size: 15px;
      }

      .gestureCard {
        grid-template-columns: 50px 1fr;
        padding: 6px;
      }
    }
  </style>
</head>

<body>
  <div class="page">
    <div class="top">
      <div class="logoWrap">
        <img class="logo" src="/logo.jpg" alt="LUX Dynamics Logo">
      </div>

      <div class="titleBox">
        <h1>HueMotion</h1>
        <div class="subtitle">Developed By Kailani Puava Alarcon</div>
      </div>

      <div class="statusTop">
        <span class="dot"></span>System Ready
      </div>
    </div>

    <div class="mainGrid">
      <div id="cameraPanel" class="panel cameraPanel cameraOff">
        <div class="panelLabel"><span class="dot"></span>LIVE CAMERA</div>

        <div class="videoFrame">
          <video id="video" autoplay playsinline></video>
          <canvas id="trackingCanvas" class="trackingCanvas"></canvas>
          <div id="cameraOverlay" class="cameraOverlay">Please only use appropriate gestures</div>
        </div>

        <div class="buttonRow">
          <button id="startButton">Start</button>
          <button id="stopButton">Stop</button>
          <button id="triggerButton">Enable Casambi</button>
        </div>
      </div>

      <div class="centerPanel">
        <div class="infoCard">
          <div class="smallLabel">DETECTED GESTURE</div>
          <div id="gesture">Unknown</div>
        </div>

        <div class="infoCard">
          <div class="smallLabel">LIGHTING SCENE</div>
          <div class="sceneRow">
            <div id="lightResponse">None</div>
            <div id="sceneDot" class="sceneDot"></div>
          </div>
        </div>

        <div class="infoCard">
          <div class="smallLabel">STATUS</div>
          <div id="status">Waiting</div>
          <div id="bridgeStatus">Casambi Triggers: Off</div>
        </div>

        <div class="infoCard rgbwCard">
          <div class="smallLabel">RGBW OUTPUT</div>

          <div class="rgbwGrid">
            <div id="rChannel" class="channel">
              <div class="channelLetter">R</div>
              <div class="channelName">RED</div>
              <div id="rValue" class="channelValue">0%</div>
            </div>

            <div id="gChannel" class="channel">
              <div class="channelLetter">G</div>
              <div class="channelName">GREEN</div>
              <div id="gValue" class="channelValue">0%</div>
            </div>

            <div id="bChannel" class="channel">
              <div class="channelLetter">B</div>
              <div class="channelName">BLUE</div>
              <div id="bValue" class="channelValue">0%</div>
            </div>

            <div id="wChannel" class="channel">
              <div class="channelLetter">W</div>
              <div class="channelName">WHITE</div>
              <div id="wValue" class="channelValue">0%</div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel gesturePanel">
        <div class="panelLabel"><span class="dot"></span>GESTURE CONTROLS</div>

        <div class="gestureGrid">
          <div id="heartCard" class="gestureCard">
            <div class="iconBadge">&#x1FAF6;</div>
            <div>
              <div class="gestureName">Heart</div>
              <div class="gestureColor">Red</div>
            </div>
          </div>

          <div id="cryingCard" class="gestureCard">
            <div class="iconBadge doubleIcon">
              <span>&#x270A;</span>
              <span>&#x270A;</span>
            </div>
            <div>
              <div class="gestureName">Crying</div>
              <div class="gestureColor">Blue</div>
            </div>
          </div>

          <div id="jazzCard" class="gestureCard">
            <div class="iconBadge">&#x1F450;</div>
            <div>
              <div class="gestureName">Jazz Hands</div>
              <div class="gestureColor">Yellow</div>
            </div>
          </div>

          <div id="openCard" class="gestureCard">
            <div class="iconBadge">&#x270B;</div>
            <div>
              <div class="gestureName">Open Palm</div>
              <div class="gestureColor">White</div>
            </div>
          </div>

          <div id="thumbCard" class="gestureCard">
            <div class="iconBadge">&#x1F44D;</div>
            <div>
              <div class="gestureName">Thumbs Up</div>
              <div class="gestureColor">Green</div>
            </div>
          </div>

          <div id="peaceCard" class="gestureCard">
            <div class="iconBadge">&#x270C;&#xFE0F;</div>
            <div>
              <div class="gestureName">Peace Sign</div>
              <div class="gestureColor">Purple</div>
            </div>
          </div>

          <div id="shakaCard" class="gestureCard">
            <div class="iconBadge">&#x1F919;</div>
            <div>
              <div class="gestureName">Shaka</div>
              <div class="gestureColor">Gradient</div>
            </div>
          </div>

          <div id="fistCard" class="gestureCard">
            <div class="iconBadge">&#x270A;</div>
            <div>
              <div class="gestureName">Hold Fist</div>
              <div class="gestureColor">Off</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script type="module">
    import {
      HandLandmarker,
      FilesetResolver
    } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

    const video = document.getElementById("video");
    const cameraPanel = document.getElementById("cameraPanel");
    const cameraOverlay = document.getElementById("cameraOverlay");
    const trackingCanvas = document.getElementById("trackingCanvas");
    const trackingContext = trackingCanvas.getContext("2d");
    const gestureText = document.getElementById("gesture");
    const lightResponse = document.getElementById("lightResponse");
    const sceneDot = document.getElementById("sceneDot");
    const startButton = document.getElementById("startButton");
    const stopButton = document.getElementById("stopButton");
    const triggerButton = document.getElementById("triggerButton");
    const statusText = document.getElementById("status");
    const bridgeStatus = document.getElementById("bridgeStatus");

    const TRIGGER_COOLDOWN_MS = 2500;
    const OFF_HOLD_MS = 750;
    const OFF_AFTER_GREEN_BLOCK_MS = 1200;
    const LUX_GREEN = "#76b843";

    const handConnections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17]
    ];

    let handLandmarker;
    let running = false;
    let previousAverageY = null;
    let previousAverageX = null;
    let cryingHoldUntil = 0;
    let inappropriateHoldUntil = 0;
    let lastRawGesture = "Unknown";
    let stableGesture = "Unknown";
    let stableGestureStartTime = performance.now();
    let gestureFrameCount = 0;
    let casambiTriggersEnabled = false;
    let lastTriggeredGesture = "Unknown";
    let lastTriggerTime = 0;

    async function setupHandTracking() {
      if (handLandmarker) {
        return;
      }

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
        },
        runningMode: "VIDEO",
        numHands: 2
      });
    }

    async function startCamera() {
      if (running) {
        return;
      }

      statusText.textContent = "Starting";
      await setupHandTracking();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user"
        },
        audio: false
      });

      video.srcObject = stream;
      running = true;
      cameraPanel.classList.remove("cameraOff");
      statusText.textContent = "Tracking";
      detectHands();
    }

    function stopCamera() {
      running = false;

      if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }

      previousAverageY = null;
      previousAverageX = null;
      cryingHoldUntil = 0;
      inappropriateHoldUntil = 0;
      lastRawGesture = "Unknown";
      stableGesture = "Unknown";
      stableGestureStartTime = performance.now();
      gestureFrameCount = 0;
      lastTriggeredGesture = "Unknown";

      clearTrackingOverlay();
      cameraPanel.classList.add("cameraOff");
      cameraOverlay.classList.remove("show");
      statusText.textContent = "Stopped";
      updateLightResponse("Unknown");
    }

    function toggleCasambiTriggers() {
      casambiTriggersEnabled = !casambiTriggersEnabled;

      if (casambiTriggersEnabled) {
        triggerButton.textContent = "Disable Casambi";
        triggerButton.classList.add("enabled");
        bridgeStatus.textContent = "Casambi Triggers: On";
      } else {
        triggerButton.textContent = "Enable Casambi";
        triggerButton.classList.remove("enabled");
        bridgeStatus.textContent = "Casambi Triggers: Off";
      }
    }

    function resizeTrackingCanvas() {
      const rect = trackingCanvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const width = Math.round(rect.width * scale);
      const height = Math.round(rect.height * scale);

      if (trackingCanvas.width !== width || trackingCanvas.height !== height) {
        trackingCanvas.width = width;
        trackingCanvas.height = height;
      }

      trackingContext.setTransform(scale, 0, 0, scale, 0, 0);

      return {
        width: rect.width,
        height: rect.height
      };
    }

    function clearTrackingOverlay() {
      const size = resizeTrackingCanvas();
      trackingContext.clearRect(0, 0, size.width, size.height);
    }

    function drawTrackingOverlay(results) {
      const size = resizeTrackingCanvas();

      trackingContext.clearRect(0, 0, size.width, size.height);

      if (!results.landmarks || results.landmarks.length === 0) {
        return;
      }

      for (const hand of results.landmarks) {
        drawHandConnections(hand, size.width, size.height);
        drawHandPoints(hand, size.width, size.height);
      }
    }

    function drawHandConnections(hand, width, height) {
      trackingContext.strokeStyle = LUX_GREEN;
      trackingContext.lineWidth = 4;
      trackingContext.lineCap = "round";
      trackingContext.lineJoin = "round";
      trackingContext.shadowColor = LUX_GREEN;
      trackingContext.shadowBlur = 8;

      for (const connection of handConnections) {
        const start = hand[connection[0]];
        const end = hand[connection[1]];

        trackingContext.beginPath();
        trackingContext.moveTo(start.x * width, start.y * height);
        trackingContext.lineTo(end.x * width, end.y * height);
        trackingContext.stroke();
      }

      trackingContext.shadowBlur = 0;
    }

    function drawHandPoints(hand, width, height) {
      for (let i = 0; i < hand.length; i++) {
        const point = hand[i];
        const radius = i === 4 || i === 8 || i === 12 || i === 16 || i === 20 ? 6 : 4;

        trackingContext.beginPath();
        trackingContext.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2);
        trackingContext.fillStyle = LUX_GREEN;
        trackingContext.fill();

        trackingContext.beginPath();
        trackingContext.arc(point.x * width, point.y * height, radius + 3, 0, Math.PI * 2);
        trackingContext.strokeStyle = "rgba(118, 184, 67, 0.45)";
        trackingContext.lineWidth = 2;
        trackingContext.stroke();
      }
    }

    function fingerIsUp(hand, tip, pip) {
      return hand[tip].y < hand[pip].y;
    }

    function fingerIsDown(hand, tip, pip) {
      return hand[tip].y > hand[pip].y;
    }

    function distance(pointA, pointB) {
      const dx = pointA.x - pointB.x;
      const dy = pointA.y - pointB.y;

      return Math.sqrt(dx * dx + dy * dy);
    }

    function getHandCenter(hand, axis) {
      let total = 0;

      for (let i = 0; i < hand.length; i++) {
        total += hand[i][axis];
      }

      return total / hand.length;
    }

    function foldedFingerCount(hand) {
      const fingers = [
        { tip: 8, pip: 6, mcp: 5 },
        { tip: 12, pip: 10, mcp: 9 },
        { tip: 16, pip: 14, mcp: 13 },
        { tip: 20, pip: 18, mcp: 17 }
      ];

      let count = 0;

      for (const finger of fingers) {
        const tip = hand[finger.tip];
        const pip = hand[finger.pip];
        const mcp = hand[finger.mcp];

        const foldedByY = tip.y > pip.y - 0.04;
        const closeToPalm = distance(tip, mcp) < 0.12;

        if (foldedByY || closeToPalm) {
          count += 1;
        }
      }

      return count;
    }

    function fingersAreMostlyFolded(hand) {
      return foldedFingerCount(hand) >= 3;
    }

    function fingersAreFolded(hand) {
      return foldedFingerCount(hand) >= 4;
    }

    function closedHandForBlue(hand) {
      return fingersAreMostlyFolded(hand);
    }

    function detectThumbsUp(hand) {
      const thumbTip = hand[4];
      const thumbIp = hand[3];
      const thumbMcp = hand[2];
      const indexMcp = hand[5];
      const middleMcp = hand[9];
      const indexTip = hand[8];
      const middleTip = hand[12];

      const fingersFolded = fingersAreMostlyFolded(hand);

      const thumbClearlyAboveHand =
        thumbTip.y < thumbIp.y - 0.005 &&
        thumbTip.y < thumbMcp.y - 0.015 &&
        thumbTip.y < indexMcp.y - 0.02 &&
        thumbTip.y < middleMcp.y - 0.02;

      const thumbAboveFoldedFingers =
        thumbTip.y < indexTip.y - 0.025 &&
        thumbTip.y < middleTip.y - 0.025;

      const thumbExtended =
        distance(thumbTip, thumbMcp) > 0.07;

      const thumbMoreVerticalThanSideways =
        Math.abs(thumbTip.y - thumbMcp.y) > Math.abs(thumbTip.x - thumbMcp.x) * 0.35;

      const thumbNotTuckedAcrossFist =
        distance(thumbTip, hand[6]) > 0.055 &&
        distance(thumbTip, hand[10]) > 0.055;

      return (
        fingersFolded &&
        thumbClearlyAboveHand &&
        thumbAboveFoldedFingers &&
        thumbExtended &&
        thumbMoreVerticalThanSideways &&
        thumbNotTuckedAcrossFist
      );
    }

    function thumbLooksOut(hand) {
      return distance(hand[4], hand[2]) > 0.08;
    }

    function detectFist(hand) {
      return fingersAreMostlyFolded(hand) && !detectThumbsUp(hand) && !detectShaka(hand);
    }

    function detectPeaceSign(hand) {
      const indexUp = fingerIsUp(hand, 8, 6);
      const middleUp = fingerIsUp(hand, 12, 10);
      const ringDown = fingerIsDown(hand, 16, 14);
      const pinkyDown = fingerIsDown(hand, 20, 18);
      const indexMiddleSpread = distance(hand[8], hand[12]) > 0.06;

      return indexUp && middleUp && ringDown && pinkyDown && indexMiddleSpread;
    }

    function detectShaka(hand) {
      const pinkyUp = fingerIsUp(hand, 20, 18);
      const indexDown = fingerIsDown(hand, 8, 6);
      const middleDown = fingerIsDown(hand, 12, 10);
      const ringDown = fingerIsDown(hand, 16, 14);
      const thumbOut = thumbLooksOut(hand);

      return pinkyUp && thumbOut && indexDown && middleDown && ringDown;
    }

    function detectInappropriateGesture(hand) {
      const middleUp = fingerIsUp(hand, 12, 10);
      const indexDown = fingerIsDown(hand, 8, 6);
      const ringDown = fingerIsDown(hand, 16, 14);
      const pinkyDown = fingerIsDown(hand, 20, 18);
      const middleAboveIndex = hand[12].y < hand[8].y - 0.04;
      const middleAboveRing = hand[12].y < hand[16].y - 0.04;

      return middleUp && indexDown && ringDown && pinkyDown && middleAboveIndex && middleAboveRing;
    }

    function classifyHand(hand) {
      if (detectInappropriateGesture(hand)) {
        return "Inappropriate";
      }

      if (detectShaka(hand)) {
        return "Shaka";
      }

      if (detectThumbsUp(hand)) {
        return "Thumbs Up";
      }

      const fingersUp = [
        fingerIsUp(hand, 8, 6),
        fingerIsUp(hand, 12, 10),
        fingerIsUp(hand, 16, 14),
        fingerIsUp(hand, 20, 18)
      ].filter(Boolean).length;

      if (fingersUp >= 4) {
        return "Open palm";
      }

      if (detectFist(hand)) {
        return "Fist";
      }

      return "Unknown";
    }

    function detectHeart(hand1, hand2) {
      const indexTipsClose = distance(hand1[8], hand2[8]) < 0.18;
      const thumbsClose = distance(hand1[4], hand2[4]) < 0.18;
      const indexThumbShapeLeft = distance(hand1[8], hand1[4]) < 0.22;
      const indexThumbShapeRight = distance(hand2[8], hand2[4]) < 0.22;
      const handsNearEachOther = distance(hand1[9], hand2[9]) < 0.42;

      return indexTipsClose && thumbsClose && indexThumbShapeLeft && indexThumbShapeRight && handsNearEachOther;
    }

    function bothHandsAreClosedForBlue(hand1, hand2) {
      return closedHandForBlue(hand1) && closedHandForBlue(hand2);
    }

    function detectCryingMotion(hand1, hand2) {
      const now = performance.now();

      if (now < cryingHoldUntil) {
        return true;
      }

      const averageY = (getHandCenter(hand1, "y") + getHandCenter(hand2, "y")) / 2;
      const averageX = (getHandCenter(hand1, "x") + getHandCenter(hand2, "x")) / 2;

      const bothHandsOpen =
        classifyHand(hand1) === "Open palm" &&
        classifyHand(hand2) === "Open palm";

      let detected = false;

      if (previousAverageY !== null && previousAverageX !== null) {
        const movedDown = averageY - previousAverageY > 0.008;
        const movedSide = Math.abs(averageX - previousAverageX) > 0.012;
        const handsNearFace = averageY < 0.75;

        if (handsNearFace && !bothHandsOpen && (movedDown || movedSide)) {
          detected = true;
          cryingHoldUntil = now + 1200;
        }
      }

      previousAverageY = averageY;
      previousAverageX = averageX;

      return detected;
    }

    function showAppropriateGesturePrompt() {
      inappropriateHoldUntil = performance.now() + 1800;
      cameraOverlay.classList.add("show");
    }

    function updateAppropriateGesturePrompt() {
      if (performance.now() > inappropriateHoldUntil) {
        cameraOverlay.classList.remove("show");
      }
    }

    function classifyGesture(results) {
      if (!results.landmarks || results.landmarks.length === 0) {
        previousAverageY = null;
        previousAverageX = null;
        return "Unknown";
      }

      if (results.landmarks.length >= 2) {
        const hand1 = results.landmarks[0];
        const hand2 = results.landmarks[1];

        if (detectHeart(hand1, hand2)) {
          return "Heart";
        }

        if (bothHandsAreClosedForBlue(hand1, hand2)) {
          return "Crying";
        }
      }

      const handTypes = results.landmarks.map(hand => classifyHand(hand));

      if (handTypes.includes("Inappropriate")) {
        showAppropriateGesturePrompt();
        return "Unknown";
      }

      if (handTypes.includes("Shaka")) {
        return "Shaka";
      }

      if (results.landmarks.length >= 2) {
        const hand1 = results.landmarks[0];
        const hand2 = results.landmarks[1];

        const hand1Type = handTypes[0];
        const hand2Type = handTypes[1];

        if (hand1Type === "Thumbs Up" || hand2Type === "Thumbs Up") {
          return "Thumbs Up";
        }

        if (detectCryingMotion(hand1, hand2)) {
          return "Crying";
        }

        if (detectPeaceSign(hand1) || detectPeaceSign(hand2)) {
          return "Peace Sign";
        }

        if (hand1Type === "Open palm" && hand2Type === "Open palm") {
          return "Jazz hands";
        }

        return "Unknown";
      }

      const hand = results.landmarks[0];
      const handType = handTypes[0];

      if (handType === "Thumbs Up") {
        return "Thumbs Up";
      }

      if (detectPeaceSign(hand)) {
        return "Peace Sign";
      }

      if (handType === "Fist") {
        return "Fist";
      }

      return handType;
    }

    function stabilizeGesture(rawGesture) {
      if (rawGesture === lastRawGesture) {
        gestureFrameCount += 1;
      } else {
        lastRawGesture = rawGesture;
        gestureFrameCount = 1;
      }

      let framesNeeded = 4;

      if (rawGesture === "Unknown") {
        framesNeeded = 8;
      }

      if (rawGesture === "Heart") {
        framesNeeded = 2;
      }

      if (rawGesture === "Crying") {
        framesNeeded = 1;
      }

      if (rawGesture === "Thumbs Up") {
        framesNeeded = 2;
      }

      if (rawGesture === "Shaka") {
        framesNeeded = 3;
      }

      if (rawGesture === "Fist") {
        framesNeeded = 3;
      }

      if (rawGesture === "Fist" && stableGesture === "Thumbs Up") {
        framesNeeded = 4;
      }

      if (rawGesture === "Fist" && stableGesture === "Crying") {
        framesNeeded = 5;
      }

      if (gestureFrameCount >= framesNeeded && stableGesture !== rawGesture) {
        stableGesture = rawGesture;
        stableGestureStartTime = performance.now();
      }

      return stableGesture;
    }

    function clearActiveCards() {
      document.querySelectorAll(".gestureCard").forEach(card => {
        card.classList.remove("active");
      });
    }

    function clearGradientPreview() {
      document.querySelectorAll(".channel").forEach(channel => {
        channel.classList.remove("gradientPreview");
      });
    }

    function setRGBW(r, g, b, w) {
      clearGradientPreview();

      const values = {
        r: r,
        g: g,
        b: b,
        w: w
      };

      for (const [channelName, value] of Object.entries(values)) {
        const channel = document.getElementById(channelName + "Channel");
        const valueText = document.getElementById(channelName + "Value");

        valueText.textContent = value + "%";
        channel.classList.toggle("active", value > 0);
      }
    }

    function setGradientPreview() {
      const channels = ["r", "g", "b", "w"];

      for (const channelName of channels) {
        const channel = document.getElementById(channelName + "Channel");
        const valueText = document.getElementById(channelName + "Value");

        channel.classList.remove("active");
        channel.classList.add("gradientPreview");
        valueText.textContent = "Cycle";
      }
    }

    function getKeyForGesture(gesture) {
      const keys = {
        Heart: "r",
        Crying: "b",
        "Jazz hands": "y",
        "Open palm": "w",
        "Thumbs Up": "g",
        "Peace Sign": "p",
        Fist: "o",
        Shaka: "x"
      };

      return keys[gesture] || "";
    }

    function offGestureIsAllowed(now) {
      const stableTime = performance.now() - stableGestureStartTime;
      const recentlySentGreen =
        lastTriggeredGesture === "Thumbs Up" &&
        now - lastTriggerTime < OFF_AFTER_GREEN_BLOCK_MS;

      const recentlySentBlue =
        lastTriggeredGesture === "Crying" &&
        now - lastTriggerTime < 900;

      return stableTime >= OFF_HOLD_MS && !recentlySentGreen && !recentlySentBlue;
    }

    async function sendCasambiKey(key) {
      const response = await fetch("/control?key=" + key);
      return response.json();
    }

    async function triggerCasambiForGesture(gesture) {
      if (!casambiTriggersEnabled || gesture === "Unknown") {
        return;
      }

      const now = Date.now();
      const key = getKeyForGesture(gesture);

      if (!key) {
        return;
      }

      if (gesture === "Fist" && !offGestureIsAllowed(now)) {
        bridgeStatus.textContent = "Hold one fist to send Off";
        return;
      }

      if (gesture === lastTriggeredGesture && now - lastTriggerTime < TRIGGER_COOLDOWN_MS) {
        return;
      }

      lastTriggeredGesture = gesture;
      lastTriggerTime = now;

      try {
        const data = await sendCasambiKey(key);

        bridgeStatus.textContent = data.ok
          ? "Sent to Casambi: " + data.scene
          : "Bridge Error: " + data.error;
      } catch (error) {
        bridgeStatus.textContent = "Bridge Error: " + error.message;
      }
    }

    function updateLightResponse(gesture) {
      clearActiveCards();
      sceneDot.classList.remove("gradient");

      const scenes = {
        Heart: {
          label: "Heart",
          light: "Red",
          dot: "red",
          card: "heartCard",
          rgbw: [100, 0, 0, 0]
        },
        Crying: {
          label: "Crying",
          light: "Blue",
          dot: "#1d6cff",
          card: "cryingCard",
          rgbw: [0, 0, 100, 0]
        },
        "Jazz hands": {
          label: "Jazz Hands",
          light: "Yellow",
          dot: "yellow",
          card: "jazzCard",
          rgbw: [100, 100, 0, 0]
        },
        "Open palm": {
          label: "Open Palm",
          light: "White",
          dot: "white",
          card: "openCard",
          rgbw: [0, 0, 0, 100]
        },
        "Thumbs Up": {
          label: "Thumbs Up",
          light: "Green",
          dot: "#76b843",
          card: "thumbCard",
          rgbw: [0, 100, 0, 0]
        },
        "Peace Sign": {
          label: "Peace Sign",
          light: "Purple",
          dot: "purple",
          card: "peaceCard",
          rgbw: [100, 0, 100, 0]
        },
        Fist: {
          label: "Fist",
          light: "Off",
          dot: "#333",
          card: "fistCard",
          rgbw: [0, 0, 0, 0]
        },
        Shaka: {
          label: "Shaka",
          light: "Gradient",
          dot: "gradient",
          card: "shakaCard"
        }
      };

      const scene = scenes[gesture];

      if (!scene) {
        gestureText.textContent = "Unknown";
        lightResponse.textContent = "None";
        sceneDot.style.background = "gray";
        setRGBW(0, 0, 0, 0);
        return;
      }

      gestureText.textContent = scene.label;
      lightResponse.textContent = scene.light;
      document.getElementById(scene.card).classList.add("active");

      if (gesture === "Shaka") {
        sceneDot.style.background = "";
        sceneDot.classList.add("gradient");
        setGradientPreview();
        return;
      }

      sceneDot.style.background = scene.dot;
      setRGBW(...scene.rgbw);
    }

    async function detectHands() {
      if (!running) {
        return;
      }

      updateAppropriateGesturePrompt();

      if (video.readyState >= 2) {
        const results = handLandmarker.detectForVideo(video, performance.now());

        drawTrackingOverlay(results);

        const rawGesture = classifyGesture(results);
        const gesture = stabilizeGesture(rawGesture);

        updateLightResponse(gesture);
        triggerCasambiForGesture(gesture);
      }

      requestAnimationFrame(detectHands);
    }

    startButton.addEventListener("click", startCamera);
    stopButton.addEventListener("click", stopCamera);
    triggerButton.addEventListener("click", toggleCasambiTriggers);
  </script>
</body>
</html>
`;
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost:" + PORT);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });

    response.end();
    return;
  }

  if (url.pathname === "/logo.jpg") {
    const logoPath = path.join(__dirname, "logo.jpg");

    if (!fs.existsSync(logoPath)) {
      response.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      response.end("logo.jpg not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-cache"
    });

    fs.createReadStream(logoPath).pipe(response);
    return;
  }

  if (url.pathname === "/") {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });

    response.end(getGesturePageHtml());
    return;
  }

  if (url.pathname === "/control") {
    const key = (url.searchParams.get("key") || "").toLowerCase();
    sendKeyToCasambi(key, response);
    return;
  }

  response.writeHead(404, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });

  response.end(JSON.stringify({
    ok: false,
    error: "Route not found"
  }));
});

server.listen(PORT, () => {
  console.log("HueMotion running at:");
  console.log("http://localhost:" + PORT);
});