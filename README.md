# Knight & Day - Two-Player Chess

A local two-player chess game you run in the browser. Two people play on the same
screen, every move is validated and saved on the server, and finished games are kept
so you can replay them move by move afterwards.

The game state is persisted on every move, so a browser refresh - or closing the tab
entirely - resumes exactly where you left off.

## Features

- **Human vs human** on one screen, with the board facing whoever is on the move.
- **Full rules** - legal moves, check, checkmate, stalemate, and draws, validated on
  both the client and the server.
- **State persistence** - every move is saved; refresh or reopen and the game is restored.
- **Move list / scoresheet** in standard algebraic notation.
- **Captured pieces** for each side with a running material score.
- **Move guidance** - legal-move dots when you pick up a piece, and highlights for the
  last move played and a king in check.
- **Past games + replay** - every finished game is saved; open it later and step through
  it with ◀ ▶ (or the arrow keys), or click any move to jump to that position.
- **Sound effects** for moves, captures, check, and game end (generated in-browser, no audio files).
- **Light / dark theme** that follows your operating system by default, with a manual toggle.

## Tech stack

**Frontend** - HTML, CSS, vanilla JavaScript (no framework, no build step)
- [chessboard.js 1.0.0](https://chessboardjs.com) - board rendering and drag & drop (requires jQuery 3.5.1)
- [chess.js 0.10.3](https://github.com/jhlywa/chess.js) - in-browser legal-move validation
- Web Audio API for sound

**Backend** - FastAPI (Python)
- [python-chess 1.11.2](https://python-chess.readthedocs.io) - server-side move validation (the source of truth)
- SQLAlchemy 2.0 + PostgreSQL - game storage

All frontend libraries load from a CDN, so there is nothing to install for the frontend.

## How it works

**Persistence.** Each game is one row in a `games` table. The board is stored as a single
**FEN** string plus the list of moves in algebraic notation. Opening the board page reads
the game id from `localStorage`, calls `GET /games/{id}`, and rebuilds the board from the
FEN the server returns.

**Validation happens twice.** chess.js checks moves in the browser for instant feedback,
then the move is sent to the backend where python-chess re-validates it against the stored
position before saving. The browser is never trusted on its own.

**Replay** is reconstructed on the frontend: given a saved game's move list, each position
is rebuilt by replaying the moves through chess.js, so stepping forward and back is just
moving an index through that list of positions.

## Project structure

```
chess-app/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, router registration
│   │   ├── database.py        # DB connection (reads DATABASE_URL)
│   │   ├── models.py          # the Game table
│   │   ├── schemas.py         # request/response models
│   │   └── routers/
│   │       └── games.py       # create / list / get / move endpoints
│   └── requirements.txt
└── frontend/
    ├── index.html             # main menu
    ├── game.html              # the live game board
    ├── history.html           # list of past games
    ├── analysis.html          # move-by-move replay
    ├── css/style.css
    └── js/
        ├── config.js          # <-- backend URL goes here
        ├── theme.js           # light/dark handling (shared)
        ├── menu.js
        ├── game.js
        ├── history.js
        └── analysis.js
```

## API reference

| Method | Path                | Purpose                                            |
|--------|---------------------|----------------------------------------------------|
| POST   | `/games`            | create a new game; returns its id and state        |
| GET    | `/games`            | list past games (metadata) for the history page    |
| GET    | `/games/{id}`       | load one game in full (refresh + replay)           |
| POST   | `/games/{id}/move`  | play a move `{from_square, to_square, promotion?}` |

---

## Getting started

### Prerequisites

- **Python** (3.11+; works on 3.14)
- **PostgreSQL**, with a database named `chess`
- A modern web browser

### 1. Backend

**Create and activate a virtual environment**

```bash
cd backend
```

Windows (PowerShell):
```powershell
python -m venv venv
venv\Scripts\Activate
```

Windows (Command Prompt):
```bat
python -m venv venv
venv\Scripts\activate.bat
```

macOS / Linux:
```bash
python3 -m venv venv
source venv/bin/activate
```

Your prompt should now begin with `(venv)`.

**Install dependencies**

```bash
pip install -r requirements.txt
```

**Point the app at your database** (use your own Postgres password):

Windows (Command Prompt):
```bat
set DATABASE_URL=postgresql://postgres:YOURPASSWORD@localhost:5432/chess
```

Windows (PowerShell):
```powershell
$env:DATABASE_URL = "postgresql://postgres:YOURPASSWORD@localhost:5432/chess"
```

macOS / Linux:
```bash
export DATABASE_URL="postgresql://postgres:YOURPASSWORD@localhost:5432/chess"
```

> **Notes**
> - This variable lasts only for the current terminal window - set it again in a new window.
> - If your password contains special characters, URL-encode them (for example `#` → `%23`).
> - No Postgres handy? Use `sqlite:///./chess.db` as the `DATABASE_URL` instead and skip Postgres entirely.

**Run the server**

```bash
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000 - you should see `{"status":"ok", ...}`. The `games` table is
created automatically on first run.

### 2. Frontend

The frontend is served separately from the backend. Keep the backend running, then in a
**second terminal**:

```bash
cd frontend
python -m http.server 5500
```

Open http://127.0.0.1:5500. (The frontend needs no venv and no installs.)

`frontend/js/config.js` must point at your backend - `http://127.0.0.1:8000` for local play.
The page on port 5500 makes its API calls to the backend on port 8000.

---

## Deployment (frontend on Vercel, backend on Render)

The frontend and backend deploy to two different hosts, so they live at two URLs. The
frontend calls the backend via the URL set in `frontend/js/config.js`.

**Backend on Render**

1. Render -> New -> PostgreSQL. Copy its **Internal Database URL**.
2. Render -> New -> Web Service, connect the repo, and set:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment variable:** `DATABASE_URL` = the Internal Database URL from step 1
3. Deploy. Render gives you a URL like `https://chess-xyz.onrender.com`. Opening it should
   show `{"status":"ok", ...}`.

**Point the frontend at the backend**

Edit `frontend/js/config.js` and set `API_BASE` to your Render URL (no trailing slash):

```js
const API_BASE = "https://chess-xyz.onrender.com";
```

Commit and push.

**Frontend on Vercel**

1. vercel.com -> New Project -> import the repo.
2. Set **Root Directory** to `frontend`.
3. Framework preset: **Other** (plain static files, no build step).
4. Deploy. Vercel gives you a URL like `https://chess-xyz.vercel.app`.

(Vercel serves the `frontend` folder directly, so no folder rename is needed.)

**Keep the backend awake (cron job)**

Render's free web service sleeps after about 15 minutes of inactivity, which causes a
30-50 second delay on the first request. To avoid that, set up a free uptime pinger
(for example cron-job.org or UptimeRobot) to send a GET request to your backend health
URL `https://chess-xyz.onrender.com/` every 5 minutes.

Notes:
- CORS is already permissive (`allow_origins=["*"]`), so cross-origin calls are allowed.
- Both hosts are HTTPS, so there is no mixed-content blocking.
- The cron job keeps the service awake; it does not stop Render's free PostgreSQL from
  expiring after roughly 30 days, so treat the free database as temporary.

---

## Notes

- **Promotion** currently auto-promotes pawns to a **queen**. The server already accepts any
  promotion piece, so a chooser is a frontend-only addition.
- The board **auto-flips** to face the player on the move during a game, and stops flipping
  once the game ends so the final position stays in a natural orientation.
- The project uses **psycopg3** (`psycopg[binary]`), which installs cleanly on modern Python
  including 3.14, where the older `psycopg2-binary` can fail with a `DLL load failed` error.
  You can write a plain `postgresql://...` URL - the app routes it to psycopg3 for you.
