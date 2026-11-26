"""Main FastAPI application"""
from contextlib import asynccontextmanager
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .config import settings
from .db import init_db
from .services.predictor import predictor
from .routes import health, auth_routes, qa_routes, analytics, history_routes, document_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize database and load QA model on startup"""
    print("Starting up... Initializing database and storage...")
    try:
        init_db()
    except Exception as e:
        print(f"Warning: Database initialization error: {e}")

    print("Loading QA model...")
    try:
        predictor.load_model()
        print("Model loaded successfully!")
    except Exception as e:
        print(f"Warning: Could not load model: {e}")
    yield
    print("Shutting down...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS middleware
cors_origins = list(settings.BACKEND_CORS_ORIGINS)
if settings.FRONTEND_URL:
    clean_frontend_url = settings.FRONTEND_URL.strip().rstrip("/")
    if clean_frontend_url and clean_frontend_url not in cors_origins:
        cors_origins.append(clean_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix=settings.API_V1_PREFIX, tags=["health"])
app.include_router(auth_routes.router, prefix=f"{settings.API_V1_PREFIX}/auth", tags=["auth"])
app.include_router(qa_routes.router, prefix=f"{settings.API_V1_PREFIX}/qa", tags=["qa"])
app.include_router(analytics.router, prefix=f"{settings.API_V1_PREFIX}/analytics", tags=["analytics"])
app.include_router(history_routes.router, prefix=f"{settings.API_V1_PREFIX}/history", tags=["history"])
app.include_router(document_routes.router, prefix=f"{settings.API_V1_PREFIX}/documents", tags=["documents"])


FRONTEND_BUILD_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "build")
)
FRONTEND_INDEX = os.path.join(FRONTEND_BUILD_DIR, "index.html")
FRONTEND_STATIC = os.path.join(FRONTEND_BUILD_DIR, "static")

if os.path.isdir(FRONTEND_STATIC):
    app.mount("/static", StaticFiles(directory=FRONTEND_STATIC), name="static")


@app.get("/")
async def root():
    """Serve React frontend if built, otherwise return API status"""
    if os.path.isfile(FRONTEND_INDEX):
        return FileResponse(FRONTEND_INDEX)
    return {
        "message": "Question Answering System API",
        "version": settings.VERSION,
        "docs": "/docs"
    }


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    """Serve React SPA for non-API routes when frontend build is present"""
    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(status_code=404, detail="Not Found")
    candidate = os.path.join(FRONTEND_BUILD_DIR, full_path)
    if os.path.isfile(candidate):
        return FileResponse(candidate)
    if os.path.isfile(FRONTEND_INDEX):
        return FileResponse(FRONTEND_INDEX)
    raise HTTPException(status_code=404, detail="Not Found")
