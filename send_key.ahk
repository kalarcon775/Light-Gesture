#Requires AutoHotkey v2.0
#SingleInstance Force

if A_Args.Length < 1 {
    ExitApp
}

key := StrLower(A_Args[1])

allowed := Map(
    "r", true,
    "g", true,
    "b", true,
    "y", true,
    "w", true,
    "p", true,
    "o", true
)

if !allowed.Has(key) {
    ExitApp
}

targetWindow := ""

for hwnd in WinGetList() {
    title := WinGetTitle(hwnd)
    processName := WinGetProcessName(hwnd)

    titleLower := StrLower(title)
    processLower := StrLower(processName)

    if InStr(titleLower, "esa")
        || InStr(titleLower, "easy stand alone")
        || InStr(processLower, "esa") {
        targetWindow := hwnd
        break
    }
}

if targetWindow = "" {
    MsgBox("ESA2 window was not found. Open ESA2 first.")
    ExitApp
}

try {
    ControlSend("{" key "}", , "ahk_id " targetWindow)
} catch {
    MsgBox("Could not send key to ESA2 in the background.")
}

Sleep(100)

ExitApp