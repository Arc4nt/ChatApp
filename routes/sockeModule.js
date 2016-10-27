var io = require('socket.io');
var Promise = require('promise');
var chat;

var emitter = require('./Emitter.js').emitter;

emitter.on("getAllData",function(user,req,res){getAllData(user,req,res);})

emitter.on("sendLogoutNotification",function(user){ sendLogoutNotification(user);})

emitter.on("sendLoginNotification", function (user){ sendLoginNotification(user); })

emitter.on("sendRequest", function (me, contact){ sendRequest(me, contact); })

emitter.on("deleteUserSocket", function (me, contact) { deleteUserSocket(me, contact); })

emitter.on("acceptRequest",function(me,contact){ acceptRequest(me, contact);})

emitter.on("requestToJoinGroupChat", function (obj, user) {
    io.of("/chat").to(user).emit("requestToJoinGroupChat", obj);
    chat.to(obj.group).emit("joined", obj);
})

emitter.on("leaveChat", function (user, group) { io.of('/chat').to(user).emit('leaveChat', { group: group }); });


exports.init = function (http) {
    io = io(http);
    chat = io.of('/chat');
    chat.on('connection', function (socket) {
        
        
        socket.on('id', function (data) {
            socket.join(data.id);
            for (var i = 0; i < data.groups.length; i++) {
                socket.join(data.groups[i].group);
            }
        })
        .on('dissconect', function (data) {
            socket.disconnect();
        })
        socket.on("sendMsg", function (data) {
            chat.to(data.msg[0].from).emit("incommingMsg", data);
            chat.to(data.to).emit("incommingMsg", data);
        })
        socket.on("sendGroupMsg", function (data) {
            chat.to(data.to).emit("incommingMsg", data);
        })
        socket.on("aceptedGroupChat", function (data) {
            socket.join(data.group)
        })
        socket.on("removeFromChat", function (data) {
            chat.to(data.group).emit("removeUserFromGroup", data);
            socket.leave(data.group);
        })     
    })
    return io;
}





function sendRequest(me, contact) {
    io.of("/chat").to(contact).emit("contactRequest", { "from": me })
}

function acceptRequest(me, contact) {
    io.of("/chat").to(contact.userID).emit("acceptRequest", { "from": me.userID , "status": me.connected })
    io.of("/chat").to(me.userID).emit("acceptRequest", { "from": contact.userID , "status": contact.connected})
}

function deleteUserSocket(me, contact) {
    io.of("/chat").to(contact).emit("delete", { "from": me})
    io.of("/chat").to(me).emit("delete", { "from": contact })
    //need to implement this and check adduser or accept one of those 2         
}

function sendLoginNotification(me) {
    for (var i = 0; i < me.contacts.length; i++) {
        io.of("/chat").to(me.contacts[i].userID).emit("loginNotification", { "from": me.userID });
    }
}

function sendLogoutNotification(me) {
    for (var i = 0; i < me.contacts.length; i++) {
        io.of("/chat").to(me.contacts[i].userID).emit("logoutNotification", { "from": me.userID });      
    }
    io.of("/chat").to(me.userID).emit("logoutNotification", { "from": me.userID });
}

