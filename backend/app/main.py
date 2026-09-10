from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.generations import router
from app.api.settings import router as settings_router
from app.settings.storage import load_settings
from fastapi.responses import JSONResponse
from urllib.parse import urlparse
from app.providers.openai import OpenAIProvider
from app.providers.stub import StubProvider
from app.services.debug_log import DebugLog
from app.services.generation import GenerationService
from app.settings import Settings


def create_app(settings=None, provider=None, log_directory=None, config_directory=None):
    settings = settings or load_settings(config_directory)

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
    app.state.settings = settings
    app.state.config_directory = config_directory
    app.include_router(router)
    app.include_router(settings_router)

    @app.middleware("http")
    async def local_only(request, call_next):
        if request.url.hostname not in {"127.0.0.1", "localhost", "testserver"}:
            return JSONResponse({"detail": "仅允许本机访问"}, status_code=403)
        origin = request.headers.get("origin")
        if origin and urlparse(origin).hostname not in {"127.0.0.1", "localhost"}:
            return JSONResponse({"detail": "拒绝外部网页请求"}, status_code=403)
        return await call_next(request)

    @app.get("/api/v1/health")
    async def health():
        return {"status": "ok", "provider": app.state.settings.provider, "contract_version": "1.0"}

    return app


app = create_app()
