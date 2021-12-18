const express = require('express');
const http = require('http');
const port = 3000;
const db = require('./js/connect');
const parser = require('body-parser');
const hash = require("hash.js");
const { connect } = require('http2');

const app = express();    

app.use(parser.urlencoded({
    parameterLimit: 10000000,
    limit: '2000mb',
    extended: true
  }));

app.set('view engine', 'ejs');

app.get('/', function(req, res) {
    res.render(__dirname + '/views/index');
});

app.get('/login', function(req, res) {
    if (req.query.status == undefined) {
        res.render(__dirname + '/views/login', { status: 2 })
    } else {
        res.render(__dirname + '/views/login', { status: 1 })
    }
});

app.post('/login', function(req, res) {
    req.body.password = hash.sha256().update(req.body.password).digest('hex');
    const state = [`SELECT Login, Password FROM Users WHERE Login = '${req.body.Login}' AND Password = '${req.body.password}'`];
    const connect = db.request(state);
    connect.then(result => {
        result.forEach((log, index) => {
            if (log[index] == undefined) {
                res.redirect('../login?status=1');
            } else {
                res.redirect(`../profile?Login=${req.body.Login}`);
            }
        })
    });
});

app.get('/reg', function(req, res) {
    if (req.query.status == undefined) {
        res.render(__dirname + '/views/reg', { status: 2 })
    } else {
        res.render(__dirname + '/views/reg', { status: 1 })
    }
});

app.post('/reg', function(req, res) {
    req.body.password = hash.sha256().update(req.body.password).digest('hex');
    const state = [`
        DECLARE @testIdUser INT
        BEGIN TRY
        BEGIN TRANSACTION
            INSERT INTO Users(Login, Password)
            VALUES ('${req.body.Login}', '${req.body.password}')
            SET @testIdUser = (SELECT Users.idUser FROM Users WHERE Login = '${req.body.Login}')
            INSERT INTO Patients(idUser, FIO, Birthday, Policy, Phone)
            VALUES (@testIdUser, '${req.body.FIO}', '${req.body.bday}', '${req.body.policy}', '${req.body.phone}')
        COMMIT TRANSACTION
        END TRY
        BEGIN CATCH
        ROLLBACK TRANSACTION;
        END CATCH
    `]
    const connect = db.request(state);
    connect.then(result => {
        console.log(result);
        if (result[0] != undefined) {
            res.redirect(`../profile?Login=${req.body.Login}`);
        } else {
            res.redirect('../reg?status=1');
        }
    })
});

app.get(`/profile`, (req, res) => {
    const state = [`
        SELECT Login, FIO, CONVERT(VARCHAR, Birthday, 103) AS Birthday, Policy, Phone FROM Patients
        JOIN Users ON Patients.idUser = Users.idUser
        WHERE Login = '${req.query.Login}'
    `]
    const connect = db.request(state);
    connect.then(result => {
        console.log(result);
        res.render(__dirname + '/views/profile.ejs', { result: result });
    })
})

app.get('/editProfile', (req, res) => {
    const state = [`
        SELECT Login, Password, FIO, CONVERT(VARCHAR, Birthday, 103) AS Birthday, Policy, Phone FROM Users
        JOIN Patients ON Users.idUser = Patients.idUser
        WHERE Login = '${req.query.Login}'
    `]
    const connect = db.request(state);
    connect.then(result => {
        console.log(result);
        if (req.query.status == undefined) {
            res.render(__dirname + '/views/editProfile', { result: result, status: 2 })
        } else {
            res.render(__dirname + '/views/Profile', { result: result, status: 1 })
        }
    })
})

app.post('/editProfile', (req, res) => {
    req.body.password = hash.sha256().update(req.body.password).digest('hex');
    const state = [`
        DECLARE @testIdUser INT
        BEGIN TRY
        BEGIN TRANSACTION
            SET @testIdUser = (SELECT idUser FROM Users WHERE Login = '${req.body.Login}')
            UPDATE Users
            SET Login = '${req.body.Login}', Password = '${req.body.password}'
            WHERE idUser = @testIdUser
            UPDATE Patients
            SET FIO = '${req.body.FIO}', Birthday = CAST('${req.body.bday}' AS datetime), Policy = '${req.body.policy}', Phone = '${req.body.phone}'
            WHERE idUser = @testIdUser
        COMMIT TRANSACTION
        END TRY
        BEGIN CATCH
        ROLLBACK TRANSACTION;
        END CATCH
    `]
    const connect = db.request(state);
    connect.then(result => {
        res.redirect(`../profile?Login=${req.body.Login}`);
    })
})

http.createServer(app).listen(port, function() {
    console.log('Express server listening on port ' + port);
});