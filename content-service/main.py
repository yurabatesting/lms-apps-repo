import os
import shutil
import uuid
from datetime import timedelta
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List

import models, schemas, crud, security
from database import engine, get_db
from security import get_current_user

# Cek apakah ini lingkungan development
is_dev = os.environ.get("ENVIRONMENT") == "development"

# Saklar Mode Storage (default ke 'local' jika tidak diisi)
STORAGE_MODE = os.environ.get("STORAGE_MODE", "local").lower()
GCP_BUCKET_NAME = os.environ.get("GCP_BUCKET_NAME", "bucket-dummy-sementara")

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
    return {"status": "success", "service": "content-service", "storage_mode": STORAGE_MODE}

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
    title: str = Form(...),
    file: UploadFile = File(None),
    content_text: str = Form(""),
    db: Session = Depends(get_db), 
    admin_user: dict = Depends(security.require_admin)
):
    db_course = crud.get_course(db, course_id=course_id)
    if not db_course:
        raise HTTPException(status_code=404, detail="Mata pelajaran tidak ditemukan")
    
    final_content = content_text

    if file:
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Tipe file ditolak. Hanya menerima PDF.")
        file_header = file.file.read(5)
        if file_header != b"%PDF-":
            raise HTTPException(status_code=400, detail="Isi file palsu terdeteksi (spoofing ekstensi).")
        file.file.seek(0)
        
        unique_filename = f"{uuid.uuid4()}.pdf"
        
        if STORAGE_MODE == "gcs":
            # LAZY IMPORT GCS
            from google.cloud import storage 
            try:
                storage_client = storage.Client()
                bucket = storage_client.bucket(GCP_BUCKET_NAME)
                blob = bucket.blob(f"materi/{unique_filename}")
                blob.upload_from_file(file.file, content_type='application/pdf')
                # Simpan ID cloud, bukan URL lokal
                final_content = f"gs://{GCP_BUCKET_NAME}/materi/{unique_filename}"
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Gagal upload ke GCS: {str(e)}")
        else:
            file_path = os.path.join(UPLOAD_DIR, unique_filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            # Simpan URL endpoint lokal
            final_content = f"/api/content/download/{unique_filename}"
    
    material_data = schemas.MaterialCreate(title=title, content=final_content)
    return crud.create_material(db=db, material=material_data, course_id=course_id)

# --- ENDPOINT UNDUH DOKUMEN MATERI ---
@app.get("/download/{filename}")
async def download_secure_file(
    filename: str, 
    current_user: dict = Depends(get_current_user) 
):
    # ==========================================
    # PERBAIKAN: Sanitasi Input (Cegah Path Traversal)
    # Jika hacker mengirim "../../etc/passwd", os.path.basename akan memotongnya menjadi "passwd"
    # ==========================================
    safe_filename = os.path.basename(filename)

    if STORAGE_MODE == "gcs":
        from google.cloud import storage
        try:
            storage_client = storage.Client()
            bucket = storage_client.bucket(GCP_BUCKET_NAME)
            # Pastikan menggunakan safe_filename
            blob = bucket.blob(f"materi/{safe_filename}")
            if not blob.exists():
                raise HTTPException(status_code=404, detail="File PDF tidak ditemukan di Cloud")
                
            signed_url = blob.generate_signed_url(version="v4", expiration=timedelta(minutes=15), method="GET")
            return RedirectResponse(url=signed_url)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gagal generate Signed URL: {str(e)}")
            
    else:
        # Gunakan os.path.join agar penyusunan direktori lebih aman sesuai OS (Linux/Windows)
        file_path = os.path.join(UPLOAD_DIR, safe_filename)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File PDF tidak ditemukan di server lokal")
            
        return FileResponse(
            path=file_path, 
            media_type="application/pdf", 
            filename=safe_filename, # Gunakan safe_filename
            content_disposition_type="inline"
        )