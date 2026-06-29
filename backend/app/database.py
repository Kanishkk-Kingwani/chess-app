import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# The database URL is read from an environment variable so the exact same code
# runs both on your laptop and on Railway/Render. If the variable isn't set,
# we fall back to a local PostgreSQL database.
#
# Format: postgresql://<user>:<password>@<host>:<port>/<database_name>
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/chess",
)


# Route any PostgreSQL URL to the psycopg (v3) driver. psycopg3 has wheels for the
# newest Python versions (including 3.14), where the older psycopg2 often doesn't.
# This also means you can write a plain "postgresql://..." URL and not worry about
# the driver suffix - we add "+psycopg" for you.
#   - Railway/Render hand out "postgres://"
#   - a plain "postgresql://" would otherwise default to psycopg2
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len("postgres://"):]
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len("postgresql://"):]

# SQLite (useful if you just want to try the app without installing Postgres)
# needs one extra flag. For Postgres this stays empty.
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency: opens a DB session for one request, then closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
