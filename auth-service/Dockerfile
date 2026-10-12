# Gunakan image Python versi slim yang ringan
FROM python:3.11-slim

# Set working directory di dalam container
WORKDIR /app

# Salin file requirements terlebih dahulu (untuk caching layer Docker)
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Salin seluruh kode aplikasi ke dalam container
COPY . .

# Ekspos port 8000 yang digunakan FastAPI
EXPOSE 8000

# Perintah untuk menjalankan aplikasi
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]