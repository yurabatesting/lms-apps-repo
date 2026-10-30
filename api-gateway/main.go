package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

var ctx = context.Background()
var rdb *redis.Client

// ====================================================
// INISIALISASI REDIS (Aman dari Hardcode Kredensial)
// ====================================================
func init() {
	redisHost := getEnvOrDefault("REDIS_HOST", "redis")
	redisPort := getEnvOrDefault("REDIS_PORT", "6379")
	redisPassword := getEnvOrDefault("REDIS_PASSWORD", "")

	rdb = redis.NewClient(&redis.Options{
		Addr:     redisHost + ":" + redisPort,
		Password: redisPassword,
		DB:       0,
	})
}

func getEnvOrDefault(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// ====================================================
// MIDDLEWARE 1: CORS TERSENTRALISASI
// ====================================================
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		allowedOrigin := getEnvOrDefault("ALLOWED_ORIGINS", "http://localhost")
		c.Writer.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Internal-Token")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// ====================================================
// MIDDLEWARE 2: RATE LIMITER BERBASIS REDIS (Distributed)
// ====================================================
func rateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		key := "rate_limit:" + ip

		pipe := rdb.TxPipeline()
		incr := pipe.Incr(ctx, key)
		pipe.Expire(ctx, key, 1*time.Second)
		_, err := pipe.Exec(ctx)

		if err != nil {
			log.Printf("Peringatan: Redis Rate Limiter gagal merespons: %v", err)
			c.Next()
			return
		}

		if incr.Val() > 5 {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"status":  "error",
				"message": "Terlalu banyak permintaan (Rate Limit Exceeded). Harap tunggu sejenak.",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// ====================================================
// FUNGSI PROXY
// ====================================================
func proxy(targetURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		target, err := url.Parse(targetURL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Target URL invalid"})
			return
		}

		proxy := httputil.NewSingleHostReverseProxy(target)

		proxy.Director = func(req *http.Request) {
			req.Header = c.Request.Header
			req.Host = target.Host
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.URL.Path = c.Param("path")
		}

		proxy.ServeHTTP(c.Writer, c.Request)
	}
}

// ====================================================
// FUNGSI UTAMA
// ====================================================
func main() {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	// --- PERBAIKAN: Percayai Reverse Proxy Internal ---
	// Mendaftarkan rentang IP privat standar (Docker & Kubernetes/GKE)
	// agar Gin mau membaca IP klien asli dari header X-Real-IP / X-Forwarded-For
	err := r.SetTrustedProxies([]string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"})
	if err != nil {
		log.Printf("Gagal mengatur trusted proxies: %v", err)
	}
	// --------------------------------------------------

	r.Use(gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		logFormat := map[string]interface{}{
			"time":       param.TimeStamp.Format(time.RFC3339),
			"client_ip":  param.ClientIP,
			"method":     param.Method,
			"path":       param.Path,
			"status":     param.StatusCode,
			"latency_ms": param.Latency.Milliseconds(),
			"error":      param.ErrorMessage,
		}
		logJSON, _ := json.Marshal(logFormat)
		return string(logJSON) + "\n"
	}))
	r.Use(gin.Recovery())

	r.Use(corsMiddleware())
	r.Use(rateLimitMiddleware())

	authURL := getEnvOrDefault("AUTH_SERVICE_URL", "http://auth-service:8000")
	contentURL := getEnvOrDefault("CONTENT_SERVICE_URL", "http://content-service:8001")
	assessmentURL := getEnvOrDefault("ASSESSMENT_SERVICE_URL", "http://assessment-service:8002")
	leaderboardURL := getEnvOrDefault("LEADERBOARD_SERVICE_URL", "http://leaderboard-service:8003")

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "API Gateway is running smoothly with CORS and Distributed Rate Limiting!",
			"service": "api-gateway",
		})
	})

	r.Any("/api/auth/*path", proxy(authURL))
	r.Any("/api/content/*path", proxy(contentURL))
	r.Any("/api/assessment/*path", proxy(assessmentURL))

	// ==========================================
	// PENGAMANAN LEADERBOARD SERVICE
	// ==========================================
	r.GET("/api/leaderboard/*path", proxy(leaderboardURL))

	blockAccess := func(c *gin.Context) {
		c.JSON(http.StatusForbidden, gin.H{
			"status":  "error",
			"message": "Akses Ditolak: Rute ini telah diisolasi khusus untuk komunikasi internal backend.",
		})
	}
	r.POST("/api/leaderboard/*path", blockAccess)
	r.DELETE("/api/leaderboard/*path", blockAccess)
	r.PUT("/api/leaderboard/*path", blockAccess)

	srv := &http.Server{
		Addr:         ":8080",
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Println("🚀 API Gateway berjalan dengan Proteksi Rate Limit & CORS Tersentralisasi...")
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Fatal error pada server: %v", err)
	}
}
