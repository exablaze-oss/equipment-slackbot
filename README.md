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
* `using <name>` to see who is using `<name>`
* `checkout <name>` to checkout equipment called `<name>` and start using it
* `release <name>` to release `<name>` from whoever is using it
* `create <name>` to create a piece of equipment called `<name>`
* `delete <name>` to delete `<name>` from the list
* `list` to list all equipment
* ``
* `set_note <name> <note>` to apply the <note> for equipment `<name>`
* `show_note <name>` to show the note for equipment `<name>`
* `clear_note <name>` to clear the note for equipment `<name>`
* `list_notes` to list all notes for all equipment
* ``
* `add_my_number <phone_number>` to add a phone number for the user
* `clear_my_number <name>` to clear the phone numbers for the user
* `list_phone_numbers` or `list_numbers` to list all recorded user phone numbers

Equipment entries are stored persistently in equipment.json.
Phone entries are stored persistently in phone_numbers.json.
