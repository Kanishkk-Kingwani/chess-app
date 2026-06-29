import chess
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/games", tags=["Games"])


def describe_outcome(board: chess.Board):
    """Look at a board and return (status, result)."""
    if board.is_checkmate():
        # The side *to move* is the one that got checkmated,
        # so the winner is the other colour.
        winner = "black" if board.turn == chess.WHITE else "white"
        return "checkmate", winner
    if board.is_stalemate():
        return "stalemate", "draw"
    if board.is_insufficient_material():
        return "draw", "draw"
    if board.is_seventyfive_moves() or board.is_fivefold_repetition():
        return "draw", "draw"
    return "ongoing", None


def to_state(game: models.Game) -> schemas.GameState:
    """Turn a database row into the full state the board page expects."""
    board = chess.Board(game.fen)
    return schemas.GameState(
        id=game.id,
        white_name=game.white_name,
        black_name=game.black_name,
        fen=game.fen,
        moves=game.moves or [],
        turn="white" if board.turn == chess.WHITE else "black",
        status=game.status,
        result=game.result,
        created_at=game.created_at,
    )


@router.post("", response_model=schemas.GameState, status_code=status.HTTP_201_CREATED)
def create_game(payload: schemas.GameCreate, db: Session = Depends(get_db)):
    """Start a brand-new game. Each call is a new row, so old games are kept."""
    game = models.Game(
        white_name=payload.white_name or "White",
        black_name=payload.black_name or "Black",
        fen=models.START_FEN,
        moves=[],
        status="ongoing",
        result=None,
    )
    db.add(game)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not create the game.")
    db.refresh(game)
    return to_state(game)


@router.get("", response_model=list[schemas.GameSummary])
def list_games(db: Session = Depends(get_db)):
    """All games that have at least one move, newest first - for the history page."""
    games = (
        db.query(models.Game)
        .order_by(models.Game.created_at.desc())
        .all()
    )
    summaries = []
    for g in games:
        plies = len(g.moves or [])
        if plies == 0:
            continue  # skip games that were created but never played
        summaries.append(
            schemas.GameSummary(
                id=g.id,
                white_name=g.white_name,
                black_name=g.black_name,
                status=g.status,
                result=g.result,
                move_count=plies,
                created_at=g.created_at,
            )
        )
    return summaries


@router.get("/{game_id}", response_model=schemas.GameState)
def get_game(game_id: str, db: Session = Depends(get_db)):
    """Load one game in full - used on refresh and to replay a past game."""
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found.")
    return to_state(game)


@router.post("/{game_id}/move", response_model=schemas.GameState)
def make_move(game_id: str, move: schemas.MoveIn, db: Session = Depends(get_db)):
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found.")
    if game.status != "ongoing":
        raise HTTPException(status_code=400, detail="This game is already finished.")

    # Rebuild the real board from the stored FEN. This is the source of truth -
    # we never trust the browser's word that a move is legal.
    board = chess.Board(game.fen)
    base_uci = f"{move.from_square}{move.to_square}"
    promotion = (move.promotion or "q").lower()  # default promotion is a queen

    try:
        candidate = chess.Move.from_uci(base_uci)
    except ValueError:
        raise HTTPException(status_code=422, detail="Move is not in a valid format.")

    # A pawn reaching the last rank needs a promotion piece attached, so if the
    # plain move isn't legal we try it again as a promotion before rejecting it.
    if candidate not in board.legal_moves:
        try:
            candidate = chess.Move.from_uci(base_uci + promotion)
        except ValueError:
            candidate = None
        if candidate is None or candidate not in board.legal_moves:
            raise HTTPException(status_code=422, detail="Illegal move.")

    san = board.san(candidate)   # standard notation, e.g. "Nf3" - read it before pushing
    board.push(candidate)

    game.fen = board.fen()
    # Reassign a brand-new list so SQLAlchemy notices the JSON column changed.
    game.moves = list(game.moves or []) + [san]
    game.status, game.result = describe_outcome(board)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not save the move. Please try again.")
    db.refresh(game)
    return to_state(game)
