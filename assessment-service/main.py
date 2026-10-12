import os
import jwt
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List
from sqlalchemy import create_engine, Column, Integer, String, Text, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# 1. Konfigurasi Koneksi PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://lms_admin:secretpassword@postgres:5432/assessment_db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 2. Skema Tabel Database (Menggunakan tipe data JSON untuk options)
class QuestionDB(Base):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, index=True)
    kategori = Column(String)
    question = Column(Text)
    options = Column(JSON) # Array pilihan akan disimpan utuh sebagai JSON
    answer = Column(String)
    explanation = Column(Text)

# Perintah otomatis membuat tabel saat aplikasi menyala
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Assessment Service")

# 3. Model Validasi JSON (Sesuai format ketat Anda)
class QuestionTemplate(BaseModel):
    id: int
    topic: str
    kategori: str
    question: str
    options: List[str]
    answer: str
    explanation: str

# Fungsi bantuan untuk membuka dan menutup koneksi database
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



app = FastAPI(title="Assessment Service")
security = HTTPBearer()

# KUNCI RAHASIA (Harus sama persis dengan yang ada di Auth Service)
SECRET_KEY = os.getenv("SECRET_KEY", "super_secret_key_lms")
ALGORITHM = "HS256"

# Fungsi untuk memvalidasi Token JWT secara mandiri
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload # Berisi data user, misalnya {"username": "admin", "role": "admin"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token sudah kadaluarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")

# Fungsi khusus untuk mengecek apakah user adalah Admin
def verify_admin(current_user: dict = Depends(verify_token)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak: Hanya Admin yang bisa mengunggah soal")
    return current_user

@app.get("/")
def health_check():
    return {
        "status": "success", 
        "message": "Assessment Service + PostgreSQL is running smoothly!", 
        "service": "assessment-service"
    }

# 4. Rute Admin Upload Soal (Simpan Permanen)
@app.post("/questions")
def upload_questions(questions: List[QuestionTemplate], db: Session = Depends(get_db)):
    added_count = 0
    for q in questions:
        # Pengecekan agar tidak ada ID soal yang duplikat (ter-insert 2 kali)
        existing_q = db.query(QuestionDB).filter(QuestionDB.id == q.id).first()
        if not existing_q:
            new_q = QuestionDB(
                id=q.id,
                topic=q.topic,
                kategori=q.kategori,
                question=q.question,
                options=q.options,  # Disimpan utuh sebagai list/JSON
                answer=q.answer,
                explanation=q.explanation
            )
            db.add(new_q)
            added_count += 1
            
    db.commit() # Simpan permanen ke disk
    return {
        "status": "success",
        "message": f"{added_count} soal baru berhasil disimpan permanen ke database PostgreSQL."
    }

# 5. Rute Siswa Mengambil Soal
@app.get("/questions")
def get_all_questions(db: Session = Depends(get_db)):
    questions = db.query(QuestionDB).all()
    return {
        "status": "success",
        "data": questions
    }