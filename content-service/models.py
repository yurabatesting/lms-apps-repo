from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Membangun relasi (Satu Course bisa memiliki banyak Material)
    materials = relationship("Material", back_populates="course", cascade="all, delete-orphan")


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    content = Column(Text, nullable=False) # Isi materi (bisa berupa teks panjang atau link Cloud Storage nantinya)
    
    # Foreign Key untuk menyambungkan ke tabel courses
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    
    # Membangun relasi balik
    course = relationship("Course", back_populates="materials")