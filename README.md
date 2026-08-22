# Jabra Buds

A bar chip for Jabra Evolve2 Buds on a Link 390 USB dongle. Click it for every factory tap, mute, and a switch that makes the dongle the default speakers.

<p align="center">
  The chip sits next to Audio on the right of the Omarchy bar.
</p>

The buds handle Active Noise Cancellation themselves. On UC firmware, a press on the left bud cycles HearThrough and ANC. This plugin cannot flip that from the desktop — the dongle does not expose a safe ANC switch — but it does show the shortcut in the list, and it lights the matching row when a tap reaches Linux as a media key.

## Install

```sh
omarchy plugin add <git-url> --enable
omarchy bar move contra.jabra --before omarchy.audio
```

Or, developing from this checkout:

```sh
ln -sfn "$(pwd)" ~/.config/omarchy/plugins/contra.jabra
omarchy plugin validate .
omarchy plugin enable contra.jabra --section right --yes
omarchy bar move contra.jabra --before omarchy.audio
omarchy restart shell
```

## Use

- **Click** — open the panel: output, mute, the tap list
- **Right-click** — mute the Jabra sink
- **Middle-click** — make the dongle the default output
- **Scroll** — volume on the Jabra sink

Pick **UC** or **Teams** at the top of the list. Those are two factory maps; Sound+ MyControls can reassign music keys. Teams keys cannot.

## What it talks to

| Path | What |
|---|---|
| sysfs USB `idVendor=0b0e` | Dongle present |
| `pactl` | Volume, mute, default sink |
| `/dev/input/event*` (group `input`) | Last media-key tap, for highlighting the list |
| hidraw | Optional. A udev rule in `udev/` lets the helper open the vendor HID node later |

`Grant HID access` installs that rule through `pkexec`. Unplug and replug the dongle if hidraw is still `Permission denied`.

## Remove

```sh
omarchy plugin remove contra.jabra
```

That takes the chip off the bar. It does not touch PipeWire or udev.

## License

MIT. See [LICENSE](LICENSE). Not affiliated with Jabra / GN Audio.
