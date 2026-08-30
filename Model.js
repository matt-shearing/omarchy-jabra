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
    charging: false,
    batteryLow: false,
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
  out.battery = normalizeBattery(data.battery)
  out.charging = !!(out.battery && out.battery.charging)
  out.batteryLow = !!(out.battery && out.battery.low)
  out.anc = data.anc == null ? null : data.anc
  out.ancControl = data.ancControl === true
  out.lastGesture = data.lastGesture && typeof data.lastGesture === "object" ? data.lastGesture : null
  out.error = String(data.error || data.detail || "")
  return out
}

function normalizeBattery(raw) {
  if (raw == null || raw === "") return null
  if (typeof raw === "number") {
    if (raw < 1 || raw > 100) return null
    return { percent: Math.round(raw), charging: false, low: raw <= 15 }
  }
  if (typeof raw !== "object") return null
  var percent = Number(raw.percent)
  if (!(percent >= 1 && percent <= 100)) return null
  return {
    percent: Math.round(percent),
    charging: raw.charging === true,
    low: raw.low === true || percent <= 15
  }
}

function batteryPercent(status) {
  var bat = status && status.battery
  if (!bat || !(bat.percent >= 1)) return 0
  return Math.round(bat.percent)
}

function batteryGlyph(status) {
  var bat = status && status.battery
  if (!bat || !(bat.percent >= 1)) return String.fromCodePoint(0xF007A)
  var index = bat.percent >= 100 ? 9 : Math.max(0, Math.min(9, Math.floor((bat.percent - 1) / 10)))
  var charging = [
    0xF009C, 0xF0086, 0xF0087, 0xF0088, 0xF009D,
    0xF0089, 0xF009E, 0xF008A, 0xF008B, 0xF0085
  ]
  var idle = [
    0xF007A, 0xF007B, 0xF007C, 0xF007D, 0xF007E,
    0xF007F, 0xF0080, 0xF0081, 0xF0082, 0xF0079
  ]
  var table = bat.charging ? charging : idle
  return String.fromCodePoint(table[index])
}

function batteryLabel(status) {
  var bat = status && status.battery
  if (bat && bat.percent >= 1) return bat.percent + "%"
  if (status && status.connected) return "—"
  return "Off"
}

function batteryDetail(status) {
  var bat = status && status.battery
  if (bat && bat.percent >= 1) {
    if (bat.charging) return "Charging in the case"
    if (bat.low) return "Low — charge soon"
    return "In the buds"
  }
  if (status && status.hidAccess !== "ok")
    return "Grant HID access to read charge."
  if (status && status.connected)
    return "Charge unknown. The dongle is up; the buds may be asleep."
  return "Plug in the Link dongle."
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
  if (status.battery && status.battery.percent >= 1) {
    bits.push(status.battery.percent + "%" + (status.battery.charging ? " charging" : ""))
  }
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
  if (status.battery && status.battery.percent >= 1)
    line += " · buds " + status.battery.percent + "%"
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
  return "Tap shortcuts work now. Battery reading needs HID access (one udev rule)."
}
