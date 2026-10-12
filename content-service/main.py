from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import models, schemas, crud, security
from database import engine, get_db

# Otomatis membuat tabel courses dan materials di content_db
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="LMS Content Service", version="1.0.0")

@app.get("/")
def health_check():
    return {"status": "success", "service": "content-service"}

# Endpoint: GET /courses (Bisa diakses Admin & Siswa karena pakai 'get_current_user')
@app.get("/courses", response_model=List[schemas.CourseResponse])
def read_courses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: dict = Depends(security.get_current_user)):
    courses = crud.get_courses(db, skip=skip, limit=limit)
    return courses

# Endpoint: POST /courses (HANYA BISA diakses Admin karena pakai 'require_admin')
@app.post("/courses", response_model=schemas.CourseResponse)
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db), admin_user: dict = Depends(security.require_admin)):
    return crud.create_course(db=db, course=course)

# Endpoint: POST /courses/{id}/materials (HANYA BISA diakses Admin)
@app.post("/courses/{course_id}/materials", response_model=schemas.MaterialResponse)
def create_material_for_course(course_id: int, material: schemas.MaterialCreate, db: Session = Depends(get_db), admin_user: dict = Depends(security.require_admin)):
    # Pastikan course-nya ada sebelum menambahkan materi
    db_course = crud.get_course(db, course_id=course_id)
    if not db_course:
        raise HTTPException(status_code=404, detail="Mata pelajaran tidak ditemukan")
    
    return crud.create_material(db=db, material=material, course_id=course_id)