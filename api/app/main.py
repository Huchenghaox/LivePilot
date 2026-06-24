from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import Base, engine
from app.routes import router
from app.schema_maintenance import ensure_dev_schema

Base.metadata.create_all(bind=engine)
ensure_dev_schema()

settings = get_settings()
app = FastAPI(title="LivePilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


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
