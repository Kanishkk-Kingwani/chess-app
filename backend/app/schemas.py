from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class GameCreate(BaseModel):
    """Body for POST /games - the two player names."""
    white_name: str = "White"
    black_name: str = "Black"


class MoveIn(BaseModel):
    """Body for POST /games/{id}/move - one move, by squares."""
    from_square: str                 # e.g. "e2"
    to_square: str                   # e.g. "e4"
    promotion: Optional[str] = None  # "q", "r", "b", "n"; defaults to queen on the server


class GameState(BaseModel):
    """Full state for one game - what the board page needs to draw."""
    id: str
    white_name: str
    black_name: str
    fen: str
    moves: List[str]
    turn: str                        # "white" or "black"
    status: str                      # "ongoing" / "checkmate" / "stalemate" / "draw"
    result: Optional[str] = None     # "white" / "black" / "draw" / None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class GameSummary(BaseModel):
    """One row in the 'past games' list - metadata only, no board."""
    id: str
    white_name: str
    black_name: str
    status: str
    result: Optional[str] = None
    move_count: int                  # number of half-moves (plies) played
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
