import {
  Discord,
  On,
  Client,
  Command,
  ArgsOf,
  CommandMessage
} from '@typeit/discord'
import { ArgumentParser } from 'argparse'
import { TextChannel, User } from 'discord.js'
import EventsDatabase from '../database/events'
import DiscordEvent from '../data/discord-event'
import * as chrono from 'chrono-node'
import { parse as argvparse } from '../parse/shell-quote'
import humanizeDuration from 'humanize-duration'
import moment from 'moment-timezone'
import groupBy from 'lodash.groupby'

@Discord('!')
/* eslint-disable no-unused-vars */
abstract class AppDiscord {
/* eslint-enable no-unused-vars */
    eventsDB: EventsDatabase
    scheduleParser: ArgumentParser
    inviteParser: ArgumentParser
    constructor () {
      this.eventsDB = new EventsDatabase()
      this.eventsDB.load()

      this.scheduleParser = new ArgumentParser({
        prog: '!event schedule',
        description: 'Schedule some upcoming events',
        add_help: true,
        exit_on_error: false
      })

      this.scheduleParser.add_argument('-d', '--description', { help: 'Event description', default: '' })
      this.scheduleParser.add_argument('event_name', { help: 'Name of the event' })
      this.scheduleParser.add_argument('when', { help: 'Time the event starts' })

      this.inviteParser = new ArgumentParser({
        prog: '!event invite',
        description: 'Schedule some upcoming events',
        add_help: true,
        exit_on_error: false
      })

      this.inviteParser.add_argument('event_id', { help: 'Name of the event' })
      this.inviteParser.add_argument('person', { nargs: '+', help: 'Time the event starts' })
    }

    @On('ready')
    onReady (
      _: ArgsOf<'ready'>,
      client: Client
    ) {
      for (const event of this.eventsDB.getEvents()) {
        this.scheduleEvent(client, event)
      }
    }

    @On('message')
    onMessage (
      [msg]: ArgsOf<'message'>
    ) {
      if (msg.content === 'ping') {
        msg.reply('pong ' + msg.author.username)
      }
    }

    @Command('event schedule')
    async onSchedule (msg: CommandMessage, client: Client) {
      let args: any
      try {
        const argv: string[] = argvparse(msg.content);
        (argv)
        args = this.scheduleParser.parse_args(argv.splice(2))
      } catch (err) {
        msg.reply(err.message)
        return
      }
      const timestamp = chrono.parseDate(args.when)
      if (timestamp === null) {
        msg.reply(`Sorry, I don't understand when "${args.when}" is.`)
        return
      }
      const event = new DiscordEvent(
        this.eventsDB.getNextEventID(),
        args.event_name,
        args.description,
        timestamp,
        msg.author.id,
        msg.channel.id
      )

      const duration = event.timeUntilStart()
      if (duration < 0) {
        msg.channel.send("I can't schedule an event in the past!")
        return
      }
      this.eventsDB.upsertEvent(event)
      this.scheduleEvent(client, event)
      const messageLines: string[] = [
          `Scheduled (#${event.id}) **${event.name}** _${humanizeDuration(duration)}_ from now`,
	  (await this.getCreatedByLine(client, event)),
	  ...this.getDescriptionLines(event)
      ]
      msg.channel.send(messageLines.join('\n'))
    }

    @Command('event list')
    async onListEvents (msg: CommandMessage) {
      const events = [...this.eventsDB.getEvents()].sort()
      if (events.length === 0) {
        msg.channel.send('No events are currently scheduled.\nTry `event schedule "Test" "in 1 hour"`')
        return
      }
      const tz = 'America/Los_Angeles'
      const groupedEvents = groupBy(events, (e: DiscordEvent) => moment(e.startTime).tz(tz).format('dddd, MMM Do YYYY'))
      const messageLines: string[] = ['**Events:\n**']
      Object.entries(groupedEvents).forEach(([day, events]) => {
	  messageLines.push(day + '\n')
	  events.forEach(event => {
          messageLines.push(`  (#${event.id}) **${event.name}** at ${moment(event.startTime).format('h:mm a')}`)
	  })
	  messageLines.push('\n')
      })
      messageLines.push(`Current time is ${moment().tz(tz).format('dddd, MMM Do YYYY, h:mm a')}`)
      msg.channel.send(messageLines.join('\n'))
    }

    @Command('event show :eventId')
    async onShowEvent (msg: CommandMessage, client: Client) {
      const event = this.eventsDB.getEvent(String(msg.args.eventId))
      if (event === null) {
        msg.channel.send("Sorry, I couldn't find that event.")
        return
      }
      const duration = event.timeUntilStart()
      const messageLines: string[] = [
              `**(#${event.id}) ${event.name}** is starting _${humanizeDuration(duration)}_ from now`,
	      (await this.getCreatedByLine(client, event)),
              ...this.getDescriptionLines(event),
              ...(await this.getAttendanceLines(event, client))
      ]
      msg.channel.send(messageLines.join('\n'))
    }

    @Command('event attend :eventId')
    async onAttendEvent (msg: CommandMessage, client: Client) {
      const event = this.eventsDB.getEvent(String(msg.args.eventId))
      if (event === null) {
        msg.channel.send("Sorry, I couldn't find that event.")
        return
      }
      event.addAttendee(msg.author.id)
      this.eventsDB.upsertEvent(event)
      const duration = event.timeUntilStart()
      const messageLines = [
              `Attending (#${event.id}) **${event.name}** starting _${humanizeDuration(duration)}_ from now`,
              ...(await this.getAttendanceLines(event, client))
      ]
      msg.channel.send(messageLines.join('\n'))
    }

    @Command('event skip :eventId')
    async onSkipEvent (msg: CommandMessage, client: Client) {
      const event = this.eventsDB.getEvent(String(msg.args.eventId))
      if (event === null) {
        msg.channel.send("Sorry, I couldn't find that event.")
        return
      }
      event.addSkipper(msg.author.id)
      this.eventsDB.upsertEvent(event)
      const duration = event.timeUntilStart()
      const messageLines = [
              `Skipping (#${event.id}) **${event.name}** starting _${humanizeDuration(duration)}_ from now`,
              ...(await this.getAttendanceLines(event, client))
      ]
      msg.reply(messageLines.join('\n'))
    }

    @Command('event invite')
    async onInviteUsers (msg: CommandMessage, client: Client) {
      let args: any
      try {
        const argv: string[] = argvparse(msg.content)
        args = this.inviteParser.parse_args(argv.splice(2))
      } catch (err) {
        msg.reply(err.message)
        return
      }
      const event = this.eventsDB.getEvent(String(args.event_id))
      if (event === null) {
        msg.reply("Sorry, I couldn't find that event.")
        return
      }
      const userColumns: string[] = []
      for (const [_, user] of msg.mentions.users) {
	  if (user && event.addInvitedIfNotAlready(user.id)) {
		 userColumns.push(user.username)
	  }
      }
      this.eventsDB.upsertEvent(event)
      const duration = event.timeUntilStart()
      let messageLines: string[] = []
      if (userColumns.length > 0) {
        messageLines = [
              `Invited ${userColumns.join(',')} to (#${event.id}) **${event.name}** starting _${humanizeDuration(duration)}_ from now`,
              ...(await this.getAttendanceLines(event, client))
        ]
      } else {
        messageLines = [
              `All users were already invited to (#${event.id}) **${event.name}** starting _${humanizeDuration(duration)}_ from now`,
              ...(await this.getAttendanceLines(event, client))
        ]
      }
      msg.channel.send(messageLines.join('\n'))
    }

    private async getAttendanceLines (event: DiscordEvent, client: Client): Promise<string[]> {
      const out = []
      if (event.attending.length + event.skipping.length) {
        out.push('Attendance:')
        for (const memberId of event.attending) {
          out.push(`  - **${await this.getUserName(client, memberId)}** :white_check_mark:`)
        }
        for (const memberId of event.invited) {
          out.push(`  - **${await this.getUserName(client, memberId)}** :question:`)
        }
        for (const memberId of event.skipping) {
          out.push(`  - ~~${await this.getUserName(client, memberId)}~~ :x:`)
        }
      }
      return out
    }

    private async scheduleEvent (client: Client, event: DiscordEvent): Promise<undefined> {
      if (event.timeUntilStart() < 0) {
        this.eventsDB.removeEvent(event.id)
        return
      }
      client.setTimeout(async () => {
        this.eventsDB.removeEvent(event.id)
        const channel = client.channels.cache.get(event.channelId)
        if (channel) {
          const messageLines = [
                    `(#${event.id}) **${event.name}** is starting now!`,
                    ...this.getDescriptionLines(event)
          ]
          for (const attending of event.attending) {
            messageLines.push((await this.getOrFetchUser(client, attending)).toString())
          }
          await (channel as TextChannel).send(messageLines.join('\n'))
        }
      }, event.timeUntilStart())
    }

    private async getCreatedByLine (client: Client, event: DiscordEvent): Promise<string> {
      return `Created by: _${(await this.getUserName(client, event.creatorId))}_`
    }

    private getDescriptionLines (event: DiscordEvent): string[] {
      if (event.description) {
        return [`Description: _${event.description}_`]
      }
      return []
    }

    private async getUserName (client: Client, userId: string): Promise<string> {
      const user = await this.getOrFetchUser(client, userId)
      return user.username
    }

    private async getOrFetchUser (client: Client, userID: string): Promise<User> {
      const user = client.users.cache.get(userID)
      if (user) {
        return Promise.resolve(user)
      } else {
        return client.users.fetch(userID)
      }
    }
}
