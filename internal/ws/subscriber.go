package ws

import "encoding/json"

type WSSubscriber struct {
	Hub *Hub
}

type wsMessage struct {
	Type  string            `json:"type"`
	Event string            `json:"event"`
	Data  map[string]string `json:"data,omitempty"`
}

func (s *WSSubscriber) Name() string {
	return "websocket"
}

func (s *WSSubscriber) Handle(eventName string, data map[string]string) {
	msg, err := json.Marshal(wsMessage{
		Type:  "event",
		Event: eventName,
		Data:  data,
	})
	if err != nil {
		return
	}
	s.Hub.Broadcast(msg)
}
