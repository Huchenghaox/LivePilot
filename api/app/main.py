from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.migrations import migration_status
from app.routes import router
from app.schema_maintenance import ensure_dev_schema

settings = get_settings()
if not settings.is_production:
    Base.metadata.create_all(bind=engine)
    ensure_dev_schema()

app = FastAPI(title="LivePilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def root_health() -> dict:
    return {"ok": True, "name": settings.app_name}


@app.get("/ready")
def root_ready() -> dict:
    checks = {"database": False, "upload_dir_writable": False, "migrations": False}
    migrations = {"current": None, "expected": None, "up_to_date": False}
    with SessionLocal() as db:
        try:
            db.execute(text("SELECT 1"))
            checks["database"] = True
        except Exception:
            checks["database"] = False
    try:
        probe = Path(settings.upload_dir) / ".ready-check"
        probe.parent.mkdir(parents=True, exist_ok=True)
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        checks["upload_dir_writable"] = True
    except OSError:
        checks["upload_dir_writable"] = False
    try:
        migrations = migration_status()
        checks["migrations"] = migrations["up_to_date"] if settings.is_production else True
    except Exception:
        checks["migrations"] = False if settings.is_production else True
    return {"ok": all(checks.values()), "name": settings.app_name, "checks": checks, "migrations": migrations}


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request, exc: RequestValidationError):
    for error in exc.errors():
        field = error.get("loc", [""])[-1]
        message = str(error.get("msg", ""))
        if field == "name":
            return JSONResponse(status_code=422, content={"detail": "昵称不能为空"})
        if field == "password":
            return JSONResponse(status_code=422, content={"detail": "密码不符合要求"})
        if "invite_code" == field:
            return JSONResponse(status_code=422, content={"detail": "邀请码无效"})
        if "Value error," in message:
            return JSONResponse(status_code=422, content={"detail": message.split("Value error,", 1)[1].strip()})
    return JSONResponse(status_code=422, content={"detail": "提交信息不完整，请检查后重试"})
