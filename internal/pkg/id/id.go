package id

import (
	"crypto/rand"
	"encoding/base32"
	"strings"
)

// Generate creates a random ID (12 characters, URL-safe)
func Generate() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return strings.ToLower(base32.StdEncoding.EncodeToString(bytes))[:12]
}

// GenerateRoomCode creates a 6-character room code (uppercase, no confusing chars)
func GenerateRoomCode() string {
	// Use characters that are easy to read and type
	// Exclude: 0, O, I, 1, L (confusing)
	const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

	code := make([]byte, 6)
	bytes := make([]byte, 6)
	rand.Read(bytes)

	for i := 0; i < 6; i++ {
		code[i] = chars[int(bytes[i])%len(chars)]
	}

	return string(code)
}
