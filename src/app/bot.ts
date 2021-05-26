import {
  Discord,
  On,
  Client,
  Command,
  ArgsOf,
  CommandMessage
} from '@typeit/discord'
import { ArgumentParser } from 'argparse';
import { TextChannel } from 'discord.js';
import EventsDatabase from '../database/events';
import DiscordEvent from '../data/discord-event';
import * as chrono from 'chrono-node';
import shellquote from 'shell-quote';
import humanizeDuration from 'humanize-duration';

const eventScheduleParser = new ArgumentParser({
  prog: '!event schedule',
  description: 'Schedule some upcoming events',
  add_help: true,
  exit_on_error: false,
});

eventScheduleParser.add_argument('--description', { help: 'Event description', 'default': "" });
eventScheduleParser.add_argument('event_name', { help: 'Name of the event' });
eventScheduleParser.add_argument('when', { help: 'Time the event starts' });

@Discord('!')
/* eslint-disable no-unused-vars */
abstract class AppDiscord {
/* eslint-enable no-unused-vars */
    eventsDB: EventsDatabase
    constructor () {
      this.eventsDB = new EventsDatabase()
      this.eventsDB.load()
    }

    @On('ready')
    onReady (
      _: ArgsOf<'ready'>,
      client: Client
    ) {
      for (const event of this.eventsDB.getEvents()) {
	this.scheduleEvent(event, client)
      }
    }

    @On('message')
    onMessage (
      [msg]: ArgsOf<'message'>
    ) {
      if (msg.content === 'ping') {
        msg.reply('pong ' + msg.author.username);
      }
    }

    @Command('event schedule')
    async onSchedule (msg: CommandMessage, client: Client) {
      let args: any;
      try {
	  let argv: string[] = [];
	  for (const entry of shellquote.parse(msg.commandContent)) {
	      if (entry === 'event' || entry === 'schedule') {
		continue;
	      }
	      if (typeof entry === 'string' || entry instanceof String)  {
	      	argv.push(entry as string);
	      }
	  }
	  console.log(argv);
          args = eventScheduleParser.parse_args(argv);
      } catch (err) {
	  console.log("In error block");
	  msg.reply(err.message);
	  return;
      }
      const timestamp = chrono.parseDate(args.when);
      if (timestamp === null) {
	  msg.reply(`Sorry, I don't understand when "${args.when}" is.`);
	  return;
      }
      const event = new DiscordEvent(
        this.eventsDB.getNextEventID(),
        args.event_name,
        args.description,
        timestamp,
        msg.author.id,
        msg.channel.id
      );

      const duration = event.timeUntilStart();
      if (duration < 0) {
        msg.channel.send("I can't schedule an event in the past!");
        return;
      }
      this.eventsDB.upsertEvent(event);
      this.scheduleEvent(event, client)
      msg.channel.send(`Scheduled event #${event.id} **${event.name}** _${humanizeDuration(duration)}_ from now`);
    }

    @Command('event show :eventId')
    async onShowEvent (msg: CommandMessage, client: Client) {
      const event = this.eventsDB.getEvent(String(msg.args.eventId));
      if (event === null) {
        msg.channel.send("Sorry, I couldn't find that event.");
        return;
      }
      const duration = event.timeUntilStart();
      const messageLines = [
	      `**${event.name}** is happening _${humanizeDuration(duration)}_ from now`,
	      ...this.getDescriptionLines(event),
	      ...(await this.getAttendanceLines(event, client)),
      ]
      msg.channel.send(messageLines.join('\n'))
    }

    @Command('event attend :eventId')
    async onAttendEvent (msg: CommandMessage, client: Client) {
      const event = this.eventsDB.getEvent(String(msg.args.eventId));
      if (event === null) {
        msg.channel.send("Sorry, I couldn't find that event.");
        return;
      }
      event.addAttendee(msg.author.id);
      this.eventsDB.upsertEvent(event);
      const duration = event.timeUntilStart();
      const messageLines = [
	      `Attending **${event.name}** starting _${humanizeDuration(duration)}_ from now`,
              ...(await this.getAttendanceLines(event, client))
      ];
      msg.reply(messageLines.join('\n'));
    }

    @Command('event skip :eventId')
    async onSkipEvent (msg: CommandMessage, client: Client) {
      const event = this.eventsDB.getEvent(String(msg.args.eventId))
      if (event === null) {
        msg.channel.send("Sorry, I couldn't find that event.")
        return
      }
      event.removeAttendee(msg.author.id);
      this.eventsDB.upsertEvent(event);
      const minutes = event.timeUntilStart() / (60 ** 1000);
      const messageLines = [
	      `Skipping **${event.name}** starting _${minutes}_ minutes from now`,
	      ...(await this.getAttendanceLines(event, client))
      ]
      msg.reply(messageLines.join('\n'));
    }

    private async getAttendanceLines(event: DiscordEvent, client: Client): Promise<string[]> {
      const out = [];
      if (event.attending.length + event.skipping.length) {
        out.push('Attendance:')
        for (const memberId of event.attending) {
          const user = await client.users.fetch(memberId, true)
          out.push(`  - **${user.username}**`)
        }
        for (const memberId of event.skipping) {
          const user = await client.users.fetch(memberId, true)
          out.push(`  - ~~${user.username}~~`)
        }
      }
      return out;
    }

    private async scheduleEvent(event: DiscordEvent, client: Client): Promise<undefined> {
	if (event.timeUntilStart() < 0) {
	    console.log("Couldn't schedule event happening in the past");
            this.eventsDB.removeEvent(event.id)
	    return;
	}
        client.setTimeout(async () => {
           this.eventsDB.removeEvent(event.id)
           const channel = await client.channels.fetch(event.channelId, true)
           if (channel) {
	       const messageLines = [
	      	    `**${event.name}** is starting now!`,
		    ...this.getDescriptionLines(event),
	       ]
	       for (const attending of event.attending) {
		    const user = await client.users.fetch(attending, true);
		    messageLines.push(user.toString());
	       }
               await (channel as TextChannel).send(messageLines.join('\n'));
           }
        }, event.timeUntilStart());
    }

    private getDescriptionLines(event: DiscordEvent): string[] {
      const out = [];
      if (event.description) {
	out.push(`Description: _${event.description}_`);
      }
      return out;
    }
}
