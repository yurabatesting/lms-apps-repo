import os
import jwt
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy import create_engine, Column, Integer, String, Text, JSON, ForeignKey, DateTime, Float
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://lms_admin:secretpassword@postgres:5432/assessment_db")
SECRET_KEY = os.getenv("SECRET_KEY", "super_secret_key_lms")
ALGORITHM = "HS256"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class QuizSetDB(Base):
    __tablename__ = "quiz_sets"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    course_id = Column(Integer, nullable=True) # <--- TAMBAHAN BARU
    created_at = Column(DateTime, default=datetime.utcnow)
    
    questions = relationship("QuestionDB", back_populates="quiz_set", cascade="all, delete-orphan")

class QuestionDB(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True) 
    quiz_set_id = Column(Integer, ForeignKey("quiz_sets.id"))
    no_soal = Column(Integer) 
    topic = Column(String)
    kategori = Column(String)
    question = Column(Text)
    options = Column(JSON)
    answer = Column(String)
    explanation = Column(Text)

    quiz_set = relationship("QuizSetDB", back_populates="questions")

class ScoreDB(Base):
    __tablename__ = "scores"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    quiz_title = Column(String)
    score = Column(Float) 
    correct_count = Column(Integer)
    total_questions = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Assessment Service")
security = HTTPBearer()

class QuestionTemplate(BaseModel):
    id: int 
    topic: str
    kategori: str
    question: str
    options: List[str]
    answer: str
    explanation: str

class QuizUploadPayload(BaseModel):
    title: str
    course_id: int # <--- TAMBAHAN BARU
    questions: List[QuestionTemplate]

class ScoreSubmitPayload(BaseModel):
    quiz_title: str
    score: float
    correct_count: int
    total_questions: int

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token kadaluarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")

def verify_admin(current_user: dict = Depends(verify_token)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak")
    return current_user

@app.get("/")
def health_check():
    return {"status": "success", "message": "Assessment Service Running!"}

@app.post("/questions")
def upload_questions(payload: QuizUploadPayload, db: Session = Depends(get_db), current_user: dict = Depends(verify_admin)):
    # Simpan course_id ke database
    new_quiz_set = QuizSetDB(title=payload.title, course_id=payload.course_id)
    db.add(new_quiz_set)
    db.commit()
    db.refresh(new_quiz_set) 

    added_count = 0
    for q in payload.questions:
        new_q = QuestionDB(
            quiz_set_id=new_quiz_set.id,
            no_soal=q.id, 
            topic=q.topic,
            kategori=q.kategori,
            question=q.question,
            options=q.options,
            answer=q.answer,
            explanation=q.explanation
        )
        db.add(new_q)
        added_count += 1
            
    db.commit()
    return {"status": "success", "message": f"{added_count} soal berhasil disimpan dalam bundel '{payload.title}'"}

# --- ENDPOINT GET DIPERBARUI UNTUK MENERIMA FILTER course_id ---
@app.get("/questions")
def get_all_questions(course_id: Optional[int] = None, db: Session = Depends(get_db), current_user: dict = Depends(verify_token)):
    query = db.query(QuizSetDB)
    
    # Jika frontend mengirim course_id di URL, saring datanya
    if course_id is not None:
        query = query.filter(QuizSetDB.course_id == course_id)
        
    quiz_sets = query.all()
    result = []
    
    for qs in quiz_sets:
        result.append({
            "id": qs.id,
            "title": qs.title,
            "course_id": qs.course_id,
            "questions": qs.questions
        })
        
    return {"status": "success", "data": result}

@app.post("/scores")
def submit_score(payload: ScoreSubmitPayload, db: Session = Depends(get_db), current_user: dict = Depends(verify_token)):
    username = current_user.get("sub", "Anonymous")
    new_score = ScoreDB(username=username, quiz_title=payload.quiz_title, score=payload.score, correct_count=payload.correct_count, total_questions=payload.total_questions)
    db.add(new_score)
    db.commit()
    return {"status": "success", "message": "Skor berhasil disimpan!"}

@app.get("/scores")
def get_leaderboard(db: Session = Depends(get_db)):
    scores = db.query(ScoreDB).order_by(ScoreDB.score.desc()).limit(20).all()
    result = [{"id": s.id, "username": s.username, "quiz_title": s.quiz_title, "score": s.score, "correct_count": s.correct_count, "total_questions": s.total_questions, "created_at": s.created_at} for s in scores]
    return {"status": "success", "data": result}

@app.get("/scores/history")
def get_my_score_history(db: Session = Depends(get_db), current_user: dict = Depends(verify_token)):
    username = current_user.get("sub")
    history = db.query(ScoreDB).filter(ScoreDB.username == username).order_by(ScoreDB.created_at.asc()).all()
    result = [{"id": s.id, "quiz_title": s.quiz_title, "score": s.score, "date": s.created_at.strftime("%d %b %Y, %H:%M")} for s in history]
    return {"status": "success", "data": result}

@app.delete("/scores/user/{username}")
def delete_user_scores(username: str, db: Session = Depends(get_db), current_user: dict = Depends(verify_admin)):
    deleted_count = db.query(ScoreDB).filter(ScoreDB.username == username).delete()
    db.commit()
    return {"status": "success", "message": f"{deleted_count} riwayat nilai milik {username} telah dihapus"}

# --- ENDPOINT BARU: Path Parameter anti-potong API Gateway ---
@app.get("/questions/course/{course_id}")
def get_questions_by_course(course_id: int, db: Session = Depends(get_db), current_user: dict = Depends(verify_token)):
    # Langsung filter secara tegas berdasarkan course_id
    quiz_sets = db.query(QuizSetDB).filter(QuizSetDB.course_id == course_id).all()

    result = []
    for qs in quiz_sets:
        result.append({
            "id": qs.id,
            "title": qs.title,
            "course_id": qs.course_id,
            "questions": qs.questions
        })

    return {"status": "success", "data": result}