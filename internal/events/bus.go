package events

import (
	"log/slog"
	"sync"
)

// Subscriber 事件订阅者接口
type Subscriber interface {
	Name() string
	Handle(eventName string, data map[string]string)
}

// EventBus 事件总线
type EventBus struct {
	mu             sync.RWMutex
	subscribers    map[string][]Subscriber // eventName -> subscribers
	allSubscribers []Subscriber            // 订阅所有事件的订阅者
}

// NewEventBus 创建事件总线
func NewEventBus() *EventBus {
	return &EventBus{
		subscribers: make(map[string][]Subscriber),
	}
}

// 全局默认事件总线
var defaultBus = NewEventBus()

// Subscribe 注册订阅某个事件的订阅者
func Subscribe(eventName string, sub Subscriber) {
	defaultBus.mu.Lock()
	defer defaultBus.mu.Unlock()
	defaultBus.subscribers[eventName] = append(defaultBus.subscribers[eventName], sub)
	slog.Info("事件订阅者已注册", "event", eventName, "subscriber", sub.Name())
}

// SubscribeAll 注册订阅所有事件的订阅者
func SubscribeAll(sub Subscriber) {
	defaultBus.mu.Lock()
	defer defaultBus.mu.Unlock()
	defaultBus.allSubscribers = append(defaultBus.allSubscribers, sub)
	slog.Info("全局事件订阅者已注册", "subscriber", sub.Name())
}

// Publish 发布事件到总线，异步通知所有匹配的订阅者
func Publish(eventName string, data map[string]string) {
	defaultBus.mu.RLock()
	// 收集需要通知的订阅者
	var targets []Subscriber
	targets = append(targets, defaultBus.allSubscribers...)
	targets = append(targets, defaultBus.subscribers[eventName]...)
	defaultBus.mu.RUnlock()

	for _, sub := range targets {
		go func(s Subscriber) {
			defer func() {
				if r := recover(); r != nil {
					slog.Error("事件订阅者 panic", "event", eventName, "subscriber", s.Name(), "error", r)
				}
			}()
			s.Handle(eventName, data)
		}(sub)
	}
}
