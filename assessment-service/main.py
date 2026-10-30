import os
import jwt
import requests
from fastapi import FastAPI, Depends, HTTPException, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict
from sqlalchemy import create_engine, Column, Integer, String, Text, JSON, ForeignKey, DateTime, Float
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from datetime import datetime

DATABASE_URL = os.environ["DATABASE_URL"]
SECRET_KEY = os.environ["SECRET_KEY"]
ALGORITHM = "HS256"

LEADERBOARD_SERVICE_URL = os.environ.get("LEADERBOARD_SERVICE_URL", "http://leaderboard-service:8003")
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "kunci_rahasia_internal_default")

is_dev = os.environ.get("ENVIRONMENT") == "development"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class QuizSetDB(Base):
    __tablename__ = "quiz_sets"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    course_id = Column(Integer, nullable=True)
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

if is_dev:
    Base.metadata.create_all(bind=engine)

app = FastAPI(title="Assessment Service", docs_url="/docs" if is_dev else None, redoc_url="/redoc" if is_dev else None)
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
    course_id: int 
    questions: List[QuestionTemplate]

class ScoreSubmitPayload(BaseModel):
    quiz_set_id: int
    answers: Dict[str, str]

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
    except Exception:
        raise HTTPException(status_code=401, detail="Token kadaluarsa atau tidak valid")

def verify_admin(current_user: dict = Depends(verify_token)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak")
    return current_user

@app.get("/")
def health_check():
    return {"status": "success", "message": "Assessment Service Running!"}

@app.post("/questions")
def upload_questions(payload: QuizUploadPayload, db: Session = Depends(get_db), current_user: dict = Depends(verify_admin)):
    new_quiz_set = QuizSetDB(title=payload.title, course_id=payload.course_id)
    db.add(new_quiz_set)
    db.commit()
    db.refresh(new_quiz_set) 

    added_count = 0
    for q in payload.questions:
        new_q = QuestionDB(quiz_set_id=new_quiz_set.id, no_soal=q.id, topic=q.topic, kategori=q.kategori, question=q.question, options=q.options, answer=q.answer, explanation=q.explanation)
        db.add(new_q)
        added_count += 1
            
    db.commit()
    return {"status": "success", "message": f"{added_count} soal berhasil disimpan dalam bundel '{payload.title}'"}

@app.get("/questions")
def get_all_questions(course_id: Optional[int] = None, db: Session = Depends(get_db), current_user: dict = Depends(verify_token)):
    query = db.query(QuizSetDB)
    if course_id is not None:
        query = query.filter(QuizSetDB.course_id == course_id)
        
    quiz_sets = query.all()
    result = []
    
    for qs in quiz_sets:
        safe_questions = []
        for q in qs.questions:
            safe_questions.append({"id": q.id, "no_soal": q.no_soal, "topic": q.topic, "kategori": q.kategori, "question": q.question, "options": q.options})
        result.append({"id": qs.id, "title": qs.title, "course_id": qs.course_id, "questions": safe_questions})
        
    return {"status": "success", "data": result}

@app.post("/scores")
def submit_score(request: Request, payload: ScoreSubmitPayload, db: Session = Depends(get_db), current_user: dict = Depends(verify_token)):
    username = current_user.get("sub", "Anonymous")
    role = current_user.get("role", "siswa") 

    quiz_set = db.query(QuizSetDB).filter(QuizSetDB.id == payload.quiz_set_id).first()
    if not quiz_set:
        raise HTTPException(status_code=404, detail="Kuis tidak ditemukan")
        
    questions = db.query(QuestionDB).filter(QuestionDB.quiz_set_id == payload.quiz_set_id).all()
    total_questions = len(questions)
    correct_count = 0
    review_data = [] 
    
    for q in questions:
        user_answer = payload.answers.get(str(q.id))
        is_correct = (user_answer == q.answer)
        if is_correct: correct_count += 1
        review_data.append({"question_id": q.id, "question": q.question, "user_answer": user_answer, "correct_answer": q.answer, "is_correct": is_correct, "explanation": q.explanation})
            
    final_score = (correct_count / total_questions) * 100.0

    if role == "admin":
        return {
            "status": "success", 
            "message": "Uji Coba Selesai! (Mode Admin: Nilai tidak dimasukkan ke dalam sistem)",
            "data": {"quiz_title": quiz_set.title, "score": final_score, "correct_count": correct_count, "total_questions": total_questions, "review": review_data}
        }
    
    new_score = ScoreDB(username=username, quiz_title=quiz_set.title, score=final_score, correct_count=correct_count, total_questions=total_questions)
    db.add(new_score)
    db.commit()
    db.refresh(new_score)

    auth_header = request.headers.get("Authorization")
    if auth_header:
        try:
            requests.post(
                f"{LEADERBOARD_SERVICE_URL}/scores",
                json={"username": username, "score": int(final_score), "quiz_title": quiz_set.title},
                headers={"Authorization": auth_header, "X-Internal-Token": INTERNAL_API_KEY},
                timeout=2.0
            )
        except requests.exceptions.RequestException:
            pass

    return {"status": "success", "message": "Ujian selesai diperiksa!", "data": {"quiz_title": quiz_set.title, "score": final_score, "correct_count": correct_count, "total_questions": total_questions, "review": review_data}}

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
    return {"status": "success", "message": f"{deleted_count} riwayat dihapus"}

@app.get("/questions/course/{course_id}")
def get_questions_by_course(course_id: int, db: Session = Depends(get_db), current_user: dict = Depends(verify_token)):
    quiz_sets = db.query(QuizSetDB).filter(QuizSetDB.course_id == course_id).all()
    result = []
    for qs in quiz_sets:
        safe_questions = []
        for q in qs.questions:
            safe_questions.append({"id": q.id, "no_soal": q.no_soal, "topic": q.topic, "kategori": q.kategori, "question": q.question, "options": q.options})
        result.append({"id": qs.id, "title": qs.title, "course_id": qs.course_id, "questions": safe_questions})
    return {"status": "success", "data": result}

@app.post("/sync-leaderboard")
def sync_leaderboard(request: Request, db: Session = Depends(get_db), admin_user: dict = Depends(verify_admin)):
    # PERBAIKAN: Pembersihan Otomatis ditambahkan ke skrip ini
    admin_username = admin_user.get("sub", "admin")
    
    db.query(ScoreDB).filter(ScoreDB.username == admin_username).delete()
    db.commit()
    
    auth_header = request.headers.get("Authorization")
    
    try:
        requests.delete(
            f"{LEADERBOARD_SERVICE_URL}/scores/user/{admin_username}",
            headers={"Authorization": auth_header},
            timeout=2.0
        )
    except:
        pass

    scores = db.query(ScoreDB).all()
    success_count = 0
    failed_count = 0
    
    for s in scores:
        try:
            res = requests.post(
                f"{LEADERBOARD_SERVICE_URL}/scores",
                json={"username": s.username, "score": int(s.score), "quiz_title": s.quiz_title},
                headers={"Authorization": auth_header, "X-Internal-Token": INTERNAL_API_KEY},
                timeout=1.0 
            )
            if res.status_code == 200:
                success_count += 1
            else:
                failed_count += 1
        except requests.exceptions.RequestException:
            failed_count += 1
            
    return {
        "status": "success",
        "message": "Operasi sinkronisasi dan pembersihan selesai",
        "data": {
            "total_data_postgres": len(scores),
            "berhasil_dikirim": success_count,
            "gagal_dikirim": failed_count
        }
    }