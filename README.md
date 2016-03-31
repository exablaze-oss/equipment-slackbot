# equipment-slackbot

Manage shared equipment via a slack bot. Useful for a lab or anywhere a pool of
shared equipment is used and you need to track down whether someone is
currently using it (and who that person is).

## Getting started

Install dependencies:

    npm install

Edit `config.json` and add your Slack API token, and the name of the channel you
want the bot to operate in (this must already be created). Then:

    npm start

You'll need to manually invite the bot to the channel.

## Using the bot

Use varations of:

* `help` to get some help
* `using <name>` to see who is using <name>
* `checkout <name>` to checkout equipment called <name> and start using it
* `release <name>` to release <name> from whoever is using it
* `create <name>` to create a piece of equipment called <name>
* `delete <name>` to delete <name> from the list
* `list` to list all equipment

Equipment entries are stored persistently in equipment.json.
