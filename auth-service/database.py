import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Mengambil variabel environment DATABASE_URL dari docker-compose
# Jika tidak ada (misal run lokal tanpa docker), gunakan URL default
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://lms_admin:secretpassword@localhost:5432/auth_db"
)

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