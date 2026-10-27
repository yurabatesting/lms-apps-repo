import os
import redis
import jwt
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

app = FastAPI(title="Leaderboard Service")
security = HTTPBearer()

SECRET_KEY = os.getenv("SECRET_KEY", "super_secret_key_lms")
ALGORITHM = "HS256"

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
# --- TAMBAHAN BARU: Membaca Password Redis dari Environment ---
# Nilai default adalah None, sehingga aman untuk development lokal
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

# Inisialisasi koneksi Redis dengan injeksi password dinamis
r = redis.Redis(
    host=REDIS_HOST, 
    port=REDIS_PORT, 
    password=REDIS_PASSWORD, # Akan menggunakan AUTH jika diisi (GCP), atau diabaikan jika None (Lokal)
    decode_responses=True
)

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

# --- FUNGSI KEAMANAN BARU (SERVICE-TO-SERVICE) ---
def verify_internal_service(x_internal_token: str = Header(None)):
    """Validasi bahwa yang memanggil adalah sesama Microservice internal"""
    if not x_internal_token or x_internal_token != SECRET_KEY:
        raise HTTPException(status_code=403, detail="Akses Ditolak: Hanya jalur komunikasi internal yang diizinkan")
    return True
# -------------------------------------------------

@app.get("/")
def health_check():
    return {"status": "success", "message": "Leaderboard Service siap!"}

@app.get("/top")
def get_top_scores(limit: int = 20, quiz_title: str = None): 
    redis_key = f"leaderboard:{quiz_title}" if quiz_title else "leaderboard"
    top_players = r.zrevrange(redis_key, 0, limit - 1, withscores=True)
    
    result = []
    for index, player in enumerate(top_players):
        member_data = player[0].split("::")
        username = member_data[0]
        player_quiz_title = member_data[1] if len(member_data) > 1 else "Kuis Umum"
        
        result.append({
            "id": index + 1, 
            "username": username,
            "quiz_title": player_quiz_title,
            "score": int(player[1])
        })
        return {"status": "success", "data": result}

@app.post("/scores")
def submit_score(data: ScoreData, is_internal: bool = Depends(verify_internal_service)):
    member_id = f"{data.username}::{data.quiz_title}"
    
    # 1. Simpan ke Global Leaderboard (Hanya jika skor baru LEBIH BESAR dari skor lama)
    r.zadd("leaderboard", mapping={member_id: data.score}, gt=True)
    
    # 2. Simpan ke Quiz-Specific Leaderboard (Hanya jika skor baru LEBIH BESAR dari skor lama)
    specific_key = f"leaderboard:{data.quiz_title}"
    r.zadd(specific_key, mapping={member_id: data.score}, gt=True)
    
    return {"status": "success", "message": "Skor live diproses secara internal!"}

@app.delete("/scores/user/{username}")
def delete_user_from_leaderboard(username: str, current_user: dict = Depends(verify_token)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Hanya Admin yang dapat menghapus data leaderboard")

    deleted_count = 0
    # Karena keyspace sekarang dinamis, kita harus menyapu (scan) semua key berawalan "leaderboard"
    for key in r.scan_iter("leaderboard*"):
        members = r.zrange(key, 0, -1)
        for member in members:
            # Hapus jejak user di keranjang global maupun spesifik
            if member.startswith(f"{username}::"):
                r.zrem(key, member)
                deleted_count += 1
            
    return {"status": "success", "message": f"{deleted_count} rekaman Redis milik {username} dihapus."}