#!/usr/bin/python3
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "bin" / "jabra-ctl"
MODEL = ROOT / "Model.js"


class HelperTests(unittest.TestCase):
  def test_status_json(self):
    proc = subprocess.run(
      ["python3", str(HELPER), "status"],
      check=False, capture_output=True, text=True, timeout=8,
    )
    self.assertEqual(proc.returncode, 0, proc.stderr)
    data = json.loads(proc.stdout.strip().splitlines()[-1])
    for key in (
      "ok", "connected", "name", "headset", "hidAccess",
      "defaultSink", "volume", "muted", "lastGesture",
    ):
      self.assertIn(key, data)
    self.assertEqual(data["headset"], "Evolve2 Buds")
    self.assertIn(data["hidAccess"], ("ok", "denied", "missing"))
    self.assertGreaterEqual(data["volume"], 0.0)
    self.assertLessEqual(data["volume"], 1.5)

  def test_usage_exit(self):
    proc = subprocess.run(
      ["python3", str(HELPER), "--help"],
      check=False, capture_output=True, text=True, timeout=4,
    )
    self.assertEqual(proc.returncode, 2)


class BatteryGnp(unittest.TestCase):
  @classmethod
  def setUpClass(cls):
    import importlib.machinery
    import importlib.util
    loader = importlib.machinery.SourceFileLoader("jabra_ctl", str(HELPER))
    spec = importlib.util.spec_from_loader("jabra_ctl", loader)
    cls.ctl = importlib.util.module_from_spec(spec)
    loader.exec_module(cls.ctl)

  def test_parse_valid_report(self):
    pkt = bytearray(64)
    pkt[0] = 0x05
    pkt[5] = 0x12
    pkt[6] = 0x02
    pkt[8] = 72
    pkt[9] = 1
    pkt[10] = 0
    parsed = self.ctl.parse_gnp_battery(pkt)
    self.assertEqual(parsed["percent"], 72)
    self.assertTrue(parsed["charging"])
    self.assertFalse(parsed["low"])

  def test_parse_rejects_empty_and_wrong_cmd(self):
    self.assertIsNone(self.ctl.parse_gnp_battery(b""))
    pkt = bytearray(64)
    pkt[0] = 0x05
    pkt[5] = 0x02
    pkt[6] = 0x03
    pkt[8] = 50
    self.assertIsNone(self.ctl.parse_gnp_battery(pkt))

  def test_parse_rejects_zero_percent(self):
    pkt = bytearray(64)
    pkt[0] = 0x05
    pkt[5] = 0x12
    pkt[6] = 0x02
    pkt[8] = 0
    self.assertIsNone(self.ctl.parse_gnp_battery(pkt))

  def test_request_layout(self):
    pkt = self.ctl.gnp_battery_request(0x04, 3)
    self.assertEqual(len(pkt), 64)
    self.assertEqual(pkt[0], 0x05)
    self.assertEqual(pkt[1], 0x04)
    self.assertEqual(pkt[3], 3)
    self.assertEqual(pkt[5], 0x12)
    self.assertEqual(pkt[6], 0x02)


class CheatsheetContract(unittest.TestCase):
  def test_uc_has_left_anc(self):
    model = MODEL.read_text(encoding="utf-8")
    self.assertIn("Cycle HearThrough and ANC", model)
    self.assertIn('side: "Left"', model)
    self.assertIn("Press (not on a call)", model)

  def test_teams_has_right_double_anc(self):
    model = MODEL.read_text(encoding="utf-8")
    self.assertIn("Double-press (not on a call)", model)
    self.assertIn("Microsoft Teams", model)

  def test_gesture_keys(self):
    model = MODEL.read_text(encoding="utf-8")
    self.assertIn("KEY_PLAYPAUSE", model)
    self.assertIn("KEY_NEXTSONG", model)
    self.assertIn("KEY_MICMUTE", model)

  def test_battery_helpers(self):
    model = MODEL.read_text(encoding="utf-8")
    self.assertIn("function batteryGlyph", model)
    self.assertIn("function batteryLabel", model)
    self.assertIn("Grant HID access to read charge.", model)


class TelephonyHost(unittest.TestCase):
  @classmethod
  def setUpClass(cls):
    import importlib.machinery
    import importlib.util
    loader = importlib.machinery.SourceFileLoader("jabra_ctl", str(HELPER))
    spec = importlib.util.spec_from_loader("jabra_ctl", loader)
    cls.ctl = importlib.util.module_from_spec(spec)
    loader.exec_module(cls.ctl)

  def test_offhook_unmute_report(self):
    self.assertEqual(self.ctl.telephony_report(True), b"\x02\x01")
    self.assertEqual(self.ctl.telephony_report(True, muted=True), b"\x02\x03")
    self.assertEqual(self.ctl.telephony_report(False), b"\x02\x00")

  def test_voxtype_recording_state(self):
    import os
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
      state = Path(tmp) / "voxtype"
      state.mkdir()
      (state / "state").write_text("recording\n", encoding="utf-8")
      old = os.environ.get("XDG_RUNTIME_DIR")
      os.environ["XDG_RUNTIME_DIR"] = tmp
      try:
        self.assertTrue(self.ctl.voxtype_recording())
        (state / "state").write_text("idle\n", encoding="utf-8")
        self.assertFalse(self.ctl.voxtype_recording())
      finally:
        if old is None:
          os.environ.pop("XDG_RUNTIME_DIR", None)
        else:
          os.environ["XDG_RUNTIME_DIR"] = old


class MicmuteIgnore(unittest.TestCase):
  def test_hwdb_drops_telephony_mute(self):
    text = (ROOT / "udev" / "90-jabra-micmute.hwdb").read_text(encoding="utf-8")
    self.assertIn("evdev:input:b0003v0B0Ep2E56*", text)
    self.assertIn("KEYBOARD_KEY_b002f=reserved", text)

  def test_quirks_drop_key_micmute(self):
    text = (ROOT / "udev" / "90-jabra-micmute.quirks").read_text(encoding="utf-8")
    self.assertIn("MatchProduct=0x2E56", text)
    self.assertIn("AttrEventCode=-KEY_MICMUTE", text)


if __name__ == "__main__":
  unittest.main()
