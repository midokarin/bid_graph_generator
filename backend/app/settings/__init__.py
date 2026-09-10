import os
from dataclasses import dataclass, field
from urllib.parse import urlparse

from app.domain.limits import MODEL_TIMEOUT


@dataclass(frozen=True)
class Settings:
    provider: str = "stub"
    base_url: str = "https://api.openai.com/v1"
    model: str = ""
    api_key: str = field(default="", repr=False)
    structured_output: str = "auto"
    timeout: float = MODEL_TIMEOUT

    def __post_init__(self):
        if self.provider not in {"stub", "openai"}:
            raise ValueError("BIAOSHU_PROVIDER must be stub or openai")
        if self.structured_output not in {"auto", "required", "off"}:
            raise ValueError("BIAOSHU_STRUCTURED_OUTPUT must be auto, required or off")
        url = urlparse(self.base_url)
        if url.scheme not in {"https", "http"} or not url.hostname or url.username or url.password or url.query or url.fragment:
            raise ValueError("Invalid model base URL")
        if self.provider == "openai" and (not self.api_key or not self.model):
            raise ValueError("OpenAI provider requires BIAOSHU_API_KEY and BIAOSHU_MODEL")
        if not 0 < self.timeout <= 600:
            raise ValueError("Model timeout must be between 0 and 600 seconds")

    @classmethod
    def from_env(cls):
        return cls(
            provider=os.getenv("BIAOSHU_PROVIDER", "stub"),
            base_url=os.getenv("BIAOSHU_BASE_URL", "https://api.openai.com/v1"),
            model=os.getenv("BIAOSHU_MODEL", ""),
            api_key=os.getenv("BIAOSHU_API_KEY", ""),
            structured_output=os.getenv("BIAOSHU_STRUCTURED_OUTPUT", "auto"),
            timeout=float(os.getenv("BIAOSHU_TIMEOUT", str(MODEL_TIMEOUT))),
        )
