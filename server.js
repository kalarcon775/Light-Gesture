const http = require("http");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const PORT = 3000;

const allowedKeys = new Set(["r", "g", "b", "y", "w", "p", "o"]);

const sceneNames = {
  r: "Red",
  g: "Green",
  b: "Blue",
  y: "Yellow",
  w: "White",
  p: "Purple",
  o: "Off"
};

function getAutoHotkeyPath() {
  const possiblePaths = [
    "C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey64.exe",
    "C:\\Program Files\\AutoHotkey\\AutoHotkey64.exe",
    "C:\\Program Files (x86)\\AutoHotkey\\AutoHotkey.exe"
  ];

  for (const ahkPath of possiblePaths) {
    if (fs.existsSync(ahkPath)) {
      return ahkPath;
    }
  }

  return "AutoHotkey64.exe";
}

function sendKeyToESA2(key, response) {
  if (!allowedKeys.has(key)) {
    response.writeHead(400, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    });

    response.end(JSON.stringify({
      ok: false,
      error: "Invalid key"
    }));

    return;
  }

  const ahkPath = getAutoHotkeyPath();
  const scriptPath = path.join(__dirname, "send_key.ahk");

  const child = spawn(ahkPath, [scriptPath, key], {
    windowsHide: true
  });

  child.on("error", (error) => {
    response.writeHead(500, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    });

    response.end(JSON.stringify({
      ok: false,
      error: error.message
    }));
  });

  child.on("close", () => {
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    });

    response.end(JSON.stringify({
      ok: true,
      key: key,
      scene: sceneNames[key]
    }));

    console.log(`Sent key ${key.toUpperCase()} for ${sceneNames[key]}`);
  });
}

function getGesturePageHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LUX Gesture Demo</title>

  <style>
    body {
      font-family: Arial, sans-serif;
      background: #050505;
      color: white;
      margin: 0;
      padding: 20px;
    }

    .page {
      max-width: 1200px;
      margin: auto;
    }

    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 25px;
      gap: 20px;
    }

    .logoWrap {
      width: 260px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }

    .logo {
      max-width: 100%;
      max-height: 90px;
      object-fit: contain;
      display: block;
    }

    .titleBox {
      text-align: center;
      flex: 1;
    }

    h1 {
      font-size: 38px;
      margin: 0;
      letter-spacing: 1px;
    }

    .subtitle {
      color: #bfbfbf;
      font-size: 18px;
      margin-top: 8px;
    }

    .greenLine {
      width: 80px;
      height: 3px;
      background: #76b843;
      margin: 12px auto 0;
    }

    .statusTop {
      color: #d6d6d6;
      font-size: 16px;
      min-width: 160px;
      text-align: right;
    }

    .dot {
      display: inline-block;
      width: 11px;
      height: 11px;
      background: #76b843;
      border-radius: 50%;
      margin-right: 8px;
    }

    .mainGrid {
      display: grid;
      grid-template-columns: 1.35fr 1fr;
      gap: 20px;
    }

    .panel {
      background: #101010;
      border: 1px solid #333;
      border-radius: 14px;
      padding: 18px;
      box-shadow: 0 0 20px rgba(118, 184, 67, 0.08);
    }

    .panelLabel {
      color: #76b843;
      font-weight: bold;
      letter-spacing: 1px;
      margin-bottom: 12px;
      font-size: 14px;
    }

    video {
      width: 100%;
      border-radius: 12px;
      border: 2px solid #333;
      transform: scaleX(-1);
      background: #000;
    }

    .buttonRow {
      display: flex;
      gap: 12px;
      margin-top: 15px;
      flex-wrap: wrap;
    }

    button {
      font-size: 20px;
      padding: 12px 24px;
      background: #76b843;
      color: black;
      border: none;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
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

    .infoCard {
      background: #151515;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 22px;
      margin-bottom: 16px;
    }

    .smallLabel {
      color: #a7a7a7;
      font-size: 13px;
      font-weight: bold;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    #gesture {
      font-size: 34px;
      font-weight: bold;
    }

    #lightResponse {
      font-size: 34px;
      font-weight: bold;
    }

    #status {
      font-size: 34px;
      font-weight: bold;
    }

    #bridgeStatus {
      font-size: 21px;
      color: #d6d6d6;
      margin-top: 8px;
    }

    .sceneDot {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: gray;
      margin-top: 12px;
      border: 2px solid #555;
    }

    .gestureSection {
      margin-top: 22px;
    }

    .gestureGrid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 14px;
    }

    .gestureCard {
      background: #101010;
      border: 1px solid #333;
      border-radius: 14px;
      padding: 18px 10px;
      text-align: center;
      min-height: 130px;
    }

    .gestureCard.active {
      border: 2px solid #76b843;
      box-shadow: 0 0 16px rgba(118, 184, 67, 0.35);
    }

    .iconBadge {
      width: 58px;
      height: 58px;
      margin: 0 auto 12px;
      border-radius: 50%;
      background: #181818;
      border: 1px solid #3a3a3a;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 34px;
      font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
    }

    .gestureCard.active .iconBadge {
      border-color: #76b843;
      box-shadow: 0 0 12px rgba(118, 184, 67, 0.45);
      background: #202820;
    }

    .gestureName {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .gestureColor {
      color: #cfcfcf;
      font-size: 15px;
    }

    .outputSection {
      margin-top: 22px;
    }

    .rgbwGrid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
    }

    .channel {
      border-radius: 12px;
      padding: 22px;
      text-align: center;
      border: 1px solid #333;
      background: #111;
    }

    .channelLetter {
      font-size: 30px;
      font-weight: bold;
    }

    .channelName {
      font-size: 13px;
      color: #bfbfbf;
      margin-top: 6px;
    }

    .channelValue {
      font-size: 18px;
      margin-top: 8px;
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

    .footer {
      text-align: center;
      color: #999;
      font-size: 14px;
      margin-top: 25px;
      line-height: 1.8;
      padding-bottom: 10px;
    }

    .footerMain {
      font-size: 15px;
      color: #bdbdbd;
    }

    .footerDev {
      font-size: 16px;
      color: #ffffff;
      font-weight: bold;
    }

    @media (max-width: 900px) {
      .top {
        flex-direction: column;
        gap: 15px;
      }

      .logoWrap {
        width: 220px;
        justify-content: center;
      }

      .statusTop {
        text-align: center;
      }

      .mainGrid {
        grid-template-columns: 1fr;
      }

      .gestureGrid {
        grid-template-columns: 1fr 1fr;
      }

      .rgbwGrid {
        grid-template-columns: 1fr 1fr;
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
        <h1>LUX Gesture Demo</h1>
        <div class="subtitle">Gesture Controlled RGBW Lighting</div>
        <div class="greenLine"></div>
      </div>

      <div class="statusTop">
        <span class="dot"></span>System Ready
      </div>
    </div>

    <div class="mainGrid">
      <div class="panel">
        <div class="panelLabel"><span class="dot"></span>LIVE CAMERA</div>
        <video id="video" autoplay playsinline></video>

        <div class="buttonRow">
          <button id="startButton">Start Camera</button>
          <button id="stopButton">Stop Camera</button>
          <button id="triggerButton">Enable DMX Triggers</button>
        </div>
      </div>

      <div>
        <div class="infoCard">
          <div class="smallLabel">DETECTED GESTURE</div>
          <div id="gesture">Unknown</div>
        </div>

        <div class="infoCard">
          <div class="smallLabel">LIGHTING SCENE</div>
          <div id="lightResponse">None</div>
          <div id="sceneDot" class="sceneDot"></div>
        </div>

        <div class="infoCard">
          <div class="smallLabel">STATUS</div>
          <div id="status">Waiting</div>
          <div id="bridgeStatus">DMX Triggers: Off</div>
        </div>
      </div>
    </div>

    <div class="gestureSection">
      <div class="panelLabel">GESTURE CONTROLS</div>

      <div class="gestureGrid">
        <div id="heartCard" class="gestureCard">
          <div class="iconBadge">&#x1FAF6;</div>
          <div class="gestureName">Heart</div>
          <div class="gestureColor">Red</div>
        </div>

        <div id="cryingCard" class="gestureCard">
          <div class="iconBadge">&#x1F622;</div>
          <div class="gestureName">Crying</div>
          <div class="gestureColor">Blue</div>
        </div>

        <div id="jazzCard" class="gestureCard">
          <div class="iconBadge">&#x1F450;</div>
          <div class="gestureName">Jazz Hands</div>
          <div class="gestureColor">Yellow</div>
        </div>

        <div id="openCard" class="gestureCard">
          <div class="iconBadge">&#x270B;</div>
          <div class="gestureName">Open Palm</div>
          <div class="gestureColor">White</div>
        </div>

        <div id="thumbCard" class="gestureCard">
          <div class="iconBadge">&#x1F44D;</div>
          <div class="gestureName">Thumbs Up</div>
          <div class="gestureColor">Green</div>
        </div>

        <div id="peaceCard" class="gestureCard">
          <div class="iconBadge">&#x270C;&#xFE0F;</div>
          <div class="gestureName">Peace Sign</div>
          <div class="gestureColor">Purple</div>
        </div>

        <div id="fistCard" class="gestureCard">
          <div class="iconBadge">&#x270A;</div>
          <div class="gestureName">Fist</div>
          <div class="gestureColor">Off</div>
        </div>
      </div>
    </div>

    <div class="outputSection">
      <div class="panelLabel">RGBW OUTPUT PREVIEW</div>

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

    <div class="footer">
      <div class="footerMain">LUX Dynamics | Intelligent Lighting | Natural Interaction</div>
      <div class="footerDev">Developed By Kailani Puava Alarcon</div>
    </div>
  </div>

  <script type="module">
    import {
      HandLandmarker,
      FilesetResolver
    } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

    const video = document.getElementById("video");
    const gestureText = document.getElementById("gesture");
    const lightResponse = document.getElementById("lightResponse");
    const sceneDot = document.getElementById("sceneDot");
    const startButton = document.getElementById("startButton");
    const stopButton = document.getElementById("stopButton");
    const triggerButton = document.getElementById("triggerButton");
    const statusText = document.getElementById("status");
    const bridgeStatus = document.getElementById("bridgeStatus");

    let handLandmarker;
    let running = false;

    let previousAverageY = null;
    let previousAverageX = null;
    let cryingHoldUntil = 0;

    let lastRawGesture = "Unknown";
    let stableGesture = "Unknown";
    let gestureFrameCount = 0;

    let dmxTriggersEnabled = false;
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
      statusText.textContent = "Tracking";
      detectHands();
    }

    function stopCamera() {
      running = false;

      if (video.srcObject) {
        const tracks = video.srcObject.getTracks();

        tracks.forEach(track => {
          track.stop();
        });

        video.srcObject = null;
      }

      previousAverageY = null;
      previousAverageX = null;
      cryingHoldUntil = 0;

      lastRawGesture = "Unknown";
      stableGesture = "Unknown";
      gestureFrameCount = 0;
      lastTriggeredGesture = "Unknown";

      statusText.textContent = "Stopped";
      updateLightResponse("Unknown");
    }

    function toggleDmxTriggers() {
      dmxTriggersEnabled = !dmxTriggersEnabled;

      if (dmxTriggersEnabled) {
        triggerButton.textContent = "Disable DMX Triggers";
        triggerButton.classList.add("enabled");
        bridgeStatus.textContent = "DMX Triggers: On";
      } else {
        triggerButton.textContent = "Enable DMX Triggers";
        triggerButton.classList.remove("enabled");
        bridgeStatus.textContent = "DMX Triggers: Off";
      }
    }

    function fingerIsUp(landmarks, tip, pip) {
      return landmarks[tip].y < landmarks[pip].y;
    }

    function fingerIsDown(landmarks, tip, pip) {
      return landmarks[tip].y > landmarks[pip].y;
    }

    function distance(pointA, pointB) {
      const dx = pointA.x - pointB.x;
      const dy = pointA.y - pointB.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function getHandCenterY(landmarks) {
      let total = 0;

      for (let i = 0; i < landmarks.length; i++) {
        total += landmarks[i].y;
      }

      return total / landmarks.length;
    }

    function getHandCenterX(landmarks) {
      let total = 0;

      for (let i = 0; i < landmarks.length; i++) {
        total += landmarks[i].x;
      }

      return total / landmarks.length;
    }

    function detectThumbsUp(hand) {
      const thumbTip = hand[4];
      const thumbIp = hand[3];
      const thumbMcp = hand[2];
      const indexMcp = hand[5];
      const middleMcp = hand[9];
      const wrist = hand[0];

      const indexDown = fingerIsDown(hand, 8, 6);
      const middleDown = fingerIsDown(hand, 12, 10);
      const ringDown = fingerIsDown(hand, 16, 14);
      const pinkyDown = fingerIsDown(hand, 20, 18);

      const fingersFolded =
        indexDown &&
        middleDown &&
        ringDown &&
        pinkyDown;

      const thumbClearlyRaised =
        thumbTip.y < thumbIp.y - 0.02 &&
        thumbTip.y < thumbMcp.y - 0.035 &&
        thumbTip.y < indexMcp.y - 0.04 &&
        thumbTip.y < middleMcp.y - 0.04;

      const thumbExtended =
        distance(thumbTip, thumbMcp) > 0.10;

      const handMostlyUpright =
        wrist.y > middleMcp.y;

      return fingersFolded && thumbClearlyRaised && thumbExtended && handMostlyUpright;
    }

    function detectFist(hand) {
      const indexDown = fingerIsDown(hand, 8, 6);
      const middleDown = fingerIsDown(hand, 12, 10);
      const ringDown = fingerIsDown(hand, 16, 14);
      const pinkyDown = fingerIsDown(hand, 20, 18);

      const allFingersFolded =
        indexDown &&
        middleDown &&
        ringDown &&
        pinkyDown;

      return allFingersFolded && !detectThumbsUp(hand);
    }

    function classifyHand(landmarks) {
      const indexUp = fingerIsUp(landmarks, 8, 6);
      const middleUp = fingerIsUp(landmarks, 12, 10);
      const ringUp = fingerIsUp(landmarks, 16, 14);
      const pinkyUp = fingerIsUp(landmarks, 20, 18);

      const fingersUp = [indexUp, middleUp, ringUp, pinkyUp]
        .filter(Boolean).length;

      if (fingersUp >= 4) {
        return "Open palm";
      }

      if (detectFist(landmarks)) {
        return "Fist";
      }

      return "Unknown";
    }

    function detectPeaceSign(hand) {
      const indexUp = fingerIsUp(hand, 8, 6);
      const middleUp = fingerIsUp(hand, 12, 10);
      const ringDown = fingerIsDown(hand, 16, 14);
      const pinkyDown = fingerIsDown(hand, 20, 18);
      const indexMiddleSpread = distance(hand[8], hand[12]) > 0.06;

      return indexUp && middleUp && ringDown && pinkyDown && indexMiddleSpread;
    }

    function detectHeart(hand1, hand2) {
      const indexTipsClose = distance(hand1[8], hand2[8]) < 0.12;
      const thumbsClose = distance(hand1[4], hand2[4]) < 0.12;

      return indexTipsClose && thumbsClose;
    }

    function detectCrying(hand1, hand2) {
      const now = performance.now();

      if (now < cryingHoldUntil) {
        return true;
      }

      const hand1Y = getHandCenterY(hand1);
      const hand2Y = getHandCenterY(hand2);
      const averageY = (hand1Y + hand2Y) / 2;

      const hand1X = getHandCenterX(hand1);
      const hand2X = getHandCenterX(hand2);
      const averageX = (hand1X + hand2X) / 2;

      const firstHand = classifyHand(hand1);
      const secondHand = classifyHand(hand2);

      const bothHandsOpen =
        firstHand === "Open palm" && secondHand === "Open palm";

      let cryingDetected = false;

      if (previousAverageY !== null && previousAverageX !== null) {
        const movedDown = averageY - previousAverageY > 0.008;
        const movedSide = Math.abs(averageX - previousAverageX) > 0.012;
        const handsNearFace = averageY < 0.75;

        if (handsNearFace && !bothHandsOpen && (movedDown || movedSide)) {
          cryingDetected = true;
          cryingHoldUntil = now + 1200;
        }
      }

      previousAverageY = averageY;
      previousAverageX = averageX;

      return cryingDetected;
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

        if (detectCrying(hand1, hand2)) {
          return "Crying";
        }

        if (detectThumbsUp(hand1) || detectThumbsUp(hand2)) {
          return "Thumbs Up";
        }

        if (detectPeaceSign(hand1) || detectPeaceSign(hand2)) {
          return "Peace Sign";
        }

        const firstHand = classifyHand(hand1);
        const secondHand = classifyHand(hand2);

        if (firstHand === "Open palm" && secondHand === "Open palm") {
          return "Jazz hands";
        }

        if (firstHand === "Fist" && secondHand === "Fist") {
          return "Fist";
        }
      }

      const hand = results.landmarks[0];

      if (detectThumbsUp(hand)) {
        return "Thumbs Up";
      }

      if (detectPeaceSign(hand)) {
        return "Peace Sign";
      }

      return classifyHand(hand);
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

      if (rawGesture === "Crying") {
        framesNeeded = 2;
      }

      if (gestureFrameCount >= framesNeeded) {
        stableGesture = rawGesture;
      }

      return stableGesture;
    }

    function clearActiveCards() {
      const cards = document.querySelectorAll(".gestureCard");

      cards.forEach(card => {
        card.classList.remove("active");
      });
    }

    function setRGBW(r, g, b, w) {
      const values = [
        ["r", r],
        ["g", g],
        ["b", b],
        ["w", w]
      ];

      values.forEach(item => {
        const channel = document.getElementById(item[0] + "Channel");
        const value = document.getElementById(item[0] + "Value");

        value.textContent = item[1] + "%";

        if (item[1] > 0) {
          channel.classList.add("active");
        } else {
          channel.classList.remove("active");
        }
      });
    }

    function getKeyForGesture(gesture) {
      if (gesture === "Heart") {
        return "r";
      }

      if (gesture === "Crying") {
        return "b";
      }

      if (gesture === "Jazz hands") {
        return "y";
      }

      if (gesture === "Open palm") {
        return "w";
      }

      if (gesture === "Thumbs Up") {
        return "g";
      }

      if (gesture === "Peace Sign") {
        return "p";
      }

      if (gesture === "Fist") {
        return "o";
      }

      return "";
    }

    async function triggerDmxForGesture(gesture) {
      if (!dmxTriggersEnabled) {
        return;
      }

      if (gesture === "Unknown") {
        return;
      }

      const now = Date.now();
      const key = getKeyForGesture(gesture);

      if (key === "") {
        return;
      }

      if (gesture === lastTriggeredGesture && now - lastTriggerTime < 3500) {
        return;
      }

      lastTriggeredGesture = gesture;
      lastTriggerTime = now;

      try {
        const response = await fetch("/control?key=" + key);
        const data = await response.json();

        if (data.ok) {
          bridgeStatus.textContent = "Sent to ESA2: " + data.scene;
        } else {
          bridgeStatus.textContent = "Bridge Error: " + data.error;
        }
      } catch (error) {
        bridgeStatus.textContent = "Bridge Error: " + error.message;
      }
    }

    function updateLightResponse(gesture) {
      clearActiveCards();

      if (gesture === "Heart") {
        gestureText.textContent = "Heart";
        lightResponse.textContent = "Red";
        sceneDot.style.background = "red";
        document.getElementById("heartCard").classList.add("active");
        setRGBW(100, 0, 0, 0);

      } else if (gesture === "Crying") {
        gestureText.textContent = "Crying";
        lightResponse.textContent = "Blue";
        sceneDot.style.background = "#1d6cff";
        document.getElementById("cryingCard").classList.add("active");
        setRGBW(0, 0, 100, 0);

      } else if (gesture === "Jazz hands") {
        gestureText.textContent = "Jazz Hands";
        lightResponse.textContent = "Yellow";
        sceneDot.style.background = "yellow";
        document.getElementById("jazzCard").classList.add("active");
        setRGBW(100, 100, 0, 0);

      } else if (gesture === "Open palm") {
        gestureText.textContent = "Open Palm";
        lightResponse.textContent = "White";
        sceneDot.style.background = "white";
        document.getElementById("openCard").classList.add("active");
        setRGBW(0, 0, 0, 100);

      } else if (gesture === "Thumbs Up") {
        gestureText.textContent = "Thumbs Up";
        lightResponse.textContent = "Green";
        sceneDot.style.background = "#76b843";
        document.getElementById("thumbCard").classList.add("active");
        setRGBW(0, 100, 0, 0);

      } else if (gesture === "Peace Sign") {
        gestureText.textContent = "Peace Sign";
        lightResponse.textContent = "Purple";
        sceneDot.style.background = "purple";
        document.getElementById("peaceCard").classList.add("active");
        setRGBW(100, 0, 100, 0);

      } else if (gesture === "Fist") {
        gestureText.textContent = "Fist";
        lightResponse.textContent = "Off";
        sceneDot.style.background = "#333";
        document.getElementById("fistCard").classList.add("active");
        setRGBW(0, 0, 0, 0);

      } else {
        gestureText.textContent = "Unknown";
        lightResponse.textContent = "None";
        sceneDot.style.background = "gray";
        setRGBW(0, 0, 0, 0);
      }
    }

    async function detectHands() {
      if (!running) {
        return;
      }

      if (video.readyState >= 2) {
        const results = handLandmarker.detectForVideo(
          video,
          performance.now()
        );

        const rawGesture = classifyGesture(results);
        const gesture = stabilizeGesture(rawGesture);

        updateLightResponse(gesture);
        triggerDmxForGesture(gesture);
      }

      requestAnimationFrame(detectHands);
    }

    startButton.addEventListener("click", startCamera);
    stopButton.addEventListener("click", stopCamera);
    triggerButton.addEventListener("click", toggleDmxTriggers);
  </script>
</body>
</html>
`;
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);

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
    sendKeyToESA2(key, response);
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
  console.log("LUX Gesture Demo running at:");
  console.log(`http://localhost:${PORT}`);
});