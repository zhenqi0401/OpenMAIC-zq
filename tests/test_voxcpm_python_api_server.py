import ast
import unittest
from pathlib import Path


SERVER_PATH = Path(__file__).resolve().parents[1] / "voxcpm_python_api_server.py"


class VoxCPMPythonAPIServerShapeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.assertTrue(SERVER_PATH.exists(), f"{SERVER_PATH} should exist")
        self.source = SERVER_PATH.read_text(encoding="utf-8")
        self.tree = ast.parse(self.source)

    def test_exposes_openmaic_python_api_routes(self) -> None:
        routes = set()
        for node in ast.walk(self.tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for decorator in node.decorator_list:
                if (
                    isinstance(decorator, ast.Call)
                    and isinstance(decorator.func, ast.Attribute)
                    and decorator.func.attr in {"get", "post"}
                    and decorator.args
                    and isinstance(decorator.args[0], ast.Constant)
                ):
                    routes.add((decorator.func.attr, decorator.args[0].value))

        self.assertIn(("post", "/v1/tts/upload"), routes)
        self.assertIn(("post", "/tts/upload"), routes)
        self.assertIn(("get", "/health"), routes)

    def test_tts_upload_accepts_openmaic_form_fields(self) -> None:
        functions = {
            node.name: node
            for node in ast.walk(self.tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }
        tts_upload = functions.get("tts_upload")
        self.assertIsNotNone(tts_upload)

        args = {arg.arg for arg in tts_upload.args.args}
        self.assertTrue(
            {
                "text",
                "cfg_value",
                "inference_timesteps",
                "normalize",
                "denoise",
                "reference_audio",
                "prompt_audio",
                "prompt_text",
            }.issubset(args)
        )

    def test_uses_official_voxcpm_model_and_returns_wav(self) -> None:
        self.assertIn("VoxCPM.from_pretrained", self.source)
        self.assertIn("openbmb/VoxCPM2", self.source)
        self.assertIn("model.generate", self.source)
        self.assertIn('media_type="audio/wav"', self.source)


if __name__ == "__main__":
    unittest.main()
