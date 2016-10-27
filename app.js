#!/usr/bin/env node
/*******things to improve
 * could try to use promises instead of callbackHell
 *******/
var debug = require('debug')('HastaLaVistaBaby');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser');
var mongoskin = require('mongoskin'),
    dbUrl = process.env.MONGOHQ_URL || 'mongodb://@localhost:27017/paint',
    db = mongoskin.db(dbUrl, { safe: true }),
    collections = {
        users: db.collection('users'),
        groups: db.collection('groups')
    }
var routes = require('./routes/index');
var users = require('./routes/users');
var app = express();
var http = require('http').Server(app);
var routesIO = require("./routes/sockeModule");
var io = routesIO.init(http);

app.use(function (req, res, next) {
    if (!collections.users || !collections.groups) return next(new Error('No collections.'))
    req.collections = collections;
    return next();
});
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser('3CCC4ACD-6ED1-4844-9217-82131BDCB239'));
app.use(session({
    secret: '2C44774A-D649-4D44-9535-46E296EF984F', 
    saveUninitialized: true,
    resave: true
}));
app.use(require('stylus').middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));



app.get("/api/me", routes.signUp.validate);
app.get("/login",function(req,res,next){ res.sendFile(path.join(__dirname, '/views', "index.html"));})
app.post("/api/acceptUser", routes.signUp.acceptUser);
app.post("/api/rejectUser", routes.signUp.rejectUser);
app.post("/api/deleteUser", routes.signUp.deleteUser);
app.post("/addToGroup", routes.signUp.addUserToGroup);
app.post("/addContact", routes.signUp.addContact);
app.post("/deleteFromGroup", routes.signUp.removeUserFromGroup);
app.post('/login', routes.signUp.postLogin);
app.post('/signUp', routes.signUp.postSignUp);
app.post("/logout", routes.signUp.logout);
app.post("/createGroup", routes.signUp.createGroup);

//app.get("/socket.io/*", routes.signUp.io);
app.use("/", routes.signUp.home);
// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});



// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});
app.set('port', process.env.PORT || 3000);


var server = http.listen(app.get('port'), function () {
    debug('Express server listening on port ' + server.address().port);
});



