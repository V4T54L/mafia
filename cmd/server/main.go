package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	httpAdapter "github.com/V4T54L/mafia/internal/adapter/http"
	"github.com/V4T54L/mafia/internal/adapter/sfu"
	"github.com/V4T54L/mafia/internal/adapter/ws"
	"github.com/V4T54L/mafia/internal/domain/service"
	"github.com/V4T54L/mafia/internal/pkg/config"
	"github.com/V4T54L/mafia/internal/pkg/logger"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize logger
	log := logger.New(cfg.IsDev())

	log.Info("starting server",
		"port", cfg.Port,
		"env", cfg.Env,
		"staticDir", cfg.StaticDir,
	)

	// Create services
	roomService := service.NewRoomService(log)
	gameService := service.NewGameService(roomService, log)

	// Create SFU for voice chat
	sfuConfig := sfu.DefaultConfig()
	sfuInstance, err := sfu.New(sfuConfig, log)
	if err != nil {
		log.Error("failed to create SFU", "error", err)
		os.Exit(1)
	}
	defer sfuInstance.Close()

	// Create WebSocket hub
	hub := ws.NewHub(log)
	go hub.Run()

	// Create message router
	router := ws.NewRouter(hub, roomService, gameService, sfuInstance, log)

	// Create WebSocket handler
	wsHandler := ws.NewHandler(hub, log, router.HandleMessage, router.HandleDisconnect)

	// Create HTTP server
	server := httpAdapter.NewServer(log, cfg.StaticDir, wsHandler)

	httpServer := &http.Server{
		Addr:         cfg.Addr(),
		Handler:      server,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Info("server listening", "addr", cfg.Addr())
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Error("server forced to shutdown", "error", err)
	}

	log.Info("server stopped")
}
