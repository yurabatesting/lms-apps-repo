from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# --- Skema untuk Material ---
class MaterialBase(BaseModel):
    title: str
    content: str

class MaterialCreate(MaterialBase):
    pass

class MaterialResponse(MaterialBase):
    id: int
    course_id: int

    class Config:
        from_attributes = True

# --- Skema untuk Course ---
class CourseBase(BaseModel):
    title: str
    description: Optional[str] = None

class CourseCreate(CourseBase):
    pass

class CourseResponse(CourseBase):
    id: int
    created_at: datetime
    # Menampilkan daftar materi di dalam respons course (bersarang/nested)
    materials: List[MaterialResponse] = []

    class Config:
        from_attributes = True