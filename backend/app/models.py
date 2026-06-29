import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base

# The standard starting position of a chess game, in FEN notation.
START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def new_id() -> str:
    """A short, hard-to-guess game/session id (32 hex chars)."""
    return uuid.uuid4().hex


class Game(Base):
    __tablename__ = "games"

    # Session id: the frontend stores this in localStorage and uses it to
    # reload the right game after a refresh.
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)

    white_name: Mapped[str] = mapped_column(String, default="White")
    black_name: Mapped[str] = mapped_column(String, default="Black")

    # The whole board state, as one FEN string.
    fen: Mapped[str] = mapped_column(Text, default=START_FEN)

    # Moves played so far, in standard notation, e.g. ["e4", "e5", "Nf3"].
    moves: Mapped[list] = mapped_column(JSON, default=list)

    # "ongoing", "checkmate", "stalemate", or "draw".
    status: Mapped[str] = mapped_column(String, default="ongoing")

    # "white", "black", "draw", or None while the game is still going.
    result: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
