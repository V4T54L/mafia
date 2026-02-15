package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port     int
	Host     string
	StaticDir string
	Env      string
}

func Load() *Config {
	return &Config{
		Port:      getEnvInt("PORT", 8080),
		Host:      getEnv("HOST", "0.0.0.0"),
		StaticDir: getEnv("STATIC_DIR", "./web/dist"),
		Env:       getEnv("ENV", "development"),
	}
}

func (c *Config) Addr() string {
	return c.Host + ":" + strconv.Itoa(c.Port)
}

func (c *Config) IsDev() bool {
	return c.Env == "development"
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
