import DiscordEvent from '../data/discord-event';

export default class EventsDatabase {
    events: DiscordEvent[];

    constructor() {
        this.events = [];
    }

    getEvent(event_id: string): DiscordEvent | null {
        const index = this.events.findIndex(e => e.id == event_id);
        if (index !== -1) {
            return this.events[index];
        }
        return null;
    }

    getEvents(): DiscordEvent[] {
        return this.events;
    }

    upsertEvent(event: DiscordEvent) {
        const index = this.events.findIndex(e => e.id == event.id);
        if (index !== -1) {
            this.events[index] = event;
        } else {
            this.events.push(event);
        }
    }

    removeEvent(event_id: string): DiscordEvent | null {
        const index = this.events.findIndex(e => e.id == event_id);
        if (index === -1) {
            return null;
        }
	const out = this.events[index];
	this.events.splice(index, 1);
	return out;
    }
}
