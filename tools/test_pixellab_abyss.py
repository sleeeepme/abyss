#!/usr/bin/env python3
import tempfile
import unittest
from pathlib import Path

import pixellab_abyss as tool


class PixelLabAbyssTest(unittest.TestCase):
    def test_png_round_trip_validation_and_preview(self):
        transparent = bytes((0, 0, 0, 0))
        red = bytes((180, 40, 50, 255))
        rows = [transparent * 4, transparent + red * 2 + transparent,
                transparent + red * 2 + transparent, transparent * 4]
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "sprite.png"
            target = Path(directory) / "sprite-4x.png"
            source.write_bytes(tool.encode_rgba_png(4, 4, rows))
            self.assertEqual(tool.validate(source, 4, 4, 1, True), (4, 4, 1, []))
            args = type("Args", (), {"input": source, "output": target, "scale": 4})()
            tool.preview(args)
            width, height, _ = tool.decode_png(target)
            self.assertEqual((width, height), (16, 16))

    def test_validation_reports_policy_failures(self):
        rows = [bytes((10, 20, 30, 128))]
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "bad.png"
            source.write_bytes(tool.encode_rgba_png(1, 1, rows))
            _, _, _, errors = tool.validate(source, 16, 16, 0, True)
            self.assertIn("width 1 != 16", errors)
            self.assertIn("height 1 != 16", errors)
            self.assertIn("1 visible colors > 0", errors)
            self.assertIn("intermediate alpha values: [128]", errors)
            self.assertIn("visible pixels touch the canvas edge", errors)

    def test_response_image_extraction(self):
        expected = b"png bytes"
        response = {"last_response": {"image": {"base64": "data:image/png;base64," +
                    __import__("base64").b64encode(expected).decode("ascii")}}}
        self.assertEqual(tool.image_bytes(response), expected)


if __name__ == "__main__":
    unittest.main()
