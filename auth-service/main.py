import os # Pastikan os sudah di-import di bagian atas
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.sql import text # Tambahkan import ini di bagian atas
from fastapi.middleware.cors import CORSMiddleware # Tambahan baru

import models, schemas, crud, security
from database import engine, get_db

from typing import List

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="LMS Auth Service", version="1.0.0")


# Membaca ALLOWED_ORIGINS dari env, fallback ke localhost demi keamanan
allowed_origins_str = os.environ.get("ALLOWED_ORIGINS", "http://localhost")
origins = allowed_origins_str.split(",")
# --- TAMBAHAN BARU: Konfigurasi CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # <-- Kini aman dan bersifat dinamis
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --------------------------------------

@app.get("/")
def health_check(db: Session = Depends(get_db)):
    try:
        # Melakukan ping ringan ke database
        db.execute(text("SELECT 1"))
        return {"status": "success", "service": "auth-service", "database": "connected"}
    except Exception as e:
        # Jika database terputus, lempar HTTP 500 agar GKE me-restart container
        raise HTTPException(status_code=500, detail="Database connection failed")

@app.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Cek apakah username sudah ada di database
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username sudah terdaftar")
    
    # KEAMANAN EKSTRA: Paksa role menjadi 'siswa' jika mendaftar dari jalur publik
    user.role = "siswa"
    return crud.create_user(db=db, user=user)

@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Cari user berdasarkan username
    user = crud.get_user_by_username(db, username=form_data.username)
    
    # Validasi user ada ATAU password cocok dengan hash di database
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Jika lolos, buatkan JWT (menitipkan identitas username dan role di dalam token)
    access_token = security.create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    return {"access_token": access_token, "token_type": "bearer"}

# ==========================================
# RUTE KHUSUS ADMIN
# ==========================================

@app.get("/users", response_model=List[schemas.UserResponse])
def get_all_users_admin(db: Session = Depends(get_db), admin_user: dict = Depends(security.require_admin)):
    """Mengambil daftar semua pengguna (Hanya Admin)"""
    return crud.get_all_users(db)

@app.post("/users", response_model=schemas.UserResponse)
def create_user_admin(user: schemas.UserCreate, db: Session = Depends(get_db), admin_user: dict = Depends(security.require_admin)):
    """Membuat pengguna baru dengan role bebas (Hanya Admin)"""
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username sudah terdaftar")
    return crud.create_user(db=db, user=user)


@app.delete("/users/{user_id}")
def delete_user_admin(user_id: int, db: Session = Depends(get_db), admin_user: dict = Depends(security.require_admin)):
    """Menghapus pengguna berdasarkan ID (Hanya Admin)"""
    user_to_delete = db.query(models.User).filter(models.User.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    
    # Keamanan ekstra: Cegah admin menghapus dirinya sendiri
    if user_to_delete.username == admin_user.get("username"):
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun Anda sendiri yang sedang aktif")

    crud.delete_user(db, user_id)
    return {"status": "success", "message": f"User {user_to_delete.username} berhasil dihapus dari sistem"}