import os
import redis
import jwt
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

app = FastAPI(title="Leaderboard Service")
security = HTTPBearer()

SECRET_KEY = os.getenv("SECRET_KEY", "super_secret_key_lms")
ALGORITHM = "HS256"

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

# TAMBAHAN: Menerima parameter quiz_title
class ScoreData(BaseModel):
    username: str
    score: int
    quiz_title: str 

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload 
    except Exception:
        raise HTTPException(status_code=401, detail="Akses ditolak: Token tidak valid")

@app.get("/")
def health_check():
    return {"status": "success", "message": "Leaderboard Service siap!"}

@app.get("/top")
def get_top_scores(limit: int = 20):
    top_players = r.zrevrange("leaderboard", 0, limit - 1, withscores=True)
    
    result = []
    for index, player in enumerate(top_players):
        # player[0] berisi string gabungan "username::quiz_title"
        # player[1] berisi skor
        member_data = player[0].split("::")
        username = member_data[0]
        quiz_title = member_data[1] if len(member_data) > 1 else "Kuis Umum"
        
        result.append({
            "id": index + 1, 
            "username": username,
            "quiz_title": quiz_title,
            "score": int(player[1])
        })
        
    return {"status": "success", "data": result}

@app.post("/scores")
def submit_score(data: ScoreData, current_user: dict = Depends(verify_token)):
    # Menggabungkan data menjadi satu string unik sebelum dilempar ke memori Redis
    member_id = f"{data.username}::{data.quiz_title}"
    r.zadd("leaderboard", {member_id: data.score})
    return {"status": "success", "message": "Skor live berhasil diperbarui!"}