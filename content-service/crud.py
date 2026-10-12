from sqlalchemy.orm import Session
import models, schemas

# Mendapatkan semua courses beserta isi materials-nya
def get_courses(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Course).offset(skip).limit(limit).all()

# Mendapatkan 1 course secara spesifik
def get_course(db: Session, course_id: int):
    return db.query(models.Course).filter(models.Course.id == course_id).first()

# Membuat course baru
def create_course(db: Session, course: schemas.CourseCreate):
    db_course = models.Course(**course.model_dump())
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    return db_course

# Membuat materi baru untuk course tertentu
def create_material(db: Session, material: schemas.MaterialCreate, course_id: int):
    db_material = models.Material(**material.model_dump(), course_id=course_id)
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material