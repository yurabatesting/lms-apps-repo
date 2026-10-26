import os 
from fastapi import Depends, HTTPException, status, Security, Query
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

# PENTING: Secret Key dan Algorithm HARUS SAMA PERSIS dengan yang ada di Auth Service
SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("FATAL ERROR: SECRET_KEY belum di-set di environment content-service!")

ALGORITHM = "HS256"

# Memberitahu Swagger UI di mana tempat mengambil token (meskipun beda service)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://localhost/api/auth/login", auto_error=False)

# Fungsi 1: Mengecek keaslian token
# def get_current_user(token: str = Depends(oauth2_scheme)):
#     credentials_exception = HTTPException(
#         status_code=status.HTTP_401_UNAUTHORIZED,
#         detail="Token tidak valid atau sudah kedaluwarsa",
#         headers={"WWW-Authenticate": "Bearer"},
#     )
#     try:
#         # Membuka (decode) isi token menggunakan Secret Key
#         payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
#         username: str = payload.get("sub")
#         role: str = payload.get("role")
#         if username is None or role is None:
#             raise credentials_exception
        
#         # Mengembalikan data user yang ada di dalam token
#         return {"username": username, "role": role}
#     except JWTError:
#         raise credentials_exception
async def get_current_user(
    token_header: str = Depends(oauth2_scheme),
    token_query: str = Query(None, alias="token") # Menangkap ?token=... dari URL
):
    # Prioritaskan token dari Header (React), jika kosong ambil dari URL (Browser)
    token = token_header or token_query
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token tidak valid atau kedaluwarsa")


# Fungsi 2: Middleware RBAC (Role-Based Access Control) khusus Admin
def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak: Hanya Admin yang dapat melakukan aksi ini"
        )
    return current_user