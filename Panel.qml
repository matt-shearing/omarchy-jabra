import QtQuick
import QtQuick.Controls
import Quickshell
import qs.Commons
import qs.Ui
import "Model.js" as Model

Panel {
  id: root
  moduleName: "contra.jabra"
  ipcTarget: "contra.jabra"
  manageIpc: true

  // One singleton owns Process / evdev; this widget is visual-only and
  // exists once per monitor.
  readonly property var service: bar?.shell?.serviceFor("contra.jabra")
  readonly property var status: service ? service.status : Model.emptyStatus()
  readonly property bool busy: service ? service.busy : false
  readonly property string lastError: service ? service.lastError : ""

  readonly property color fg: bar ? bar.foreground : Color.foreground
  readonly property color dim: Qt.darker(fg, 1.4)
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property color hoverFill: bar ? Style.hoverFillFor(bar.foreground, Color.accent) : "transparent"

  readonly property string variant: Model.normalizeVariant(setting("variant", "uc"))
  readonly property var sections: Model.cheatsheet(root.variant)
  readonly property var lastGesture: status.lastGesture

  property bool cursorActive: false
  property int focusIndex: 0
  readonly property bool needsHid: Model.hidNeedsGrant(root.status)
  readonly property int hidOffset: needsHid ? 1 : 0
  readonly property int controlCount: 3 + hidOffset

  function persistVariant(value) {
    var next = Model.normalizeVariant(value)
    if (next === root.variant) return
    if (!root.bar || !root.bar.shell || typeof root.bar.shell.updateEntryInline !== "function") return
    var entry = { id: root.moduleName }
    for (var key in settings) if (key !== "id") entry[key] = settings[key]
    entry.variant = next
    root.bar.shell.updateEntryInline(root.moduleName, entry)
  }

  function activateFocused() {
    if (root.needsHid && focusIndex === 0) {
      if (root.service) root.service.installUdev()
    } else if (focusIndex === root.hidOffset) {
      if (root.service) root.service.setDefault()
    } else if (focusIndex === root.hidOffset + 1) {
      if (root.service) root.service.toggleMute()
    } else if (root.service) {
      root.service.toggleMic()
    }
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: Model.glyph()
    dimmed: Model.barDimmed(root.status)
    active: false
    useActiveColor: false
    tooltipText: Model.tooltip(root.status)
    onPressed: function(b) {
      if (b === Qt.RightButton) {
        if (root.service) root.service.toggleMute()
      } else if (b === Qt.MiddleButton) {
        if (root.service) root.service.setDefault()
      } else {
        root.toggle()
      }
    }
    onWheelMoved: function(delta) {
      if (!root.service || !root.status.connected) return
      if (delta > 0) root.service.volume("up")
      else if (delta < 0) root.service.volume("down")
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(420))
    contentHeight: panel.fittedContentHeight(column.implicitHeight, Style.space(760))

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onMoveRequested: function(dx, dy) {
        root.cursorActive = true
        var delta = dy !== 0 ? dy : dx
        root.focusIndex = Math.max(0, Math.min(root.controlCount - 1, root.focusIndex + delta))
      }
      onActivateRequested: if (root.cursorActive) root.activateFocused()
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }

      ScrollView {
        id: scrollArea
        anchors.fill: parent
        clip: true
        ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
        ScrollBar.vertical.policy: column.implicitHeight > height ? ScrollBar.AsNeeded : ScrollBar.AlwaysOff

        Column {
          id: column
          width: scrollArea.availableWidth
          spacing: Style.space(14)

          PanelHero {
            title: Model.heroTitle(root.status)
            meta: Model.heroMeta(root.status)
            detail: Model.heroDetail(root.status)
            foreground: root.fg
            fontFamily: root.fontFamily
            iconComponent: Component {
              Text {
                width: Style.font.display
                height: Style.font.display
                text: Model.glyph()
                color: root.status.connected ? root.fg : root.dim
                font.family: root.fontFamily
                font.pixelSize: Style.font.display
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
              }
            }
          }

          Row {
            id: batteryRow
            width: parent.width
            spacing: Style.space(12)

            Text {
              id: batteryGlyph
              text: Model.batteryGlyph(root.status)
              color: root.status.battery && root.status.battery.low
                ? (root.bar ? root.bar.urgent : Color.urgent)
                : (root.status.connected ? root.fg : root.dim)
              font.family: root.fontFamily
              font.pixelSize: Style.font.display
              verticalAlignment: Text.AlignVCenter
              width: Style.font.display
              height: Math.max(Style.font.display, batteryLabels.implicitHeight)
            }

            Column {
              id: batteryLabels
              width: parent.width - batteryGlyph.width - parent.spacing
              spacing: Style.space(2)

              Text {
                width: parent.width
                text: "Buds  " + Model.batteryLabel(root.status)
                color: root.fg
                font.family: root.fontFamily
                font.pixelSize: Style.font.subtitle
                font.bold: true
              }

              Text {
                width: parent.width
                text: Model.batteryDetail(root.status)
                color: root.dim
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
                wrapMode: Text.WordWrap
              }
            }
          }

          Button {
            width: parent.width
            visible: root.needsHid
            text: "Grant HID access"
            iconText: String.fromCodePoint(0xF0237)
            bordered: true
            leftAlign: true
            foreground: root.fg
            fontFamily: root.fontFamily
            hasCursor: root.cursorActive && root.focusIndex === 0
            onClicked: if (root.service) root.service.installUdev()
            onHovered: function(on) {
              if (on) { root.cursorActive = true; root.focusIndex = 0 }
            }
          }

          Text {
            width: parent.width
            visible: root.lastError !== ""
            text: root.lastError
            color: root.bar ? root.bar.urgent : Color.urgent
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            wrapMode: Text.WordWrap
          }

          PanelSeparator { foreground: root.fg }

          Toggle {
            width: parent.width
            label: "Default output"
            description: root.status.defaultSink
              ? "These buds are the speakers."
              : "Route desktop audio to the Jabra dongle."
            checked: root.status.defaultSink
            enabled: root.status.connected && !!root.status.sinkName
            hasCursor: root.cursorActive && root.focusIndex === root.hidOffset
            foreground: root.fg
            fontFamily: root.fontFamily
            onClicked: if (root.service) root.service.setDefault()
            onHovered: function(on) {
              if (on) { root.cursorActive = true; root.focusIndex = root.hidOffset }
            }
          }

          Toggle {
            width: parent.width
            label: "Mute"
            description: "Right-click the chip. Scroll the chip to change volume."
            checked: root.status.muted
            enabled: root.status.connected
            hasCursor: root.cursorActive && root.focusIndex === root.hidOffset + 1
            foreground: root.fg
            fontFamily: root.fontFamily
            onClicked: if (root.service) root.service.toggleMute()
            onHovered: function(on) {
              if (on) { root.cursorActive = true; root.focusIndex = root.hidOffset + 1 }
            }
          }

          Toggle {
            width: parent.width
            label: "Mute microphone"
            description: root.status.sourceName
              ? "The dongle's own mic. The desk mic stays separate."
              : "No Jabra microphone right now."
            checked: root.status.micMuted
            enabled: root.status.connected && !!root.status.sourceName
            hasCursor: root.cursorActive && root.focusIndex === root.hidOffset + 2
            foreground: root.fg
            fontFamily: root.fontFamily
            onClicked: if (root.service) root.service.toggleMic()
            onHovered: function(on) {
              if (on) { root.cursorActive = true; root.focusIndex = root.hidOffset + 2 }
            }
          }

          PanelSeparator { foreground: root.fg }

          Item {
            width: parent.width
            implicitHeight: Math.max(variantHeader.implicitHeight, variantGroup.implicitHeight)

            PanelSectionHeader {
              id: variantHeader
              text: "BUD VARIANT"
              foreground: root.fg
              fontFamily: root.fontFamily
              anchors.left: parent.left
              anchors.verticalCenter: parent.verticalCenter
            }

            ButtonGroup {
              id: variantGroup
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              options: Model.variantOptions()
              value: root.variant
              foreground: root.fg
              fontFamily: root.fontFamily
              focusable: false
              onChanged: function(v) { root.persistVariant(v) }
            }
          }

          Text {
            width: parent.width
            text: "Factory defaults from the Evolve2 Buds manual. Sound+ MyControls can reassign music keys; Teams keys cannot."
            color: root.dim
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            wrapMode: Text.WordWrap
          }

          Repeater {
            model: root.sections

            delegate: Column {
              required property var modelData
              width: column.width
              spacing: Style.space(6)

              PanelSectionHeader {
                text: String(modelData.title || "").toUpperCase()
                foreground: root.fg
                fontFamily: root.fontFamily
              }

              Repeater {
                model: modelData.rows

                delegate: Rectangle {
                  required property var modelData
                  width: column.width
                  implicitHeight: rowLabels.implicitHeight + Style.space(10)
                  radius: Style.cornerRadius
                  color: Model.gestureMatches(modelData, root.lastGesture)
                    ? root.hoverFill
                    : "transparent"

                  Row {
                    id: rowLabels
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.leftMargin: Style.space(6)
                    anchors.rightMargin: Style.space(6)
                    spacing: Style.space(10)

                    Text {
                      width: Math.round(parent.width * 0.42)
                      text: modelData.side + " · " + modelData.gesture
                      color: root.dim
                      font.family: root.fontFamily
                      font.pixelSize: Style.font.caption
                      font.bold: true
                      wrapMode: Text.WordWrap
                    }

                    Text {
                      width: parent.width - parent.children[0].width - parent.spacing
                      text: modelData.action
                      color: root.fg
                      font.family: root.fontFamily
                      font.pixelSize: Style.font.body
                      wrapMode: Text.WordWrap
                    }
                  }
                }
              }
            }
          }

          PanelSeparator { foreground: root.fg }

          Text {
            width: parent.width
            text: Model.hidHint(root.status)
            color: root.dim
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            wrapMode: Text.WordWrap
          }
        }
      }
    }
  }
}
