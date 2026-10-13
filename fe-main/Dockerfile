# Tahap 1: Membangun Aplikasi (Menggunakan Node.js)
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Tahap 2: Menjalankan Aplikasi (Menggunakan Nginx)
FROM nginx:alpine
# Menyalin hasil build React dari Tahap 1 ke folder Nginx
COPY --from=builder /app/dist /usr/share/nginx/html
# Menyalin konfigurasi routing SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]