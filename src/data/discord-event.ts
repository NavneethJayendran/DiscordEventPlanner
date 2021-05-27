import { Type } from 'class-transformer'

export default class DiscordEvent {
    id: string;
    creatorId: string;
    name: string;
    description: string;
    @Type(() => Date)
    startTime: Date;

    invited: string[];
    attending: string[];
    skipping: string[];
    channelId: string;

    constructor (id: string, name: string, description: string, startTime: Date, creatorId: string, channelId: string) {
      this.id = id
      this.name = name
      this.description = description
      this.creatorId = creatorId
      this.invited = []
      this.attending = [creatorId]
      this.skipping = []
      this.startTime = startTime
      this.channelId = channelId
    }

    addInvitedIfNotAlready (discordId: string) {
      if ([this.invited, this.skipping, this.attending].some(list => list.includes(discordId))) {
        return false
      }
      this.addToSet(this.invited, discordId)
      this.removeFromSet(this.attending, discordId)
      this.removeFromSet(this.skipping, discordId)
      return true
    }

    addAttendee (discordId: string) {
      this.addToSet(this.attending, discordId)
      this.removeFromSet(this.skipping, discordId)
      this.removeFromSet(this.invited, discordId)
    }

    addSkipper (discordId: string) {
      this.addToSet(this.skipping, discordId)
      this.removeFromSet(this.attending, discordId)
      this.removeFromSet(this.invited, discordId)
    }

    timeUntilStart (): number {
      return this.startTime.getTime() - new Date().getTime()
    }

    private addToSet (set: string[], item: string) {
      if (!set.includes(item)) {
        set.push(item)
      }
    }

    private removeFromSet (set: string[], item: string) {
      const copy = set.filter(s => s !== item)
      set.length = 0
      copy.map(s => set.push(s))
    }
}
