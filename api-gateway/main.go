// package apigateway

package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/gin-gonic/gin"
)

// Fungsi proxy untuk meneruskan request ke service backend
func proxy(targetURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		target, err := url.Parse(targetURL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Target URL invalid"})
			return
		}

		proxy := httputil.NewSingleHostReverseProxy(target)

		// Memodifikasi request sebelum dikirim ke backend service
		proxy.Director = func(req *http.Request) {
			req.Header = c.Request.Header
			req.Host = target.Host
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host

			// Memotong awalan "/api/auth" atau "/api/content"
			// Sehingga Auth Service hanya menerima "/login" atau "/register"
			req.URL.Path = c.Param("path")
		}

		// Jalankan proxy
		proxy.ServeHTTP(c.Writer, c.Request)
	}
}

func main() {
	// Menonaktifkan mode debug agar log lebih rapi
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// Health check khusus untuk API Gateway
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "API Gateway is running smoothly!",
			"service": "api-gateway",
		})
	})

	// Rute untuk Auth Service
	r.Any("/api/auth/*path", proxy("http://auth-service:8000"))

	// Rute untuk Content Service
	r.Any("/api/content/*path", proxy("http://content-service:8001"))

	// Rute untuk Assessment Service
	r.Any("/api/assessment/*path", proxy("http://assessment-service:8002"))

	log.Println("API Gateway berjalan di port 8080...")
	r.Run(":8080")
}
