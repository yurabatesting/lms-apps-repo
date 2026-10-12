from pydantic import BaseModel

# Skema untuk input saat Register
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "siswa" # Default role adalah siswa

# Skema untuk output balasan setelah Register (password tidak ikut dikembalikan)
class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True

# Skema untuk output Token JWT setelah Login
class Token(BaseModel):
    access_token: str
    token_type: str