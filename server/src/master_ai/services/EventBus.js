const EventEmitter = require('events');
const TimeAuthorityService = require('../../services/TimeAuthorityService');

class EventBus extends EventEmitter {
    constructor() {
        super();
        this.dlq = []; // Dead Letter Queue
        this.eventHistory = []; // For debugging/replay
    }

    publish(topic, payload) {
        const eventId = `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const event = {
            id: eventId,
            topic,
            payload,
            timestamp: TimeAuthorityService.nowIST()
        };

        this.eventHistory.push(event);
        // Keep history manageable
        if (this.eventHistory.length > 500) this.eventHistory.shift();

        console.log(`[EventBus] Published: ${topic} (${eventId})`);

        try {
            this.emit(topic, event);
        } catch (error) {
            console.error(`[EventBus] Error processing event ${eventId}:`, error);
            this.dlq.push({ event, error: error.message });
        }

        return eventId;
    }

    subscribe(topic, callback) {
        console.log(`[EventBus] Subscribed to: ${topic}`);
        this.on(topic, callback);
    }

    registerHandler(eventType, handler) {
        this.subscribe(eventType, async (event) => {
            console.log(`[EventBus] Handler triggered for ${eventType}`);
            try {
                await handler(event);
            } catch (err) {
                console.error(`[EventBus] Handler failed for ${eventType}:`, err);
            }
        });
    }

    getRecentEvents(limit = 50, topicFilter = null) {
        let events = this.eventHistory;
        if (topicFilter) {
            events = events.filter(e => e.topic === topicFilter);
        }
        return events.slice(-limit);
    }

    replayEvent(eventId) {
        const event = this.eventHistory.find(e => e.id === eventId);
        if (!event) return false;

        console.log(`[EventBus] Replaying event: ${eventId}`);
        this.emit(event.topic, event);
        return true;
    }

    getDeadLetterQueue() {
        return this.dlq;
    }
}

module.exports = EventBus;
