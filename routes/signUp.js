
var path = require('path');
var emitter = require('./Emitter.js').emitter;
var Promise = require('promise');

exports.validate = function (req, res, next) {
    //console.log("validating");
    if (req.session.user && req.session.user != null) {
        //console.log("waaa");
        var findUser = new Promise(function (resolve, reject) {
            req.collections.users.findOne({
                userID: req.session.user
            }, function (error, user) {
                //console.log("looking in users")
                if (error) { reject(error); }
                if (!user) {//no user added so far so its not connected
                    reject("couldnt find user");
                } else {//theres a user so it cant login
                    resolve(user);
                }
            })
        })
        findUser.then(function (user) { getAllData(user, req, res) }, function (error) { res.writeHead(401); res.end(error); })
        
    } else {
        res.writeHead(401);
        res.end("  ")
        return;
    }
  
}


exports.home = function (req, res, next) {
    //console.log("sweet home alabamaaaa");
    
    res.sendFile(path.join(__dirname, '../views', "index.html"));
}

exports.postSignUp = function (req, res, next) {
    
    //console.log("Post signup ");
    for (key in req.body) {
        //console.log(req.body[key]);
        if (req.body[key] == "") {
            //console.log("empty items!!!");
            res.writeHead(401);
            res.end("at least one field was missing");
        }
    }
    if (req.body.password1 != req.body.password2) {
        res.writeHead(401);
        res.end("passwords were different");
    }
    var findUser = new Promise(function (resolve, reject) {
        req.collections.users.findOne({
            userID: req.body.ID
        }, function (error, user) {
            if (error) reject(error);
            if (!user) {
                resolve();
            }
            reject("id already in use");
        })
    });
    var findName = new Promise(function (resolve, reject) {
        req.collections.users.findOne({
            userName: req.body.userName
        }, function (error, user) {
            if (error) reject(error);
            if (!user) {
                resolve();
            }
            reject("username already in use");
        })
    });
    var findEmail = new Promise(function (resolve, reject) {
        req.collections.users.findOne({
            email: req.body.email
        }, function (error, user) {
            if (error) reject(error);
            if (!user) { resolve(); }
            reject("email already in use");
        })
    });
    Promise.all([findEmail, findUser,findName]).then(function () {
        var obj = { "userName": req.body.userName, "userID": req.body.ID, "email": req.body.email, "password": req.body.password1, "contacts": [], "pendingContacts": [], "requestedToContact": [], "connected": false, "groups": [] }
        req.collections.users.insert(obj, function (error, response) {
            if (error) return next(error);
            //console.log("added");
            //console.log(response);
            login(response.ops[0], req, res, next);
        });
        //console.log("adding");
    },
             function (error) {
        res.writeHead(401);
        res.end(error);
    });
};

function login(obj, req, res, next) {
    //console.log("in login");
    var findUser = new Promise(function (resolve, reject) {
        req.collections.users.findOne(obj, 
         function (error, user) {
            if (error) {
                reject(error);
            }
            if (!user) {
                reject()
                res.end("user or password incorrect");
            }
            else {//pass and user correct
                resolve(user);
            }
        })
    });
    findUser.then(function (user) {
        if (user.connected == true) {
            //console.log("user Already connected");
            res.writeHead(401);
            res.end("user Already connected");
        }
        else {
            user.connected = true;
            req.collections.users.update({ 'userID': user.userID }, user, function (error, response) {
                //console.log("updating to connected")
                if (error) { //console.log("couldnt change its status to connected");
                    return next(error);
                }
                else {
                    //console.log("changing to connected");
                    //console.log(user.userID);
                    
                    req.session.user = user.userID;
                    emitter.emit("sendLoginNotification", user);///sendLoginNotification(user);
                    getAllData(user, req, res);
                        //emitter.emit("getAllData", user, req, res);//
                           // next(new Error("welcome" + user.ID));
                }
            });
        }
    })
    
}
//validate fields you need to
exports.postLogin = function (req, res, next) {// obj totally unnecesary but mah too lazy
    //console.log("Post login ");
    var obj = {
        userName: req.body.userName,
        password: req.body.password
    };
    login(obj, req, res, next);
    //check user and pass here obj is not necesary but meh oh look I had that already written
   
};

exports.logout = function (req, res, next) {
    //console.log("wea");
    if (req.session.user) {
        var findUser = new Promise(function (resolve, reject) {
            req.collections.users.findOne({
                userID: req.session.user
            }, function (error, user) {
                //console.log("looking for user to logout");
                if (!user) {
                    reject("the user doesnt exist");
                    //There is not a contact                  
                }
                else {
                    resolve(user);
                }
            })
        });
        findUser.then(function (user) {
            //console.log("user exits to add ");
            if (user.connected == false) {
                //console.log("the user is not connected so you cant logout")
                res.writeHead(401);
                res.end("if you are not connected you cant logout");//need to throw something as MsgError for letting know it couldnt add 
            } else {
                user.connected = false;
                req.collections.users.update({ 'userID': req.session.user }, user, function (error, response) {
                    //console.log("updating the logout user connected status")
                    if (error) {
                        res.writeHead(401);
                        res.end("could not modify data into logout user");//need to throw something as MsgError for letting know it couldnt add 
                    }
                    else {
                        emitter.emit("sendLogoutNotification", user);//sendLogoutNotification(user);
                        req.session.user = null;
                        //console.log("user logged out correctly");
                        res.writeHead(200);
                        res.end();
                    }
                })
            }
        }, function (error) {
            res.writeHead(401);
            res.end(error);
        })
    }
    else {
        //console.log("it didnt eve enter");
        res.writeHead(401);
        res.end("No user");
    }
}

exports.acceptUser = function (req, res, next) {
    
    //console.log("looking for me user to accept user");
    var me = req.session.user;
    var contact = req.body.userID;
    var findUser = new Promise(function (resolve, reject) {
        req.collections.users.findOne({
            userID: me
        }, 
         function (error, user) {
            //console.log("looking for me user to accept user" + me);
            if (error) { reject(error); }
            if (!user) {//no user added so far so need to send a mistake
                reject("me user doesnt exist in acceptUser");
            } else {
                resolve(user);
            }

        })
    });
    var findContact = new Promise(function (resolve, reject) {
        req.collections.users.findOne({
            userID: contact
        }, function (errorContact, userContact) {
            //console.log("looking for contact user to accept user" + contact);
            if (!userContact) {
                reject("contact user doesnt exist to accept user");
            }
            else { resolve(userContact); }
        })
    });
    Promise.all([findUser, findContact]).then(function (arrayParams) {
        var user = arrayParams[0];
        var userContact = arrayParams[1];
        var updateUserContacts = new Promise(function (resolve, reject) {
            //console.log(userContact);
            for (var i = 0; i < user.requestedToContact.length; i++) {
                if (user.requestedToContact[i].userID == contact) {
                    user.requestedToContact.splice(i, 1);
                }
            }
            //console.log("starting to add in to accept user " + userContact);
            user.contacts.push({ "userID": contact });
            //if (userContact.connected == true) {
                emitter.emit("acceptRequest", user, userContact);//acceptRequest(me, contact);            
           // }
            
            req.collections.users.update({ 'userID': me }, user, function (error, response) {
                //console.log("inserting pending contact to me  in to accept user")
                if (error) {
                    reject("could not insert the data into me user  in to accept user");
                }
                else {//All good and was added
                    resolve("a");
                }
            })
        });
        var updateContactContacts = new Promise(function (resolve, reject) {
            //console.log("aDDeD to me correctly  in to accept user");
            for (var i = 0; i < userContact.pendingContacts.length; i++) {
                if (userContact.pendingContacts[i].userID == me) {
                    userContact.pendingContacts.splice(i, 1);
                }
            }  
            userContact.contacts.push({ "userID": me });
            req.collections.users.update({ 'userID': contact }, userContact, function (error2, response2) {
                //console.log("inserting requested contacts to the contact in to accept user")
                if (error2) {
                   reject("could not insert the data into contact user in to accept user");
                }
                else {//All good and was added
                    resolve("a");
                   
                }
            })
        });
        Promise.all([updateUserContacts, updateContactContacts]).then(function (arrayParams) {
            getAllData(user, req, res);
        }, function (error) {
            res.writeHead(401);
            res.end(error);
         })    
    }, function (error) {
        res.writeHead(401);
        res.end(error);})
}

exports.rejectUser = function (req, res, next) {
    var me = req.session.user;
    var contact = req.body.userID;
    var findUser = new Promise(function (resolve, reject) {
        req.collections.users.findOne({
            userID: me
        }, 
     function (error, user) {
            //console.log("looking for me user to reject user" + me);
            if (error) { reject(error); }
            if (!user) {//no user added so far so need to send a mistake
                reject("me user doesnt exist in rejectUser");//need to throw something as MsgError for letting know it couldnt add 
            } else {
                //console.log("resolving 1 to rejectUser")
                resolve(user);//theres a user so it cant try to add now time to check for the destination
            }

        })
    });
    var findContact = new Promise(function (resolve, reject) {
        req.collections.users.findOne({
            userID: contact
        }, function (errorContact, userContact) {
            //console.log("looking for contact user to rejectUser" + contact);
            if (!userContact) {
                //There is not a contact
                reject("contact user doesnt exist to rejectUser");
            }
            else {
                //console.log("resolving 2 rejectUser")
                resolve(userContact);
            }
        })
    });
            
    Promise.all([findUser, findContact]).then(function (params){
        //console.log("iddar")
        var user = params[0];
        var userContact = params[1];
        var removeFromUser = new Promise(function (resolve, reject) {
            //console.log("starting to add in to rejectUser " + contact);
            var index = user.requestedToContact.indexOf(contact);
            user.requestedToContact.splice(index, 1);
            req.collections.users.update({ 'userID': me }, user, function (error, response) {
                //console.log("inserting pending contact to me  in to rejectUser")
                if (error) {
                    reject("could not insert the data into me user  in to rejectUser");
                }
                else {//All good and was added
                    //console.log("aDDeD to me correctly  in to rejectUser");
                    resolve("a");
                }
            })
        });
        var removeFromContact = new Promise(function (resolve, reject) {
            var index = user.pendingContacts.indexOf(contact);
            userContact.pendingContacts.splice(index, 1);
            req.collections.users.update({ 'userID': contact }, userContact, function (error2, response2) {
                //console.log("inserting requested contacts to the contact in to rejectUser")
                if (error2) {
                  reject("could not insert the data into contact user in torejectUser");
                }
                else {//All good and was added
                    //console.log("aDDeD to contact correctly in to rejectUser");
                    resolve("a");
                }
            })
        });
        Promise.all([removeFromUser, removeFromContact]).then(function (params) {
            //emitter.emit("getAllData", user, req, res);// 
            getAllData(user, req, res);
        }, function (error) {
            res.writeHead(401);
            res.end(error);
        });
        }, function (error){
            res.writeHead(401);
          res.end(error);
        })       
                }
 

exports.addContact = function (req, res, next) {
    //console.log("we are in addContact")
    //console.log(req.cookies);
    var me = req.session.user;
    var contact = req.body.contact;
    if (contact == me){
        res.writeHead(401);
        res.end("you can talk to yourself in the default tab");
        return;
    }
    var findUser = new Promise(function (resolve, reject) {
        req.collections.users.findOne({
            userID: me
        }, function (error, user) {
            //console.log("looking for me user" + me);
            if (error) return next(error);
            if (!user) {//no user added so far so need to send a mistake
              reject("user doesnt exist");//need to throw something as MsgError for letting know it couldnt add 
            } else {//theres a user so it cant try to add now time to check for the destination
                for (var i = 0; i < user.requestedToContact.length; i++) {
                    if (user.requestedToContact[i].userID == contact) {
                        
                        reject("user Already in the requested list lists");
                        return;
                    }
                }
                for (var i = 0; i < user.pendingContacts.length; i++) {
                    if (user.pendingContacts[i].userID == contact) {
                       reject("user Already in pending contacts he needs to accept");
                        return;
                    }
                }
                for (var i = 0; i < user.contacts.length; i++) {
                    if (user.contacts[i].userID == contact) {
                       reject("user Already is a Friend");
                        return;
                    }
                }
                resolve(user);
            }
                })
    });
    
    var findContact = new Promise(function (resolve, reject) {
        req.collections.users.findOne({
            userID: contact
        }, function (errorContact, userContact) {
            //console.log("looking for contact user" + contact);
            if (!userContact) {
                //There is not a contact
                reject("contact user doesnt exist");//need to throw something as MsgError for letting know it couldnt add 
            }
            else { resolve(userContact); }
        })
    });
    
    Promise.all([findUser, findContact]).then(function (parameters) {
        //console.log("wakajsjsj")
        var user = parameters[0];
        var userContact = parameters[1];
        
        var updateUser = new Promise(function (resolve, reject) {
            //console.log("starting to add " + contact);
            user.pendingContacts.push({ "userID": contact });
            req.collections.users.update({ 'userID': me }, user, function (error, response) {
                //console.log("inserting pending contact to me")
                if (error) {
                    reject("could not insert the data into me user");
                }
                else {
                    //console.log("resolving1");
                    resolve(response);
                }
            })
        })
        var updateContact = new Promise(function (resolve, reject) {
            //All good and was added
            //console.log("aDDeD to me correctly");
            userContact.requestedToContact.push({ "userID": me });
            req.collections.users.update({ 'userID': contact }, userContact, function (error2, response2) {
                //console.log("inserting requested contacts to the contact")
                if (error2) {
                    reject("could not insert the data into contact user");
                }
                else {//All good and was added
                    //console.log("aDDeD to contact correctly");
                    //console.log("wariooo");
                    resolve(response2);
                }
            })
        });
        
        Promise.all([updateUser, updateContact]).then(function (params) {
            if (userContact.connected) {
                //console.log("luigiii");
                emitter.emit("sendRequest", me, contact);//sendRequest(me, contact);
            }
            //emitter.emit("getAllData", user, req, res);//
            getAllData(user, req, res);
        })

    }, function (error) {
        res.writeHead(401);
        res.end(error);
    });
}

exports.deleteUser = function (req, res, next) {
    
    //console.log("deleting");
    var me = req.session.user;
    var contact = req.body.userID;
    
    var findUser = new Promise(function (resolve, reject) {
        req.collections.users.findOne({
            userID: me
        }, 
     function (error, user) {
            //console.log("looking for me user to accept user" + me);
            if (error) reject(error);
            if (!user) {//no user added so far so need to send a mistake
                reject("me user doesnt exist in delete");
            } else {
                resolve(user);}
        })
    });
    
    var findContact = new Promise(function (resolve, reject) {
        req.collections.users.findOne({
            userID: contact
        }, function (errorContact, userContact) {
            //console.log("looking for contact user to delete user" + contact);
            if (!userContact) {
                //There is not a contact
                reject("contact user doesnt exist to delete user");
            }
            else {
             
                resolve(userContact);
            }
        })
    });
            
    Promise.all([findUser, findContact]).then(function (parameters) {
        var user = parameters[0];
        var userContact = parameters[1];

        var updateUser = new Promise(function (resolve, reject) {
            //console.log("starting to add in to delete user " + contact);
            for (var i = 0; i < user.contacts.length; i++) {
                if (user.contacts[i].userID == contact) {
                    user.contacts.splice(i, 1);
                }
            }
            req.collections.users.update({ 'userID': me }, user, function (error, response) {
                //console.log("inserting pending contact to me  in to delete user")
                if (error) {
                    res.writeHead(401);
                    res.end("could not insert the data into me user  in to delete user");
                }
                else {//All good and was added   
                    //console.log("aDDeD to me correctly  in to delete user");
                   
                    resolve("a");
                }
            })
        });
        var updateContact = new Promise(function (resolve, reject) {
            for (var i = 0; i < userContact.contacts.length; i++) {
                if (userContact.contacts[i].userID == me) {
                    userContact.contacts.splice(i, 1);
                }
            }
            req.collections.users.update({ 'userID': contact }, userContact, function (error2, response2) {
                //console.log("inserting requested contacts to the contact in to delete user")
                if (error2) {
                    reject("could not insert the data into contact user in to delete user");
                }
                else {//All good and was added
                    resolve('a');
                }
            })
                
        });
        Promise.all([updateUser, updateContact]).then(function () {
            
            //USE SOCKET TO DELETE
            emitter.emit("deleteUserSocket", me, contact);// deleteUserSocket(me, contact);
            //emitter.emit("getAllData", user, req, res);//
            getAllData(user, req, res);
        }, function (error) {
            res.writeHead(401);
            res.end(error);})
    }, function (error) {
        res.writeHead(401);
        res.end(error);
    })  
                   
}

exports.createGroup = function (req, res, next) {
    var a = new Date();
    var a = Date.UTC(a.getFullYear(), a.getMonth(), a.getDay(), a.getHours(), a.getMinutes(), a.getSeconds(), a.getMilliseconds());
    //console.log(req.body.groupName)
    if (req.body.groupName == undefined) {
        //console.log("muuu la vaca")
        res.writeHead(401);
        res.end("need a valid group name");
      
        return;
    }
    var fullName = false;
    for (var i = 0; i < req.body.groupName.length; i++) {
        if (req.body.groupName[i] != "") {
            fullName = true;
        }
    }
    if (fullName == false) {
        res.writeHead(401);
        res.end("need a valid group name");
        //console.log("muuu la vaca")
        return;
    }
    var obj = { group: a , users: [req.session.user], groupName: req.body.groupName };
    var createGroup = new Promise(function (resolve, reject) {
        req.collections.groups.insert(obj, function (error, group) {
            if (error) return next(error);
            if (!group) {
                reject("group Already exists");
            } else {
                //console.log("added group");
                resolve(group);
            }
        })
    });
    var findUser = new Promise(function (resolve, reject) {
        req.collections.users.findOne({ userID: req.session.user }, function (error, user) {
            if (error) reject(error);
            if (!user) { reject("couldnt find user in the collection for adding a group") }
        //TODO: add the field of groups when singing up and when returning objs 
            else {
                user.groups.push(obj);
                resolve(user);
            }
        })
    });
   
    Promise.all([createGroup, findUser]).then(function (parameters) {
        var group = parameters[0];
        var user = parameters[1];
        //console.log("inserting update of the groups to user")
        req.collections.users.update({ 'userID': req.session.user }, user, function (error, response) {
            if (error) {
                res.writeHead(401);
                res.end("could not insert the data into me user  in to accept user");
            }
            else {
                emitter.emit("requestToJoinGroupChat", obj, req.session.user);
                //io.of("/chat").to(req.session.user).emit("requestToJoinGroupChat", obj)
                //console.log("allGood");
                res.writeHead(200);
                //console.log(a);
                
                res.end(JSON.stringify(obj));
            }
        })
    }, function (error) {
        res.writeHead(401);
        res.end(error);
    })
    
}

exports.addUserToGroup = function (req, res, next) {
    //console.log("add user to group" + req.body.group);
    if (req.body.user == req.session.user) { 
        res.writeHead(401);
        res.end("You are already in this group");
        return;
    }

    var findGroup = new Promise(function (resolve, reject) {
        req.collections.groups.findOne({ group: req.body.group }, function (error, groupObj) {
            if (error) {reject("could not find the room"); }
            else {
                var isThere = false;
                for (var i = 0; i < groupObj.users.length; i++) {
                    if (groupObj.users[i] == req.body.user)
                        isThere = true;
                }
                if (!isThere)
                    groupObj.users.push(req.body.user);
             

                    if (isThere) {
                        res.writeHead(401);
                        res.end("you shall not pass!");
                        return;
                    }
                
                resolve(groupObj);
            }
        })
    });

    var findUser = new Promise(function (resolve, reject) {
        req.collections.users.findOne({ userID: req.body.user }, function (error, user) {
            if (error) reject(error);
            if (!user) {
                //console.log("couldnt find user" + req.body.user);
                reject("user couldnt be found");
            } else {
                resolve(user);
            }
        })
    });
    Promise.all([findGroup, findUser]).then(function (parameters) {
        var groupObj = parameters[0];
        var user = parameters[1];
        
        var updateGroup = new Promise(function (resolve, reject) {
            req.collections.groups.update({ group: groupObj.group }, groupObj, function (error, response) {
                if (error) { reject("could not update the room quantity"); }
                else {
                    emitter.emit("requestToJoinGroupChat", groupObj, req.body.user);
                    //io.of("/chat").to(req.body.user).emit("requestToJoinGroupChat", groupObj)
                    //somehow notify other users someone joined 
                    
                    //console.log("found user");
                    user.groups.push(groupObj);
                    resolve("");
                }
            })
        });

        updateGroup.then(function () {
            req.collections.users.update({ 'userID': req.body.user }, user, function (error, response) {
                if (error) {
                    res.writeHead(401);
                    res.end("could not modify the data into  user  to put a new room");
                }
                else {
                    //console.log("all is well");
                    res.writeHead(200);
                    res.end("");
                
                }
            })
                }, function (error) {
            res.writeHead(401);
            res.end(error);
        });
        
    }, function (error) {
            res.writeHead(401);
            res.end(error); })
}

exports.removeUserFromGroup = function (req, res, next) {//somehow notify someone left and when they left
    //console.log("in remove user from group")
    var findUser = new Promise(function (resolve, reject) {
        req.collections.users.findOne({ userID: req.session.user }, function (error, user) {
            if (error) reject(error);
            if (!user) {
                reject("user couldnt be found");
            }
            else {
                //console.log("found in  remove user from group");
                for (var i = 0; i < user.groups.length; i++) {
                    if (user.groups[i].group == req.body.group) {
                        user.groups.splice(i, 1);
                    }
                } 
                resolve(user);
            }
        })
    });
    var updateUser = findUser.then(function (user) {
        return new Promise(function (resolve, reject) {
            req.collections.users.update({ userID: user.userID }, user, function (error, response) {
                if (error) { return next(error) }
                
                else {
                    //console.log("updated user in  remove user from group");
                    resolve(user);
                }
            })
        });//only the group is removed from the current users other users still have him on the list we will see if need others to be updated as well
    }, function (error) {
        res.writeHead(401);
        res.end(error);
    })
    
    var findGroup = updateUser.then(function (user) {
        req.collections.groups.findOne({ group: req.body.group }, function (error, groupObj) {
            
            if (error) { return next(error) }
            //console.log("found group in  remove user from group" + req.body.group);
            //console.log(groupObj);
            //console.log();
            var index = groupObj.users.indexOf(req.session.user);
            groupObj.users.splice(index, 1);
            emitter.emit("leaveChat", req.session.user, req.body.group);
            // io.of('/chat').to(req.session.user).emit('leaveChat', { group: req.body.group });
            if (groupObj.users.length == 0) {
                req.collections.groups.remove({ group: req.body.group }, function (error, response) {
                    if (error) { return next(error) }
                    //console.log("all is was fine");
                    res.writeHead(200);
                    res.end("");
                })
            } else {
                req.collections.groups.update({ group: req.body.group }, groupObj, function (error, response) {
                    if (error) { return next(error) }
                    //console.log("all is was fine");
                    res.writeHead(200);
                    res.end("");
                })
            }
        })
    }, function (error) {
        res.writeHead(401);
        res.end(error);
    })        
           
      
}


function getAllData(user, req, res) {
    //console.log("got to get all data");
    var array = [];
    var arrayGroups = [];
    arrayGroups.users = [];
    
    var promiseOne = new Promise(function (resolve, reject) {
        if (user.contacts.length > 0)
            populateContacts(user, req, res, array, 0, resolve);
        else
            resolve("s")
    })
    var promiseTwo = new Promise(function (resolve, reject) {
        if (user.groups.length > 0)
            findUsersAndGroups(user, req, res, 0, resolve);//seems there was no necesity for extra array
        else resolve("s");
    })
    Promise.all([promiseOne, promiseTwo]).then(function () {
        res.writeHead(200);
        var responseObj = { "userID": user.userID, "contacts": array, "requestedToContact": user.requestedToContact, "pendingContacts": user.pendingContacts, "groups": user.groups };
        //console.log(JSON.stringify(responseObj));
        res.end(JSON.stringify(responseObj));
    }, function () {
        //console.log("something failed in the promises")
        res.writeHead(401);
        res.end("something failed in the promises");
    })
 
        
    
  
}

function populateContacts(user, req, res, array, index, resolve) {
    //console.log("promise one");
    req.collections.users.findOne({
        userID: user.contacts[index].userID
    }, function (errorContact, info) {
        //console.log("looking for contact user to populate user" + user.userID);
        if (!info) {
            //There is not a contact
            res.writeHead(401);
            res.end("contact user doesnt exist to populate user");
        }
        else {
            //console.log("looking for contact user about to send" + user.userID);
            array.push({ "userID": info.userID, "status": info.connected });
            if (index == user.contacts.length - 1) {
                resolve("s")
               // return array;
            }
            if (index != user.contacts.length - 1) {
                return populateContacts(user, req, res, array, ++index,resolve)
                
            }
            
           
        }
    })
}
function findUsersAndGroups(user, req, res, index, resolve) {
    //console.log("promise two");
    req.collections.groups.findOne({
        group: user.groups[index].group
    }, function (errorContact, info) {
        //console.log("looking for contact user to populate user findgroups" + JSON.stringify(user.groups[index]));
        if (!info) {
            //There is not a contact
            res.writeHead(401);
            res.end("contact user doesnt exist to populate user findGroups");
        }
        else {
            //console.log("looking for contact user about to send findGroups" + JSON.stringify(user.groups[index]));
            user.groups[index] = info;
            //console.log("here we are");
            if (index == user.groups.length - 1) {
                resolve("S")
            }
            if (index != user.groups.length - 1) {
                return findUsersAndGroups(user, req, res, ++index, resolve)
            }
            
           
        }
    })
}

