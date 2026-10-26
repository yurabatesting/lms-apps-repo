FROM python:3.11-slim
# Mengatur direktori kerja
WORKDIR /app

# Salin dan install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 1. Buat pengguna baru bernama 'appuser' (tanpa akses root/sudo)
RUN useradd -m appuser

# 2. Salin seluruh kode aplikasi ke dalam kontainer
COPY . .

# 3. Buat folder uploads secara manual di Docker dan berikan hak milik penuh (chown)
# kepada 'appuser' agar ia bisa menyimpan file PDF yang di-upload
RUN mkdir -p uploads && chown -R appuser:appuser /app

# 4. Ganti identitas pengeksekusi dari 'root' menjadi 'appuser'
USER appuser

# --- BATAS TAMBAHAN ---

EXPOSE 8001

# Command untuk menjalankan aplikasi
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]