.pragma library

function pluginDirFromUrl(url) {
  var u = String(url || "")
  if (u.indexOf("file://") === 0) u = u.slice(7)
  return u.replace(/\/$/, "")
}

function glyph() {
  return String.fromCodePoint(0xF02CB)
}

function emptyStatus() {
  return {
    ok: false,
    connected: false,
    name: "Jabra",
    headset: "Evolve2 Buds",
    dongle: "",
    serial: "",
    hidAccess: "missing",
    hidraw: "",
    sinkName: "",
    sourceName: "",
    defaultSink: false,
    volume: 0,
    muted: false,
    micMuted: false,
    battery: null,
    anc: null,
    ancControl: false,
    lastGesture: null,
    error: ""
  }
}

function parseStatus(raw) {
  var out = emptyStatus()
  var text = String(raw || "").trim()
  if (text === "") return out
  var line = text
  var nl = text.lastIndexOf("\n")
  if (nl >= 0) {
    var last = text.slice(nl + 1).trim()
    line = last !== "" ? last : text.slice(0, nl).trim()
  }
  try {
    var data = JSON.parse(line)
  } catch (e) {
    out.error = "Bad status from jabra-ctl"
    return out
  }
  out.ok = data.ok !== false
  out.connected = data.connected === true
  out.name = String(data.name || out.name)
  out.headset = String(data.headset || out.headset)
  out.dongle = String(data.dongle || "")
  out.serial = String(data.serial || "")
  out.hidAccess = String(data.hidAccess || "missing")
  out.hidraw = String(data.hidraw || "")
  out.sinkName = String(data.sinkName || "")
  out.sourceName = String(data.sourceName || "")
  out.defaultSink = data.defaultSink === true
  out.volume = Number(data.volume || 0)
  out.muted = data.muted === true
  out.micMuted = data.micMuted === true
  out.battery = data.battery == null ? null : data.battery
  out.anc = data.anc == null ? null : data.anc
  out.ancControl = data.ancControl === true
  out.lastGesture = data.lastGesture && typeof data.lastGesture === "object" ? data.lastGesture : null
  out.error = String(data.error || data.detail || "")
  return out
}

function normalizeVariant(value) {
  var v = String(value || "uc").trim().toLowerCase()
  return v === "teams" ? "teams" : "uc"
}

function volumePercent(status) {
  var n = Math.round((status && status.volume ? status.volume : 0) * 100)
  if (n < 0) n = 0
  if (n > 150) n = 150
  return n
}

function heroTitle(status) {
  if (!status || !status.connected) return "Jabra"
  return status.headset || status.name || "Jabra"
}

function heroMeta(status) {
  if (!status || !status.connected) return "Not plugged in"
  var bits = []
  if (status.dongle) bits.push(status.dongle)
  if (status.defaultSink) bits.push("Default output")
  else if (status.sinkName) bits.push("Connected")
  if (status.muted) bits.push("Muted")
  return bits.join(" · ") || "Connected"
}

function heroDetail(status) {
  if (!status || !status.connected) return "OFF"
  if (status.muted) return "MUTE"
  return volumePercent(status) + "%"
}

function tooltip(status) {
  if (!status || !status.connected)
    return "Jabra · not plugged in\nClick for tap shortcuts"
  var line = "Jabra · " + (status.headset || status.name)
  if (status.defaultSink) line += " · default output"
  line += "\n" + volumePercent(status) + "%"
  if (status.muted) line += " · muted"
  if (status.lastGesture && status.lastGesture.label)
    line += "\nLast tap: " + status.lastGesture.label
  else line += "\nClick for tap shortcuts"
  return line
}

function barDimmed(status) {
  return !(status && status.connected)
}

function gestureMatches(row, gesture) {
  if (!row || !gesture) return false
  var key = String(gesture.key || "")
  var keys = row.keys || []
  for (var i = 0; i < keys.length; i++)
    if (keys[i] === key) return true
  return false
}

function ucCheatsheet() {
  return [
    {
      id: "music",
      title: "Music",
      rows: [
        { id: "play", side: "Right", gesture: "Press", action: "Play / pause", keys: ["KEY_PLAYPAUSE", "KEY_PLAY", "KEY_PAUSE"] },
        { id: "next", side: "Right", gesture: "Double-press", action: "Next track", keys: ["KEY_NEXTSONG"] },
        { id: "prev", side: "Right", gesture: "Triple-press", action: "Restart / previous track", keys: ["KEY_PREVIOUSSONG"] },
        { id: "vol-up", side: "Right", gesture: "Press and hold", action: "Volume up", keys: ["KEY_VOLUMEUP"] },
        { id: "vol-down", side: "Left", gesture: "Press and hold", action: "Volume down", keys: ["KEY_VOLUMEDOWN"] }
      ]
    },
    {
      id: "calls",
      title: "Calls",
      rows: [
        { id: "answer", side: "Left or right", gesture: "Press", action: "Answer", keys: [] },
        { id: "hangup", side: "Left or right", gesture: "Double-press", action: "End or reject", keys: [] },
        { id: "mic", side: "Left or right", gesture: "Press (on a call)", action: "Mute / unmute mic", keys: ["KEY_MICMUTE", "KEY_MUTE"] }
      ]
    },
    {
      id: "anc",
      title: "Noise cancelling",
      rows: [
        { id: "anc-cycle", side: "Left", gesture: "Press (not on a call)", action: "Cycle HearThrough and ANC", keys: [] }
      ]
    },
    {
      id: "power",
      title: "Power",
      rows: [
        { id: "on-case", side: "Case", gesture: "Take out / put in", action: "Power on / off and charge", keys: [] },
        { id: "off-both", side: "Both", gesture: "Press together", action: "Power off", keys: [] },
        { id: "on-hold", side: "Left or right", gesture: "Hold 3 seconds", action: "Power that bud on", keys: [] }
      ]
    }
  ]
}

function teamsCheatsheet() {
  return [
    {
      id: "music",
      title: "Music",
      rows: [
        { id: "play", side: "Left", gesture: "Press (not on a call)", action: "Play / pause", keys: ["KEY_PLAYPAUSE", "KEY_PLAY", "KEY_PAUSE"] },
        { id: "next", side: "Left", gesture: "Double-press", action: "Next track", keys: ["KEY_NEXTSONG"] },
        { id: "prev", side: "Left", gesture: "Triple-press", action: "Restart / previous track", keys: ["KEY_PREVIOUSSONG"] }
      ]
    },
    {
      id: "calls",
      title: "Calls",
      rows: [
        { id: "answer", side: "Right", gesture: "Press", action: "Answer", keys: [] },
        { id: "hangup", side: "Right", gesture: "Double-press", action: "End or reject", keys: [] },
        { id: "mic", side: "Right", gesture: "Press (on a call)", action: "Mute / unmute mic", keys: ["KEY_MICMUTE", "KEY_MUTE"] }
      ]
    },
    {
      id: "teams",
      title: "Microsoft Teams",
      rows: [
        { id: "teams-open", side: "Right", gesture: "Press (signed in)", action: "Bring Teams forward, join, or missed calls", keys: [] },
        { id: "teams-hand", side: "Right", gesture: "Hold 1 second", action: "Raise hand in a meeting", keys: [] }
      ]
    },
    {
      id: "anc",
      title: "Noise cancelling",
      rows: [
        { id: "anc-cycle", side: "Right", gesture: "Double-press (not on a call)", action: "Cycle HearThrough and ANC", keys: [] },
        { id: "assistant", side: "Left", gesture: "Hold 1 second (not on a call)", action: "Voice assistant", keys: [] }
      ]
    },
    {
      id: "power",
      title: "Power",
      rows: [
        { id: "on-case", side: "Case", gesture: "Take out / put in", action: "Power on / off and charge", keys: [] },
        { id: "off-both", side: "Both", gesture: "Press together", action: "Power off", keys: [] },
        { id: "on-hold", side: "Left or right", gesture: "Hold 3 seconds", action: "Power that bud on", keys: [] }
      ]
    }
  ]
}

function cheatsheet(variant) {
  return normalizeVariant(variant) === "teams" ? teamsCheatsheet() : ucCheatsheet()
}

function variantOptions() {
  return [
    { value: "uc", label: "UC" },
    { value: "teams", label: "Teams" }
  ]
}

function helperCommand(pluginDir, args) {
  var cmd = ["python3", String(pluginDir || "") + "/bin/jabra-ctl"]
  if (!args || !args.length) return cmd.concat(["status"])
  return cmd.concat(args)
}

function installUdevCommand(pluginDir) {
  return [String(pluginDir || "") + "/bin/install-udev"]
}

function hidNeedsGrant(status) {
  return !status || status.hidAccess !== "ok"
}

function hidHint(status) {
  if (status && status.hidAccess === "ok")
    return "ANC still lives on the buds — press the left button (UC) to cycle HearThrough and ANC."
  return "Tap shortcuts work now. Desktop ANC would need HID access (one udev rule)."
}
