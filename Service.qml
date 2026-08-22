import QtQuick
import Quickshell
import Quickshell.Io
import "Model.js" as Model

// Singleton owner of Jabra state.
//
// Bar widgets are instantiated once per monitor. If each copy ran its own
// Process they would fight over hidraw/evdev and drift. All shelling out
// happens here; the chips only read properties and call these functions.
Item {
  id: root

  property var shell: null
  property var manifest: null
  property var pluginRegistry: null
  property var settings: ({})

  readonly property string pluginDir: Model.pluginDirFromUrl(Qt.resolvedUrl("."))
  readonly property string helper: root.pluginDir + "/bin/jabra-ctl"

  property var status: Model.emptyStatus()
  property bool busy: false
  property string lastError: ""

  function applyLine(raw) {
    var parsed = Model.parseStatus(raw)
    root.status = parsed
    if (parsed.error && parsed.error !== "No Jabra USB device")
      root.lastError = parsed.error
    else if (parsed.ok) root.lastError = ""
  }

  function run(args) {
    if (actionProc.running) return
    root.busy = true
    actionProc.command = Model.helperCommand(root.pluginDir, args)
    actionProc.running = true
  }

  function setDefault() { run(["set-default"]) }
  function toggleMute() { run(["mute"]) }
  function toggleMic() { run(["mic-mute"]) }
  function volume(delta) { run(["volume", String(delta)]) }
  function installUdev() {
    if (udevProc.running) return
    udevProc.command = Model.installUdevCommand(root.pluginDir)
    udevProc.running = true
  }

  Process {
    id: watchProc
    running: true
    command: Model.helperCommand(root.pluginDir, ["watch"])
    stdout: SplitParser {
      onRead: function(line) { root.applyLine(line) }
    }
    stderr: StdioCollector { waitForEnd: false }
    onExited: function() { watchRestart.restart() }
  }

  Timer {
    id: watchRestart
    interval: 1500
    repeat: false
    onTriggered: {
      if (!watchProc.running) watchProc.running = true
    }
  }

  Process {
    id: actionProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyLine(text)
    }
    stderr: StdioCollector {
      id: actionErr
      waitForEnd: true
    }
    onExited: function(code) {
      root.busy = false
      if (code !== 0 && actionErr.text)
        root.lastError = String(actionErr.text).trim()
    }
  }

  Process {
    id: udevProc
    stdout: StdioCollector { waitForEnd: true }
    stderr: StdioCollector {
      id: udevErr
      waitForEnd: true
    }
    onExited: function(code) {
      if (code !== 0)
        root.lastError = String(udevErr.text || "Could not install the udev rule").trim()
      else
        root.lastError = ""
    }
  }

  Component.onCompleted: {
    if (!watchProc.running) watchProc.running = true
  }
}
