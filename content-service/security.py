import os  # INI YANG HILANG!
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

# PENTING: Secret Key dan Algorithm HARUS SAMA PERSIS dengan yang ada di Auth Service
SECRET_KEY = os.getenv("SECRET_KEY", "super_secret_key_lms")
ALGORITHM = "HS256"

# Memberitahu Swagger UI di mana tempat mengambil token (meskipun beda service)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://localhost:8000/login")

# Fungsi 1: Mengecek keaslian token
def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token tidak valid atau sudah kedaluwarsa",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Membuka (decode) isi token menggunakan Secret Key
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None or role is None:
            raise credentials_exception
        
        # Mengembalikan data user yang ada di dalam token
        return {"username": username, "role": role}
    except JWTError:
        raise credentials_exception

# Fungsi 2: Middleware RBAC (Role-Based Access Control) khusus Admin
def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak: Hanya Admin yang dapat melakukan aksi ini"
        )
    return current_user