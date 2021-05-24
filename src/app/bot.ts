import { 
        Discord,
        On,
        Client,
        Command,
        ArgsOf,
        CommandMessage,
} from "@typeit/discord";
import EventsDatabase from '../database/events';
import DiscordEvent from '../data/discord-event';
import { v4 } from 'uuid';


@Discord("!")
abstract class AppDiscord {
    eventsDB: EventsDatabase

    constructor() {
        this.eventsDB = new EventsDatabase();
    }

    @On("ready")
    onReady(
            []: ArgsOf<"ready">,
    ) {
        console.log("Bot server is ready");
    }

    @On("message")
    onMessage(
            [msg]: ArgsOf<"message">,
    ) {
        if (msg.content === "ping") {
                msg.reply("pong " + msg.author.username);
        }
    }

    @Command("event schedule :event :description :timestamp")
    async onSchedule(msg: CommandMessage, client: Client) {
        const timestamp = new Date(msg.args.timestamp);
        const event = new DiscordEvent(
            v4(),
            msg.args.event,
            msg.args.description,
            timestamp,
            msg.author.id,
        );
        const minutes = event.time_until_start() / (60 * 1000);
        if (minutes < 0) {
            msg.channel.send("Cannot schedule an event in the past");
            return;
        }
        this.eventsDB.upsertEvent(event);
        msg.channel.send(`Scheduled event ${event.id} ${minutes} minutes from now`)
        client.setTimeout(async () => {
            this.eventsDB.removeEvent(event.id);
            msg.channel.send(`${event.name} (${event.description}) is starting now!`)
        }, timestamp.getTime() -  new Date().getTime());
    }

    @Command("event show :event_id")
    async onShowEvent(msg: CommandMessage, client: Client) {
        const event = this.eventsDB.getEvent(msg.args.event_id);
        if (event === null) {
            msg.channel.send("Event not found");
            return;
        }
        console.log(event);
        const minutes = event.time_until_start() / (60 * 1000);
        const message_lines = [];
        message_lines.push(`${event.name} (${event.description}) is happening ${minutes} minutes from now`);
        if (event.attending.length) {
            message_lines.push("Attending:");
            for (const member_id of event.attending) {
                const user = await client.users.fetch(member_id, true);
                message_lines.push(`  - ${user.username}`);
            }
        }
        if (event.skipping.length) {
            message_lines.push("Not attending:");
            for (const member_id of event.skipping) {
                const user = await client.users.fetch(member_id, true);
                message_lines.push(`  - ${user.username}`);
            }
        }
        msg.channel.send(message_lines.join('\n'));
    }

    @Command("event attend :event_id")
    async onAttendEvent(msg: CommandMessage) {
        const event = this.eventsDB.getEvent(msg.args.event_id);
        if (event === null) {
            msg.channel.send("Event not found");
            return;
        }
        event.add_attendee(msg.author.id);
        this.eventsDB.upsertEvent(event);
        const minutes = event.time_until_start() / (60 * 1000);
        msg.reply(`Attending event happening ${minutes} minutes from now`);
    }

    @Command("event skip :event_id")
    async onSkipEvent(msg: CommandMessage) {
        const event = this.eventsDB.getEvent(msg.args.event_id);
        if (event === null) {
            msg.channel.send("Event not found");
            return;
        }
        event.remove_attendee(msg.author.id);
        this.eventsDB.upsertEvent(event);
        const minutes = event.time_until_start() / (60 * 1000);
        msg.reply(`Skipping event happening ${minutes} minutes from now`);
    }
}
