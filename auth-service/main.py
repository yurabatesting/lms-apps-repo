from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware # Tambahan baru

import models, schemas, crud, security
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="LMS Auth Service", version="1.0.0")

# --- TAMBAHAN BARU: Konfigurasi CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Mengizinkan request dari semua domain/port (untuk development)
    allow_credentials=True,
    allow_methods=["*"], # Mengizinkan semua method (GET, POST, dll)
    allow_headers=["*"], # Mengizinkan semua header
)
# --------------------------------------

@app.get("/")
def health_check():
    return {"status": "success", "service": "auth-service"}

@app.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Cek apakah username sudah ada di database
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username sudah terdaftar")
    # Jika belum ada, buat user baru
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