import { Client } from '@typeit/discord'
import { config as envConfig } from 'dotenv'
import 'reflect-metadata';

envConfig({ debug: true, path: `${__dirname}/.env` })

export class Main {
    private static _client: Client;

    static get Client (): Client {
      return this._client
    }

    static async start () {
      this._client = new Client()

      await this._client.login(
        process.env.TOKEN || '',
	    `${__dirname}/app/*.ts`,
	    `${__dirname}/app/*.js`
      )

      console.log(Client.getCommands())
    }
}

Main.start().catch(err => {
  console.log(err)
})
