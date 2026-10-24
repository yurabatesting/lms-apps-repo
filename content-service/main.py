import os
import shutil
import uuid
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List

import models, schemas, crud, security
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="LMS Content Service", version="1.0.0")

# --- TAMBAHAN BARU: Menyiapkan Folder Upload ---
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Membuat endpoint agar file PDF bisa diakses langsung via URL
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
# ----------------------------------------------

@app.get("/")
def health_check():
    return {"status": "success", "service": "content-service"}

@app.get("/courses", response_model=List[schemas.CourseResponse])
def read_courses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: dict = Depends(security.get_current_user)):
    return crud.get_courses(db, skip=skip, limit=limit)

@app.post("/courses", response_model=schemas.CourseResponse)
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db), admin_user: dict = Depends(security.require_admin)):
    return crud.create_course(db=db, course=course)

# --- ENDPOINT UPLOAD MATERI DIPERBARUI ---
@app.post("/courses/{course_id}/materials", response_model=schemas.MaterialResponse)
def create_material_for_course(
    course_id: int, 
    title: str = Form(...),            # Menerima judul via Form Data
    file: UploadFile = File(None),     # Menerima file PDF
    content_text: str = Form(""),      # Opsional jika hanya teks
    db: Session = Depends(get_db), 
    admin_user: dict = Depends(security.require_admin)
):
    db_course = crud.get_course(db, course_id=course_id)
    if not db_course:
        raise HTTPException(status_code=404, detail="Mata pelajaran tidak ditemukan")
    
    final_content = content_text

    # Jika Admin mengunggah file PDF
    if file:
        # 1. Bikin nama file unik agar tidak bentrok (misal: 550e8400...pdf)
        file_extension = file.filename.split(".")[-1]
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # 2. Simpan file secara fisik ke folder lokal
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 3. Simpan URL path-nya ke database
        # URL ini akan merujuk ke API Gateway -> Content Service -> /uploads/
        final_content = f"/api/content/uploads/{unique_filename}"
    
    # Bungkus kembali menjadi format schema
    material_data = schemas.MaterialCreate(title=title, content=final_content)
    
    return crud.create_material(db=db, material=material_data, course_id=course_id)