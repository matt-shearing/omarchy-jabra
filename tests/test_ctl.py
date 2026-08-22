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


if __name__ == "__main__":
  unittest.main()
