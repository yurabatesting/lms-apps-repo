from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
import models
from database import engine, get_db

# PENTING: Baris ini akan otomatis mengecek dan membuat tabel 'users' di Postgres 
# saat aplikasi pertama kali menyala.
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="LMS Auth Service",
    description="Service untuk Autentikasi Siswa dan Admin",
    version="1.0.0"
)

@app.get("/")
def health_check():
    return {
        "status": "success",
        "message": "Auth Service is running smoothly!",
        "service": "auth-service"
    }

# Endpoint baru untuk mengetes apakah database dan tabel sudah terhubung
@app.get("/test-db")
def test_database_connection(db: Session = Depends(get_db)):
    # Menghitung jumlah user di dalam tabel (saat ini pasti masih 0)
    user_count = db.query(models.User).count()
    return {
        "status": "success", 
        "message": "Terhubung ke Database PostgreSQL!",
        "jumlah_user_saat_ini": user_count
    }