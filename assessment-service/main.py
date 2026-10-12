from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

app = FastAPI(title="Assessment Service")

# 1. Mengunci Template JSON menggunakan Pydantic Model
class QuestionTemplate(BaseModel):
    id: int
    topic: str
    kategori: str
    question: str
    options: List[str]
    answer: str
    explanation: str

# Database sementara (In-Memory) sebelum kita hubungkan ke PostgreSQL
db_soal = []

# 2. Rute Health Check (Untuk memastikan service menyala)
@app.get("/")
def health_check():
    return {
        "status": "success", 
        "message": "Assessment Service is running smoothly!", 
        "service": "assessment-service"
    }

# 3. Rute untuk Admin MENGUNGGAH Soal (Menerima array JSON)
@app.post("/api/assessment/questions")
def upload_questions(questions: List[QuestionTemplate]):
    # Menambahkan soal baru ke database sementara kita
    db_soal.extend(questions)
    return {
        "status": "success",
        "message": f"{len(questions)} soal berhasil diunggah!",
        "total_soal_tersimpan": len(db_soal)
    }

# 4. Rute untuk Siswa/Sistem MENGAMBIL Soal
@app.get("/api/assessment/questions")
def get_all_questions():
    return {
        "status": "success",
        "data": db_soal
    }