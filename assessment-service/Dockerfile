# Gunakan image Python yang ringan
FROM python:3.11-slim

WORKDIR /app

# Salin file requirements dan install library
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Salin kode aplikasi
COPY main.py .

EXPOSE 8002

# Jalankan server aplikasi
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]