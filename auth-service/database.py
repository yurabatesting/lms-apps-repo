import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Mengambil variabel environment DATABASE_URL dari docker-compose
# MENGUBAH GETENV MENJADI ENVIRON (Fail-Fast Mechanism)
# Aplikasi akan crash jika DATABASE_URL tidak disuntikkan oleh GCP/Docker
SQLALCHEMY_DATABASE_URL = os.environ["DATABASE_URL"]

# Membuat 'engine' yang mengatur koneksi ke database
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# SessionLocal digunakan untuk membuat sesi (transaksi) ke database di setiap request
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class untuk model-model tabel kita nantinya
Base = declarative_base()

# Dependency function: Setiap kali API dipanggil, fungsi ini akan membuka
# dan menutup koneksi database secara otomatis agar tidak bocor (memory leak).
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()