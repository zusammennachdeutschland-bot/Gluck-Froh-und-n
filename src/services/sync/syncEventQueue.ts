import { storage } from '../storageService';

export interface SyncOutgoingEvent {
  id: string;
  type: 'session_cancelled' | string;
  payload: any;
  timestamp: number;
  deviceId: string;
}

const OUTGOING_EVENTS_KEY = 'dl_sync_outgoing_events';

class SyncEventQueue {
  private events: SyncOutgoingEvent[] = [];
  private loaded: boolean = false;

  private async ensureLoaded() {
    if (this.loaded) return;
    try {
      const stored = await storage.getItem<SyncOutgoingEvent[]>(OUTGOING_EVENTS_KEY);
      if (stored && Array.isArray(stored)) {
        this.events = stored;
      }
    } catch (err) {
      console.warn('[SyncEventQueue] Failed to load outgoing events:', err);
    }
    this.loaded = true;
  }

  public async enqueue(type: string, payload: any, deviceId: string = 'local'): Promise<SyncOutgoingEvent> {
    await this.ensureLoaded();
    const event: SyncOutgoingEvent = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type,
      payload,
      timestamp: Date.now(),
      deviceId
    };
    this.events.push(event);
    await this.save();
    return event;
  }

  public async getPendingEvents(): Promise<SyncOutgoingEvent[]> {
    await this.ensureLoaded();
    return [...this.events];
  }

  public async clearEvents(eventIds: string[]): Promise<void> {
    await this.ensureLoaded();
    if (!eventIds || eventIds.length === 0) return;
    this.events = this.events.filter(e => !eventIds.includes(e.id));
    await this.save();
  }

  private async save() {
    try {
      await storage.setItem(OUTGOING_EVENTS_KEY, this.events);
    } catch (err) {
      console.warn('[SyncEventQueue] Failed to save outgoing events:', err);
    }
  }
}

export const syncEventQueue = new SyncEventQueue();
