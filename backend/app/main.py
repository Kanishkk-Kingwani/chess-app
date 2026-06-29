from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .database import engine
from .routers import games

# Create database tables on startup if they don't exist yet.
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Knight and Day - Chess")

# CORS lets the frontend (served from a different origin, e.g. GitHub Pages or a
# local file server) call this API. "*" is fine for a student project.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(games.router)


@app.get("/")
def health():
    return {"status": "ok", "message": "Chess backend is running"}
