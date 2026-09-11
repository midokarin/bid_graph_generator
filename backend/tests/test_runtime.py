import os
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from app.domain.limits import MAX_LOG_BYTES
from app.services.debug_log import DebugLog
from app.settings import Settings


class RuntimeTests(unittest.TestCase):
    def test_temp_log_is_bounded_and_cleanup_preserves_live_runs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stale = root / "run-99999999-stale.jsonl"
            active = root / f"run-{os.getpid()}-active.jsonl"
            unrelated = root / "other.txt"
            for path in [stale, active, unrelated]:
                path.write_text("synthetic")
            log = DebugLog(directory)
            self.assertFalse(stale.exists())
            self.assertTrue(active.exists())
            for _ in range(30000):
                log.write("synthetic-job", "generating", 0)
            self.assertLessEqual(log.path.stat().st_size, MAX_LOG_BYTES)
            log.close()
            self.assertFalse(log.path.exists())
            self.assertTrue(active.exists())
            self.assertTrue(unrelated.exists())

    def test_configuration_is_explicit_and_key_repr_hidden(self):
        self.assertNotIn("synthetic-secret", repr(Settings(api_key="synthetic-secret")))
        with patch.dict(os.environ, {"BIAOSHU_PROVIDER": "openai", "BIAOSHU_API_KEY": "synthetic-secret", "BIAOSHU_MODEL": "test"}):
            self.assertEqual(Settings.from_env().model, "test")
        for changes in [{"provider": "openai"}, {"provider": "bad"}, {"base_url": "file:///tmp/test"}, {"base_url": "https://user:pass@model.example"}, {"timeout": 0}, {"timeout": float("nan")}, {"structured_output": "bad"}]:
            with self.assertRaises(ValueError):
                Settings(**changes)

    def test_metrics_log_filters_non_numeric_and_unrecognized_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            log = DebugLog(directory)
            log.write("test-job", "provider_timing", 0, provider_ms=350000,
                      first_content_ms=None, output_chars=5072, source_text="private source",
                      api_key="private secret", validation_ms="private text")
            record = json.loads(log.path.read_text())
            self.assertEqual(record["provider_ms"], 350000)
            self.assertIsNone(record["first_content_ms"])
            self.assertNotIn("private", log.path.read_text())
            log.close()
