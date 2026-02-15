package http

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type Server struct {
	router    *chi.Mux
	logger    *slog.Logger
	staticDir string
}

func NewServer(logger *slog.Logger, staticDir string) *Server {
	s := &Server{
		router:    chi.NewRouter(),
		logger:    logger,
		staticDir: staticDir,
	}
	s.setupMiddleware()
	s.setupRoutes()
	return s
}

func (s *Server) setupMiddleware() {
	s.router.Use(middleware.RequestID)
	s.router.Use(middleware.RealIP)
	s.router.Use(middleware.Logger)
	s.router.Use(middleware.Recoverer)
	s.router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:*", "http://127.0.0.1:*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
}

func (s *Server) setupRoutes() {
	// API routes
	s.router.Route("/api", func(r chi.Router) {
		r.Get("/health", s.handleHealth)
	})

	// Serve static files (React build)
	s.serveStaticFiles()
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

func (s *Server) serveStaticFiles() {
	// Check if static directory exists
	if _, err := os.Stat(s.staticDir); os.IsNotExist(err) {
		s.logger.Warn("static directory not found, skipping static file serving", "dir", s.staticDir)
		return
	}

	// Serve static files
	fileServer := http.FileServer(http.Dir(s.staticDir))

	s.router.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(s.staticDir, r.URL.Path)

		// Check if file exists
		_, err := os.Stat(path)
		if os.IsNotExist(err) || isDir(path) {
			// Serve index.html for SPA routing
			http.ServeFile(w, r, filepath.Join(s.staticDir, "index.html"))
			return
		}

		// Serve the actual file
		fileServer.ServeHTTP(w, r)
	})
}

func isDir(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.router.ServeHTTP(w, r)
}
