# ==========================================
# STAGE 1: BUILDER
# ==========================================
FROM golang:1.26 AS builder

WORKDIR /app

ENV GOPROXY=https://goproxy.cn,https://goproxy.io,direct
ENV GOSUMDB=off

# 1. Salin SEMUA file terlebih dahulu (go.mod dan main.go)
COPY go.mod .
COPY main.go .

# 2. SEKARANG jalankan go mod tidy. 
# Ia akan membaca main.go, menemukan gin, dan mengunduhnya.
RUN go mod tidy -v

# 3. Kompilasi aplikasi secara statis dan hapus metadata debug agar ukurannya sekecil mungkin
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o gateway .


# ==========================================
# STAGE 2: RUNTIME (Super Ringan & Aman)
# ==========================================
FROM alpine:latest

# Instal sertifikat SSL (hanya ~1 MB) dan buat User Non-Root
RUN apk --no-cache add ca-certificates && \
    addgroup -S appgroup && \
    adduser -S appuser -G appgroup

WORKDIR /app

# Ambil HANYA file binary hasil kompilasi dari STAGE 1
COPY --from=builder /app/gateway .

# Gunakan user biasa, bukan Root
USER appuser

EXPOSE 8080

CMD ["./gateway"]