/**
 * Manage equipment by reserving it or seeing who currently has it
 * reserved.
 */
var https = require('https');
var  _ws = require('ws');
var jsonfile = require('jsonfile');
var ws, slackId;
var equipment;
var staffNumbers;
var file = 'equipment.json';
var phone_numbers_file = 'phone_numbers_file.json';
var counter = 0;
var rtm;
var config = jsonfile.readFileSync("config.json");

https.get("https://slack.com/api/rtm.start?token=" + config.slack_api_token,
  function(res) {
    console.log("Connecting to Slack...");
    var data = "";
    res.on('data', function(chunk) {
        data += chunk;
    }).on('error', function(err) {
        console.log("Couldn't connect to slack - check your API token in " +
                      " config.json");
    }).on('end', function() {
        rtm = JSON.parse(data);
        var mainChannelId = null;
        ws = new _ws(rtm.url);
        slackId = rtm.self.id;

        try {
            equipment = jsonfile.readFileSync(file);
        } catch (err) {
            equipment = [];
        }

        try {
            staffNumbers = jsonfile.readFileSync(phone_numbers_file);
        } catch (err) {
            staffNumbers = [];
        }

        console.log("Logging into " + rtm.team.name + "'s Slack...");
        for (var i = 0; i < rtm.channels.length; i++)
        {
            if (rtm.channels[i].name == config.channel_name)
            {
                mainChannelId = rtm.channels[i].id;
                break;
            }
        }

        if (mainChannelId != null)
        {
            console.log("Found " + config.channel_name + " channel with ID " +
                          mainChannelId);
            ws.on('open', function() {
                handleMessages(mainChannelId);
            });
        }
        else
        {
            console.log("Couldn't find channel " + config.channel_name + ".");
        }
    })
});

function addUser(user) {
    rtm.users.push(user);
}

function getUserById(id) {
    for (var i = 0; i < rtm.users.length; i++)
    {
        if (rtm.users[i].id == id)
        {
            return rtm.users[i];
        }
    }

    return null;
}

function handleMessages(mainChannelId) {

    console.log("Listening for new messages...");

    ws.on('message', function(data) {
        var event = JSON.parse(data);
        if(event.type === "message" && event.user !== slackId && event.text != null) {

            var text = event.text.toLowerCase();
            var allowmod = (event.channel == mainChannelId);
            var response = parseRequest(text, event.user, allowmod);

            if (response != null)
            {
                ws.send(JSON.stringify({
                  "id": counter,
                  "type": "message",
                  "channel": event.channel,
                  "text": response
                }))
                counter++;
            }
        }
        else if (event.type === "team_join") {
            addUser(event.user);
        }
    });
}

function getWordAfter(array, word) {

    s = array.split(" ");
    var name;
    for (var i = 0; i < s.length; i++)
    {
        if (s[i].search(word) >= 0 && i != s.length - 1)
        {
            name = s[i+1];
            return name;
        }
    }
    return null;
}

function findEquipment(name) {
    for (var i = 0; i < equipment.length; i++)
    {
        if (equipment[i].name == name)
        {
            return i;
        }
    }
    return null;
}

function usingEquipment(name) {
    var id = findEquipment(name);
    if (id != null)
    {
        if (equipment[id].user != null)
        {
            return getUserById(equipment[id].user).name + " is using " + name +
               " (has been for " + elapsedTimeInHours(equipment[id].checkout) +
                " hours)";
        }
        else
        {
            return "Noone is currently using " + name;
        }
    }
    return "There's nothing called " + name;
}

function checkoutEquipment(name, userid) {
    var id = findEquipment(name);

    if (id != null)
    {
        if (equipment[id].user != null)
        {
            return getUserById(equipment[id].user).name + " is using " + name +
                    " ask them first!";
        }
        else
        {
            var user = getUserById(userid);
            equipment[id].user = userid;
            equipment[id].checkout = (new Date()).getTime();
            jsonfile.writeFileSync(file, equipment);
            var reply = "Checked out " + name + " for user " + user.name + "\n";
            if (equipment[id].note != null)
            {
                reply = reply + "Notes:\n" + equipment[id].note;
            }
            return reply;
        }
    }

    return "There's no equipment called " + name;
}

function releaseEquipment(name) {
    var id = findEquipment(name);
    if (id != null)
    {
        if (equipment[id].user == null)
        {
            return "Noone is using " + name + "!";
        }
        else
        {
            var old_userid = equipment[id].user;
            equipment[id].user = null;
            jsonfile.writeFileSync(file, equipment);
            return "Released " + name + " (was being used by " +
                getUserById(old_userid).name + " for " +
                  elapsedTimeInHours(equipment[id].checkout) + " hours)";
        }
    }
    return "There's no equipment called " + name;
}

function createEquipment(name) {
    var id = findEquipment(name);
    if (id == null)
    {
        equipment.push({ "name": name, "user": null, "checkout": null});
        jsonfile.writeFileSync(file, equipment);
        return "Created " + name + "!";
    }
    return name + " already exists!";
}

function deleteEquipment(name) {
    var id = findEquipment(name);
    if (id != null)
    {
        equipment.splice(id, 1);
        jsonfile.writeFileSync(file, equipment);
        return "Deleted " + name + " (hope nobody cared about it!)";
    }
    return name + " doesn't exist!";
}


function addEquipmentNote(name, note) {
    var id = findEquipment(name);
    if (id != null)
    {
        if( equipment[id].note == null )
            equipment[id].note = note;
        else
            equipment[id].note = equipment[id].note + "\n" + note;
        jsonfile.writeFileSync(file, equipment);
        return "Added note " + note + " to equipment " + name;
    }
    else
    {
        return "Equipment " + name + " not found!";
    }
}

function showEquipmentNote(name) {
    var id = findEquipment(name);
    if (id != null)
    {
        return equipment[id].name + ": " + equipment[id].note;
    }
    else
    {
        return "Equipment " + name + " not found!";
    }
}

function clearEquipmentNote(name) {
    var id = findEquipment(name);
    if (id != null)
    {
        equipment[id].note = null;
        jsonfile.writeFileSync(file, equipment);
        return "Cleared notes from " + name;
    }
    else
    {
        return "Equipment " + name + " not found!";
    }
}

function elapsedTimeInHours(oldtime) {
    var d = new Date();
    var diff = d.getTime() - oldtime;
    diff = diff / 1000;
    diff = diff / 3600;
    diff = Math.round(diff * 10) / 10;
    return diff;
}

function listEquipment() {
    equipment.sort(function(a,b) {
        if (a.name > b.name)
        {
            return 1;
        }
        if (a.name < b.name)
        {
            return -1;
        }

        return 0;
    });

    var reply = "";

    if (equipment.length == null || equipment.length === 0)
    {
        return "There's no equipment!";
    }

    for (var i = 0; i < equipment.length; i++)
    {
        reply = reply + "  " + equipment[i].name;
        if (equipment[i].user != null)
        {
            reply = reply + " (in use by " +
                getUserById(equipment[i].user).name;
            if (equipment[i].checkout != null)
            {
                reply = reply + " for " +
                  elapsedTimeInHours(equipment[i].checkout) + " hours)\n";
            }
            else
            {
                reply = reply + ")\n"
            }
        }
        else
        {
            reply = reply + " (not in use)\n";
        }
    }

    return "Here's the stuff I know about:\n" + reply;
}

function listEquipmentNotes() {
    equipment.sort(function(a,b) {
        if (a.name > b.name)
        {
            return 1;
        }
        if (a.name < b.name)
        {
            return -1;
        }

        return 0;
    });

    var reply = "";

    if (equipment.length == null || equipment.length === 0)
    {
        return "There's no equipment!";
    }

    for (var i = 0; i < equipment.length; i++)
    {
        reply = reply + "  " + equipment[i].name;
        if (equipment[i].note != null)
        {
            reply = reply + " - " + equipment[i].note + "\n";
        }
        else
        {
            reply = reply + " - no notes.\n";
        }
    }

    return "Here's the stuff I know about:\n" + reply;
}

function findStaff(userid) {
    for (var i = 0; i < staffNumbers.length; i++)
    {
        if (staffNumbers[i].userid == userid)
        {
            return i;
        }
    }
    return null;
}

function addStaffPhoneNumber(userid, number) {
    var user = getUserById(userid);
    var idx = findStaff(userid);
    if (idx == null)
    {
        staffNumbers.push({ "name": user.name, "number": number, "userid": userid});
        jsonfile.writeFileSync(phone_numbers_file, staffNumbers);
        return "Created staff " + user.name + " with number " + number;
    }
    else //update existing
    {
        staffNumbers[idx].name = user.name;
        if (staffNumbers[idx].number == null)
            staffNumbers[idx].number = number;
        else
            staffNumbers[idx].number = staffNumbers[idx].number +"; " + number;
        staffNumbers[idx].userid = userid;
        jsonfile.writeFileSync(phone_numbers_file, staffNumbers);
        return "Updated number " + number + " for staff " + user.name;
    }
}

function clearStaffPhoneNumber(userid) {
    var user = getUserById(userid);
    var idx = findStaff(userid);
    if (idx != null)
    {
        staffNumbers[idx].number = null;
        jsonfile.writeFileSync(phone_numbers_file, staffNumbers);
        return "Cleared number for " + user.name;
    }
    else
    {
        return "Staff " + user.name + " not found!";
    }
}

function listStaffPhoneNumbers() {
    staffNumbers.sort(function(a,b) {
        if (a.name > b.name)
        {
            return 1;
        }
        if (a.name < b.name)
        {
            return -1;
        }
        return 0;
    });

    var reply = "";

    if (staffNumbers.length == null || staffNumbers.length === 0)
    {
        return "There's no staff numbers!";
    }

    for (var i = 0; i < staffNumbers.length; i++)
    {
        reply = reply + "  " + staffNumbers[i].name;
        if (staffNumbers[i].number != null)
        {
            reply = reply + ":  " + staffNumbers[i].number + "\n";
        }
        else
        {
            reply = reply + " - no number.\n";
        }
    }

    return "Here's the people I know about:\n" + reply;
}

function parseRequest(request, userid, allowmod) {
    if (request.search("help") == 0)
    {
        return "help - this screen\n" +
            "EQUIPMENT:\n" +
            "using <name> - is anyone using the thing with <name>\n" +
            "checkout <name> - reserve equipment <name> for your use\n" +
            "release <name> - release a piece of equipment for use.\n" +
            "create <name> - create a new equipment entry\n" +
            "delete <name> - delete an existing equipment entry\n" +
            "list - list all the equipment and who is using it\n" +
            "\n" +
            "EQUIPMENT NOTES:\n" +
            "add_note <name> <note> - add to the <note> for equipment <name>\n" +
            "show_note <name> - show the note for equipment <name>\n" +
            "clear_note <name> - clear the note for equipment <name>\n" +
            "list_notes - list all equipment and notes about the equipment\n" +
            "\n" +
            "PHONE NUMBERS:\n" +
            "add_my_number <phone_number> - add the <phone_number> for the user\n" +
            "clear_my_number - clear the phone number for the user\n" +
            "list_phone_numbers - list all recorded user phone numbers\n" +
            "\n" +
            "Please note commands must be at the start of a message.\n";
    }
    else if (request.search("using") == 0)
    {
        name = getWordAfter(request, "using");
        if (name != null)
        {
            return usingEquipment(name);
        }
    }
    else if (request.search("checkout") == 0)
    {
        name = getWordAfter(request, "checkout");
        if (name != null)
        {
            return checkoutEquipment(name, userid);
        }
    }
    else if (request.search("release") == 0)
    {
        name = getWordAfter(request, "release");
        if (name != null)
        {
            return releaseEquipment(name, userid);
        }
    }
    else if (request.search("create") == 0)
    {
        if (!allowmod)
            return "create not allowed in this channel";

        name = getWordAfter(request, "create");
        if (name != null)
        {
            return createEquipment(name);
        }
    }
    else if (request.search("delete") == 0)
    {
        if (!allowmod)
            return "delete not allowed in this channel";

        name = getWordAfter(request, "delete");
        if (name != null)
        {
            return deleteEquipment(name);
        }
    }
    else if (request.search("add_note") == 0)
    {
        if (!allowmod)
            return "editing not allowed in this channel";

        name = getWordAfter(request, "add_note");
        if (name != null)
        {
            var note = request.substr(request.indexOf(name) + name.length);
            return addEquipmentNote(name, note);
        }
    }
    else if (request.search("show_note") == 0)
    {
        name = getWordAfter(request, "show_note");
        if (name != null)
        {
            return showEquipmentNote(name);
        }
    }
    else if (request.search("clear_note") == 0)
    {
        if (!allowmod)
            return "editing not allowed in this channel";

        name = getWordAfter(request, "clear_note");
        if (name != null)
        {
            return clearEquipmentNote(name);
        }
    }
    else if (request.search("list_notes") == 0)
    {
        return listEquipmentNotes();
    }
    else if (request.search("add_my_number") == 0)
    {
        if (!allowmod)
            return "editing not allowed in this channel";

        phone_number = getWordAfter(request, "add_my_number");
        return addStaffPhoneNumber(userid, phone_number);
    }
    else if (request.search("clear_my_number") == 0)
    {
        if (!allowmod)
            return "editing not allowed in this channel";

        return clearStaffPhoneNumber(userid);
    }
    else if ((request.search("list_phone_numbers") == 0) || (request.search("list_numbers") == 0))
    {
        return listStaffPhoneNumbers();
    }
    else if (request.search("list") == 0)
    {
        return listEquipment();
    }

    return null;
}
