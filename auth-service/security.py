from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt

# Kunci rahasia untuk menandatangani JWT (Di tahap DevOps nanti, ini akan dimasukkan ke Secret Manager/Env Vars)
SECRET_KEY = "rahasia_super_kuat_untuk_dummy_lms"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 # Token kedaluwarsa dalam 1 jam

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    # Membuat token JWT yang digabungkan dengan SECRET_KEY
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt