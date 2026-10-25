# Gunakan image Python versi slim yang ringan
FROM python:3.11-slim

# Best Practice: Mencegah Python menulis file .pyc dan memastikan log langsung tercetak tanpa buffer
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 1. Membuat grup dan user non-root (bernama 'appuser')
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Set working directory
WORKDIR /app

# Salin dan install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Salin seluruh kode aplikasi ke dalam container
COPY . .

# 2. Ubah hak milik folder /app dari root menjadi milik 'appuser'
RUN chown -R appuser:appgroup /app

# 3. PENGUNCIAN KEAMANAN: Paksa kontainer menggunakan user non-root
USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]