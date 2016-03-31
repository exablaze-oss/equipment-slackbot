/**
 * Manage equipment by reserving it or seeing who currently has it
 * reserved.
 */
var https = require('https');
var  _ws = require('ws');
var jsonfile = require('jsonfile');
var ws, slackId;
var equipment;
var file = 'equipment.json';
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
        var channelId = null;
        ws = new _ws(rtm.url);
        slackId = rtm.self.id;

        try {
            equipment = jsonfile.readFileSync(file); 
        } catch (err) {
            equipment = [];
        }

        console.log("Logging into " + rtm.team.name + "'s Slack...");
        for (var i = 0; i < rtm.channels.length; i++)
        {
            if (rtm.channels[i].name == config.channel_name) 
            {
                channelId = rtm.channels[i].id;
                break;
            }
        }
         
        if (channelId != null)
        {
            console.log("Found " + config.channel_name + " channel with ID " + 
                          channelId);
            ws.on('open', function() {
                joinChannel(rtm.team.name, channelId);
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

function joinChannel(teamName, channelID) {

    console.log("Listening for new messages...");

    ws.on('message', function(data) {
        var event = JSON.parse(data);
        if(event.type === "message" && event.user !== slackId) {

            var text = event.text.toLowerCase();
            var response = parseRequest(text, event.user); 

            if (response != null)
            {
                ws.send(JSON.stringify({
                  "id": counter,
                  "type": "message",
                  "channel": channelID,
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
            return "Checked out " + name + " for user " + user.name;
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
        return "There's no equipments!";
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


function parseRequest(request, userid) {
    if (request.search("help") >= 0)
    {
        return "help - this screen\n" +
          "using <name> - is anyone using the thing with <name>\n" +
          "checkout <name> - reserve equipment <name> for your use\n" +
          "release <name> - release a piece of equipment for use.\n" +
          "create <name> - create a new equipment entry\n" +
          "delete <name> - delete an existing equipment entry\n" +
          "list - list all the equipment and who is using it\n";
    }
    else if (request.search("using") >= 0)
    {
        name = getWordAfter(request, "using");
        if (name != null)
        {
            return usingEquipment(name);
        }
    }
    else if (request.search("checkout") >= 0) 
    {
        name = getWordAfter(request, "checkout");
        if (name != null)
        {
            return checkoutEquipment(name, userid);
        }
    }
    else if (request.search("release") >= 0)
    {
        name = getWordAfter(request, "release");
        if (name != null)
        {
            return releaseEquipment(name, userid);
        }
    }
    else if (request.search("create") >= 0)
    {
        name = getWordAfter(request, "create");
        if (name != null)
        {
            return createEquipment(name);
        }
    }
    else if (request.search("delete") >= 0)
    {
        name = getWordAfter(request, "delete");
        if (name != null)
        {
            return deleteEquipment(name);
        }
    }
    else if (request.search("list") >= 0)
    {
        return listEquipment();
    }

    return null;
}
