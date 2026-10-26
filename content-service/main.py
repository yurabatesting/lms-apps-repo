import os
import shutil
import uuid
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from security import get_current_user
from sqlalchemy.orm import Session
from typing import List

import models, schemas, crud, security
from database import engine, get_db

# Cek apakah ini lingkungan development
is_dev = os.environ.get("ENVIRONMENT") == "development"

app = FastAPI(title="LMS Content Service", 
              version="1.0.0",
              docs_url="/docs" if is_dev else None,
              redoc_url="/redoc" if is_dev else None)

# --- LANGKAH 2: Sabuk Pengaman Database ---
if is_dev:
    print("⚙️ Mode DEVELOPMENT: Membuat tabel database otomatis...", flush=True)
    models.Base.metadata.create_all(bind=engine)
else:
    print("🛡️ Mode PRODUCTION: Eksekusi create_all dilewati.", flush=True)

# --- TAMBAHAN BARU: Menyiapkan Folder Upload ---
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# # Membuat endpoint agar file PDF bisa diakses langsung via URL
# app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
# # ----------------------------------------------

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
    # Jika Admin mengunggah file PDF
    if file:
        # --- 1. VALIDASI LAPIS PERTAMA: MIME Type ---
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Tipe file ditolak. Hanya menerima PDF.")
            
        # --- 2. VALIDASI LAPIS KEDUA: Magic Bytes ---
        # Membaca 5 byte pertama untuk memastikan struktur asli file adalah PDF
        file_header = file.file.read(5)
        if file_header != b"%PDF-":
            raise HTTPException(status_code=400, detail="Isi file palsu terdeteksi (spoofing ekstensi).")
            
        # Kembalikan 'kursor' pembacaan file ke titik 0 agar file tidak rusak saat disimpan
        file.file.seek(0)
        
        # --- 3. PROSES PENYIMPANAN NORMAL ---
        unique_filename = f"{uuid.uuid4()}.pdf" # Langsung tembak .pdf karena sudah tervalidasi
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # URL ini akan merujuk ke API Gateway -> Content Service -> /download/
        final_content = f"/api/content/download/{unique_filename}"
    
    # Bungkus kembali menjadi format schema
    material_data = schemas.MaterialCreate(title=title, content=final_content)
    
    return crud.create_material(db=db, material=material_data, course_id=course_id)

# --- ENDPOINT UNDUH DOKUMEN MATERI ---
@app.get("/download/{filename}")
async def download_secure_file(
    filename: str, 
    current_user: dict = Depends(get_current_user) # <-- Kunci utamanya di sini
):
    """
    Endpoint aman untuk mengunduh file. 
    Hanya bisa diakses jika menyertakan Token JWT yang valid.
    """
    # Untuk saat ini masih mengarah ke folder lokal (akan diubah ke GCS di Langkah 5)
    file_path = f"uploads/{filename}"
    
    # Cek apakah file benar-benar ada di server
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File PDF tidak ditemukan")
        
    # Kembalikan file ke client
    return FileResponse(
        path=file_path, 
        media_type='application/pdf', 
        filename=filename
    )