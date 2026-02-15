package sfu

import (
	"os"
	"strconv"
)

// Config holds SFU configuration
type Config struct {
	// UDP port range for WebRTC media
	UDPPortMin int
	UDPPortMax int

	// STUN server for NAT traversal
	STUNServer string
}

// DefaultConfig returns default SFU configuration
func DefaultConfig() *Config {
	return &Config{
		UDPPortMin: getEnvInt("SFU_UDP_PORT_MIN", 5000),
		UDPPortMax: getEnvInt("SFU_UDP_PORT_MAX", 5100),
		STUNServer: getEnv("SFU_STUN_SERVER", "stun:stun.l.google.com:19302"),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return fallback
}
