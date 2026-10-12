import os
import redis
import jwt
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

app = FastAPI(title="Leaderboard Service")
security = HTTPBearer()

# KUNCI RAHASIA (Sama dengan Auth Service)
SECRET_KEY = os.getenv("SECRET_KEY", "super_secret_key_lms")
ALGORITHM = "HS256"

# Koneksi ke Redis
REDIS_HOST = os.getenv("REDIS_HOST", "redis") # Pastikan ini sesuai dengan nama service di docker-compose
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

class ScoreData(BaseModel):
    username: str
    score: int

# Satpam JWT (Hanya dipanggil untuk rute tertentu)
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload 
    except Exception:
        raise HTTPException(status_code=401, detail="Akses ditolak: Token tidak valid atau kadaluarsa")

@app.get("/")
def health_check():
    return {"status": "success", "message": "Leaderboard Service siap!"}

# ==========================================
# RUTE PUBLIK (Bebas diakses tanpa login)
# ==========================================
@app.get("/top")
def get_top_scores(limit: int = 10):
    # ZREVRANGE mengambil skor tertinggi
    top_players = r.zrevrange("leaderboard", 0, limit - 1, withscores=True)
    
    result = [
        {"peringkat": index + 1, "username": player[0], "score": int(player[1])} 
        for index, player in enumerate(top_players)
    ]
    return {"status": "success", "data": result}

# ==========================================
# RUTE PRIVAT (Wajib menggunakan Token JWT)
# ==========================================
@app.post("/scores")
def submit_score(data: ScoreData, current_user: dict = Depends(verify_token)):
    # Rute ini sekarang terlindungi. Hanya request yang membawa Bearer Token valid yang bisa masuk.
    r.zadd("leaderboard", {data.username: data.score})
    return {"status": "success", "message": f"Skor {data.score} untuk {data.username} aman dicatat."}