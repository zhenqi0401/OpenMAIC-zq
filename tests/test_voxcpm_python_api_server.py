import ast
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVER_PATH = ROOT / "services" / "voxcpm-api" / "app.py"
SERVICE_DOCKERFILE = ROOT / "services" / "voxcpm-api" / "Dockerfile"
SERVICE_REQUIREMENTS = ROOT / "services" / "voxcpm-api" / "requirements.txt"
PROD_COMPOSE = ROOT / "docker-compose.prod.yml"
SEED_SCRIPT = ROOT / "scripts" / "seed-roles.mjs"


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

    def test_service_has_container_runtime_files(self) -> None:
        self.assertTrue(SERVICE_DOCKERFILE.exists(), "VoxCPM service needs a Dockerfile")
        self.assertTrue(SERVICE_REQUIREMENTS.exists(), "VoxCPM service needs requirements.txt")

        dockerfile = SERVICE_DOCKERFILE.read_text(encoding="utf-8")
        requirements = SERVICE_REQUIREMENTS.read_text(encoding="utf-8")
        self.assertIn("uvicorn", dockerfile)
        self.assertIn("app:app", dockerfile)
        self.assertIn("fastapi", requirements)
        self.assertIn("voxcpm", requirements)

    def test_prod_compose_wires_openmaic_to_voxcpm_sidecar(self) -> None:
        self.assertTrue(PROD_COMPOSE.exists(), "production compose file should exist")
        compose = PROD_COMPOSE.read_text(encoding="utf-8")
        self.assertIn("voxcpm-api:", compose)
        self.assertIn("TTS_VOXCPM_BASE_URL", compose)
        self.assertIn("http://voxcpm-api:8000", compose)
        self.assertIn("ALLOW_LOCAL_NETWORKS", compose)
        self.assertIn("postgres:", compose)

    def test_seed_script_applies_role_seed_after_migrations(self) -> None:
        self.assertTrue(SEED_SCRIPT.exists(), "deployment needs a role seed script")
        source = SEED_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("DATABASE_URL", source)
        self.assertIn("drizzle/seed.sql", source.replace("\\", "/"))
        self.assertIn("postgres", source)


if __name__ == "__main__":
    unittest.main()
