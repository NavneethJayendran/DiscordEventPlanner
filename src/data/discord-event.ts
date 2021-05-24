export default class DiscordEvent {
    id: string;
    creator_id: string;
    name: string;
    description: string;
    start_time: Date;
    attending: string[];
    skipping: string[];

    constructor(id: string, name: string, description: string, start_time: Date, creator_id: string) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.creator_id = creator_id;
        this.attending = [creator_id];
	this.skipping = [];
        this.start_time = start_time;
    }

    add_attendee(discord_id: string) {
	this.add_to_set(this.attending, discord_id);
	this.remove_from_set(this.skipping, discord_id);
    }

    remove_attendee(discord_id: string) {
	this.add_to_set(this.skipping, discord_id);
	this.remove_from_set(this.attending, discord_id);
    }

    time_until_start(): number {
        return this.start_time.getTime() - new Date().getTime();
    }

    private add_to_set(set: string[], item: string) {
        if (!set.includes(item)) {
            set.push(item);
        }
    }

    private remove_from_set(set: string[], item: string) {
	const copy = set.filter(s => s !== item);
	set.length = 0;
	copy.map(s => set.push(s));
    }
}
