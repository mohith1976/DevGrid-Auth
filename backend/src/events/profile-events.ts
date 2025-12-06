import { EventEmitter } from 'events';

// Shared emitter for profile update notifications (SSE/websocket consumers subscribe here)
export const profileEvents = new EventEmitter();
profileEvents.setMaxListeners(100);
