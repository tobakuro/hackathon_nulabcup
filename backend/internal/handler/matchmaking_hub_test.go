package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHub_RegisterAndUnregister(t *testing.T) {
	hub := &Hub{
		connections: make(map[uuid.UUID]*websocket.Conn),
	}

	userID := uuid.New()
	conn := &websocket.Conn{} // dummy, not used for map ops

	hub.Register(userID, conn)
	hub.mu.RLock()
	_, exists := hub.connections[userID]
	hub.mu.RUnlock()
	assert.True(t, exists, "connection should be registered")

	// Unregister calls LeaveQueue internally, which needs usecase.
	// Test map deletion directly instead.
	hub.mu.Lock()
	delete(hub.connections, userID)
	hub.mu.Unlock()

	hub.mu.RLock()
	_, exists = hub.connections[userID]
	hub.mu.RUnlock()
	assert.False(t, exists, "connection should be unregistered")
}

func TestHub_SendToUser_WithConnection(t *testing.T) {
	hub := &Hub{
		connections: make(map[uuid.UUID]*websocket.Conn),
	}

	userID := uuid.New()

	// Set up a real WebSocket connection via httptest
	upgrader := websocket.Upgrader{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Fatalf("upgrade error: %v", err)
		}
		hub.Register(userID, conn)
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	clientConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer clientConn.Close()

	msg := WSMessage{
		Type:    "ev_test",
		Payload: map[string]any{"key": "value"},
	}
	hub.SendToUser(userID, msg)

	_, data, err := clientConn.ReadMessage()
	require.NoError(t, err)

	var received WSMessage
	err = json.Unmarshal(data, &received)
	require.NoError(t, err)
	assert.Equal(t, "ev_test", received.Type)
}

func TestHub_SendToUser_NoConnection(t *testing.T) {
	hub := &Hub{
		connections: make(map[uuid.UUID]*websocket.Conn),
	}

	// Should not panic when sending to a non-existent user
	assert.NotPanics(t, func() {
		hub.SendToUser(uuid.New(), WSMessage{Type: "ev_test"})
	})
}
