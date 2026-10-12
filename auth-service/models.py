from sqlalchemy import Column, Integer, String
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    
    # Username harus unik agar tidak ada 2 siswa dengan username sama
    username = Column(String(50), unique=True, index=True, nullable=False)
    
    # Kita menyimpan password dalam bentuk hash, BUKAN teks asli (keamanan dasar)
    password_hash = Column(String(255), nullable=False)
    
    # Role bisa berisi 'siswa' atau 'admin'
    role = Column(String(20), nullable=False, default="siswa")