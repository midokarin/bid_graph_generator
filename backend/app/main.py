from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.generations import router
from app.providers.openai import OpenAIProvider
from app.providers.stub import StubProvider
from app.services.debug_log import DebugLog
from app.services.generation import GenerationService
from app.settings import Settings


def create_app(settings=None, provider=None, log_directory=None):
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app):
        log = DebugLog(log_directory)
        chosen = provider or (StubProvider() if settings.provider == "stub" else OpenAIProvider(settings))
        app.state.generations = GenerationService(chosen, log, settings.timeout)
        try:
            yield
        finally:
            await app.state.generations.close()
            log.close()

    app = FastAPI(title="标绘生成后端", version="0.1.0", lifespan=lifespan,
                  docs_url="/api/v1/docs", openapi_url="/api/v1/openapi.json", redoc_url=None)
    app.include_router(router)

    @app.get("/api/v1/health")
    async def health():
        return {"status": "ok", "provider": settings.provider, "contract_version": "1.0"}

    return app


app = create_app()
