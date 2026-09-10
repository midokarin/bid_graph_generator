from dataclasses import replace
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, SecretStr
from app.providers.openai import OpenAIProvider
from app.services.generation import TERMINAL
from app.settings.storage import save_settings

router = APIRouter(prefix="/api/v1/settings")

class SettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    base_url: str = Field(max_length=2048)
    model: str = Field(min_length=1, max_length=200)
    api_key: SecretStr = SecretStr("")


def public(settings):
    return {"base_url": settings.base_url, "model": settings.model,
            "has_api_key": bool(settings.api_key), "api_key_mask": "••••••••" if settings.api_key else "", "provider": settings.provider}

@router.get("")
async def read(request: Request):
    return public(request.app.state.settings)

@router.put("")
async def update(body: SettingsUpdate, request: Request):
    app = request.app
    if any(job.state not in TERMINAL for job in app.state.generations.jobs.values()):
        raise HTTPException(409, "请先完成或取消当前生成任务")
    try:
        settings = replace(app.state.settings, provider="openai", base_url=body.base_url.strip(),
                           model=body.model.strip(), api_key=body.api_key.get_secret_value().strip() or app.state.settings.api_key)
        if not settings.model:
            raise ValueError()
        save_settings(settings, app.state.config_directory)
    except (ValueError, OSError):
        raise HTTPException(400, "配置未保存，请检查接口地址、模型、密钥和配置目录权限") from None
    app.state.settings = settings
    app.state.generations.provider = OpenAIProvider(settings)
    return public(settings)
