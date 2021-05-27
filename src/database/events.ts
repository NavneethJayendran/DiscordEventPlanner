import DiscordEvent from '../data/discord-event'
import fs from 'fs'
import { classToPlain, plainToClass } from 'class-transformer'

export default class EventsDatabase {
    events: DiscordEvent[];

    constructor () {
      this.events = []
    }

    load () {
      const data = fs.readFileSync('./build/db/events.json').toString()
      JSON.parse(data).forEach((element: Object) => {
        this.upsertEvent(plainToClass(DiscordEvent, element))
      })
    }

    save () {
      fs.writeFileSync('./build/db/events.json', JSON.stringify(classToPlain(this.events)))
    }

    getEvent (eventId: string): DiscordEvent | null {
      const index = this.events.findIndex(e => e.id === eventId)
      if (index !== -1) {
        return this.events[index]
      }
      return null
    }

    getEvents (): DiscordEvent[] {
      return this.events
    }

    upsertEvent (event: DiscordEvent) {
      const index = this.events.findIndex(e => e.id === event.id)
      if (index !== -1) {
        this.events[index] = event
      } else {
        this.events.push(event)
      }
      this.save()
    }

    removeEvent (eventId: string): DiscordEvent | null {
      const index = this.events.findIndex(e => e.id === eventId)
      if (index === -1) {
        return null
      }
      const out = this.events[index]
      this.events.splice(index, 1)
      this.save()
      return out
    }

    getNextEventID (): string {
      return this.events.length.toString()
    }
}
