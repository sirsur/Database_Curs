const express = require('express');
const http = require('http');
const port = 3000;
const db = require('./js/connect');
const parser = require('body-parser');
const hash = require("hash.js");

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
    const state = [`
        SELECT Login, Password FROM Users 
        WHERE Login = '${req.body.Login}' AND Password = '${req.body.password}'
    `];
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
        SELECT Login, Doctors.FIO AS DoctorFio, Patients.FIO AS PatientFio, CONVERT(VARCHAR, Doctors.Birthday, 101) AS DoctorBirthday, CONVERT(VARCHAR, Patients.Birthday, 101) AS PatientBirthday, Policy, Phone, Speciality, Information FROM Users
        LEFT JOIN Patients ON Patients.idUser = Users.idUser
        LEFT JOIN Doctors ON Doctors.idUser = Users.idUser
        WHERE Login = '${req.query.Login}'
    `]
    var status = 1;
    const connect = db.request(state);
    connect.then(result => {
        if (result[0][0].PatientFio == null && result[0][0].DoctorFio != null) {
            status = 2;
        } else if (result[0][0].DoctorFio == null && result[0][0].PatientFio == null) {
            status = 3;
        }
        res.render(__dirname + '/views/profile.ejs', { result: result, status: status, admin: req.query.admin });
    })
})

app.get('/editProfile', (req, res) => {
    const state = [`
        SELECT Login, Doctors.FIO AS DoctorFio, Patients.FIO AS PatientFio, CONVERT(VARCHAR, Doctors.Birthday, 101) AS DoctorBirthday, CONVERT(VARCHAR, Patients.Birthday, 101) AS PatientBirthday, Policy, Phone, Speciality, Information FROM Users
        LEFT JOIN Patients ON Patients.idUser = Users.idUser
        LEFT JOIN Doctors ON Doctors.idUser = Users.idUser
        WHERE Login = '${req.query.Login}'
    `]
    var status = 1;
    const connect = db.request(state);
    connect.then(result => {
        if (result[0][0].PatientFio == null) {
            status = 2
        }
        res.render(__dirname + '/views/editProfile', { result: result, status: status, admin: req.query.admin });
    })
})

app.post('/editProfile', (req, res) => {
    req.body.password = hash.sha256().update(req.body.password).digest('hex');
    var state = [`
        DECLARE @testIdUser INT
        BEGIN TRY
        BEGIN TRANSACTION
            SET @testIdUser = (SELECT idUser FROM Users WHERE Login = '${req.body.Login}')
            UPDATE Users
            SET Login = '${req.body.Login}', Password = '${req.body.password}'
            WHERE idUser = @testIdUser
            UPDATE Patients
            SET FIO = '${req.body.FIO}', Birthday = CAST('${req.body.bday}' AS DATETIME), Policy = '${req.body.policy}', Phone = '${req.body.phone}'
            WHERE idUser = @testIdUser
        COMMIT TRANSACTION
        END TRY
        BEGIN CATCH
        ROLLBACK TRANSACTION;
        END CATCH
    `]
    if (req.body.status == '2') {
        state = [`
            DECLARE @testIdUser INT
            BEGIN TRY
            BEGIN TRANSACTION
                SET @testIdUser = (SELECT idUser FROM Users WHERE Login = '${req.body.Login}')
                UPDATE Users
                SET Login = '${req.body.Login}', Password = '${req.body.password}'
                WHERE idUser = @testIdUser
                UPDATE Doctors
                SET FIO = '${req.body.FIO}', Birthday = CAST('${req.body.bday}' AS DATETIME), Speciality = '${req.body.speciality}', Information = '${req.body.information}'
                WHERE idUser = @testIdUser
            COMMIT TRANSACTION
            END TRY
            BEGIN CATCH
            ROLLBACK TRANSACTION;
            END CATCH
        `]
    }
    const connect = db.request(state);
    connect.then(result => {
        res.redirect(`../profile?Login=${req.body.Login}&admin=${req.query.admin}`);
    })
})

app.get('/usersOrders', (req, res) => {
    const state = [`
        SELECT idPatient FROM Patients 
        JOIN Users ON Users.idUser = Patients.idUser
        WHERE Login = '${req.query.Login}'
    `]
    var connect = db.request(state);
    connect.then(result => {
        var status = 1;
        var state_ = [`
            SELECT DISTINCT Doctors.FIO AS DoctorFIO, Patients.FIO AS PatientFIO, CONVERT(VARCHAR, Date, 103) AS Date, CONVERT(VARCHAR, Time, 120) AS Time, Note, Timetable.idTimetable, Speciality, Timetable.idDoctor FROM Timetable
            JOIN Doctors ON Timetable.idDoctor = Doctors.idDoctor
            JOIN Patients ON Timetable.idPatient = Patients.idPatient
            WHERE Timetable.idPatient = (
                SELECT idPatient FROM Patients 
                JOIN Users ON Users.idUser = Patients.idUser
                WHERE Login = '${req.query.Login}'
            ) AND Timetable.Date >= CAST(CURRENT_TIMESTAMP AS DATE)
        `]
        if (result[0][0] == null) {
            status = 2;
            state_ = [`
                SELECT DISTINCT Doctors.FIO AS DoctorFIO, Patients.FIO AS PatientFIO, CONVERT(VARCHAR, Date, 103) AS Date, CONVERT(VARCHAR, Time, 120) AS Time, Note, Timetable.idTimetable, Speciality, Timetable.idDoctor, Timetable.idPatient FROM Timetable
                JOIN Doctors ON Timetable.idDoctor = Doctors.idDoctor
                JOIN Patients ON Timetable.idPatient = Patients.idPatient
                WHERE Timetable.idDoctor = (
                    SELECT idDoctor FROM Doctors
                    JOIN Users ON Users.idUser = Doctors.idUser
                    WHERE Login = '${req.query.Login}'
                ) AND Timetable.Date >= CAST(CURRENT_TIMESTAMP AS DATE)
            `]
         }
        const connect_ = db.request(state_);
        connect_.then(result_ => {
            res.render(__dirname + '/views/usersOrders', { result: result_, back: req.query.Login, status: status, admin: req.query.admin });
        })
    })
})

app.post('/usersOrders', (req, res) => {
    const state = [`
        EXEC DeleteAppointment '${req.body.id}'
    `]
    const connect = db.request(state);
    connect.then(result => {
        res.redirect(`../freeOrders?Login=${req.query.Login}&admin=${req.query.admin}`);
    })
})

app.get('/freeOrders', (req, res) => {
    const state = [`
        SELECT Doctors.FIO AS DoctorFIO, CONVERT(VARCHAR, Date, 103) AS Date, CONVERT(VARCHAR, Time, 120) AS Time, Note, idTimetable, Speciality, Timetable.idDoctor FROM Timetable
        LEFT JOIN Doctors ON Timetable.idDoctor = Doctors.idDoctor
        WHERE Timetable.idPatient IS NULL AND Timetable.Date >= CAST(CURRENT_TIMESTAMP AS DATE)
    `]
    const connect = db.request(state);
    connect.then(result => {
        const state_ = [`
            SELECT Login FROM Users
            JOIN Doctors ON Doctors.idUser = Users.idUser
            WHERE Login = '${req.query.Login}'
        `]
        const connect_ = db.request(state_);
        connect_.then(result_ => {
            var status = 2;
            if (result[0][0] == null) {
                status = 1;
            }
            if (req.query.status != undefined) {
                res.render(__dirname + '/views/freeOrders', { result: result, back: req.query.Login, status: req.query.status, admin: req.query.admin });
            } else {
                res.render(__dirname + '/views/freeOrders', { result: result, back: req.query.Login, status: status, admin: req.query.admin });
            }
        })
    })
})

app.post('/freeOrders', (req, res) => {
    if (req.body.status == 1) {
        var state = [`
            DECLARE @id_user INT
            SET @id_user = (
                SELECT idPatient FROM Patients 
                JOIN Users ON Users.idUser = Patients.idUser
                WHERE Login = '${req.query.Login}'
            )
            EXEC Appointment @id_user, '${req.body.id}'
        `]
    } else {
        state = [`
            DECLARE @id_user INT
            SET @id_user = (
                SELECT idPatient FROM Patients
                WHERE Policy = '${req.body.policy}'
            )
            EXEC Appointment @id_user, '${req.body.id}'
        `]
    }
    const connect = db.request(state);
    connect.then(result => {
        const state_ = [`
            SELECT idTimetable FROM Timetable
            WHERE idTimetable = '${req.body.id}' AND idPatient IS NOT NULL
        `]
        const connect_ = db.request(state_);
        connect_.then(result_ => {
            var status = 3;
            if (result_[0][0] != undefined) {
                if (result_[0][0].idTimetable == req.body.id) {
                    status = 2;
                }
            }
            if (req.body.status == 1) {
                res.redirect(`../usersOrders?Login=${req.query.Login}&admin=${req.query.admin}`);
            } else {
                res.redirect(`../freeOrders?Login=${req.query.Login}&status=${status}&admin=${req.query.admin}`);
            }
        })
    })
})

app.get('/pastOrders', (req, res) => {
    const state = [`
        SELECT idPatient FROM Patients 
        JOIN Users ON Users.idUser = Patients.idUser
        WHERE Login = '${req.query.Login}'
    `]
    var connect = db.request(state);
    connect.then(result => {
        var status = 1;
        var state_ = [`
            SELECT DISTINCT Doctors.FIO AS DoctorFIO, Patients.FIO AS PatientFIO, CONVERT(VARCHAR, Date, 103) AS Date, CONVERT(VARCHAR, Time, 120) AS Time, Note, Report, Speciality, Timetable.idDoctor, Timetable.idPatient FROM Timetable
            JOIN Doctors ON Timetable.idDoctor = Doctors.idDoctor
            JOIN Patients ON Timetable.idPatient = Patients.idPatient
            LEFT JOIN MedicalCards ON Timetable.idTimetable = MedicalCards.idTimetable
            WHERE Timetable.idPatient = (
                SELECT idPatient FROM Patients 
                JOIN Users ON Users.idUser = Patients.idUser
                WHERE Login = '${req.query.Login}'
            ) AND Timetable.Date < CAST(CURRENT_TIMESTAMP AS DATE)
        `]
        if (result[0][0] == null) {
            status = 2;
            state_ = [`
                SELECT DISTINCT Doctors.FIO AS DoctorFIO, Patients.FIO AS PatientFIO, CONVERT(VARCHAR, Date, 103) AS Date, CONVERT(VARCHAR, Time, 120) AS Time, Note, Report, Speciality, Timetable.idDoctor, Timetable.idPatient, Timetable.idTimetable FROM Timetable
                JOIN Doctors ON Timetable.idDoctor = Doctors.idDoctor
                JOIN Patients ON Timetable.idPatient = Patients.idPatient
                LEFT JOIN MedicalCards ON Timetable.idTimetable = MedicalCards.idTimetable
                WHERE Timetable.idDoctor = (
                    SELECT idDoctor FROM Doctors 
                    JOIN Users ON Users.idUser = Doctors.idUser
                    WHERE Login = '${req.query.Login}'
                ) AND Timetable.Date < CAST(CURRENT_TIMESTAMP AS DATE)
            `]
         }
        const connect_ = db.request(state_);
        connect_.then(result_ => {
            res.render(__dirname + '/views/pastOrders', { result: result_, back: req.query.Login, status: status, admin: req.query.admin });
        })
    })
})

app.post('/pastOrders', (req, res) => {
    const state = [`
        UPDATE MedicalCards
        SET Report = '${req.body.report}'
        WHERE idTimetable = '${req.body.id}'
    `]
    const connect = db.request(state);
    connect.then(result => {
        res.redirect(`../pastOrders?Login=${req.query.Login}`);
    })
})

app.get('/linkProfile', (req, res) => {
    if (req.query.idPatient != null) {
        var state = [`
        SELECT Login, FIO, CONVERT(VARCHAR, Birthday, 103) AS Birthday, Policy, Phone FROM Patients
        JOIN Users ON Patients.idUser = Users.idUser
        WHERE Login = (
            SELECT Login FROM Users
            JOIN Patients ON Patients.idUser = Users.idUser
            WHERE Patients.idPatient = ${req.query.idPatient}
        )
    `]
    } else if (req.query.idDoctor != null) {
        state = [`
            SELECT Login, FIO, CONVERT(VARCHAR, Birthday, 103) AS Birthday, Speciality, Information FROM Doctors
            JOIN Users ON Doctors.idUser = Users.idUser
            WHERE Login = (
                SELECT Login FROM Users
                JOIN Doctors ON Doctors.idUser = Users.idUser
                WHERE Doctors.idDoctor = ${req.query.idDoctor}
            )
        `]
    }
    const connect = db.request(state);
    connect.then(result => {
        res.render(__dirname + '/views/linkProfile', { result: result, back: req.query.Login, admin: req.query.admin })
    })
})

app.get('/allUsers', (req, res) => {
    const state = [`
        SELECT Login FROM Users
        LEFT JOIN Doctors ON Doctors.idUser = Users.idUser
        LEFT JOIN Patients ON Patients.idUser = Users.idUser
        WHERE idDoctor IS NOT NULL OR idPatient IS NOT NULL
    `]
    const connect = db.request(state);
    connect.then(result => {
        res.render(__dirname + '/views/allUsers', { result: result, back: req.query.Login })
    })
})

app.get('/allOrders', (req, res) => {
    const state = [`
        SELECT DISTINCT Doctors.FIO AS DoctorFIO, Patients.FIO AS PatientFIO, CONVERT(VARCHAR, Date, 103) AS Date, CONVERT(VARCHAR, Time, 120) AS Time, Note, Report, Speciality, Timetable.idDoctor, Timetable.idPatient FROM Timetable
        LEFT JOIN Doctors ON Timetable.idDoctor = Doctors.idDoctor
        LEFT JOIN Patients ON Timetable.idPatient = Patients.idPatient
        LEFT JOIN MedicalCards ON MedicalCards.idTimetable = Timetable.idTimetable
    `]
    const connect = db.request(state);
    connect.then(result => {
        res.render(__dirname + '/views/allOrders', { result: result, admin: req.query.admin, back: req.query.Login });
    })
})

app.get('/newOrders', (req, res) => {
    res.render(__dirname + '/views/newOrders', { admin: req.query.admin, back: req.query.Login });
})

app.post('/newOrders', (req, res) => {
    const state = [`
        DECLARE @date date,
        @time time
        SET @date = CAST('${req.body.date}' AS DATETIME)
        SET @time = CAST('${req.body.time}' AS TIME) 
        SELECT Date, Time FROM Timetable
        WHERE Date = @date AND Time = @time
    `]
    const connect = db.request(state);
    connect.then(result => {
        const state_ = [`
            DECLARE @id_doctor INT,
            @date date,
            @time time
            SET @id_doctor = (
                SELECT idDoctor FROM Doctors
                JOIN Users ON Users.idUser = Doctors.idUser
                WHERE Login = '${req.body.Login}'
            )
            SET @date = CAST('${req.body.date}' AS DATETIME)
            SET @time = CAST('${req.body.time}' AS TIME)
            EXEC newTimetable @id_doctor, @date, @time, '${req.body.note}'
        `]
        const connect_ = db.request(state_);
        connect_.then(result_ => {
            res.redirect(`../freeOrders?Login=${req.query.Login}&admin=${req.query.admin}`);
        })
    })
})

app.get('/regAdmin', (req, res) => {  
    if (req.query.status == undefined) {
        res.render(__dirname + '/views/regAdmin', { status: 2, userStatus: req.query.userSelect })
    } else {
        res.render(__dirname + '/views/regAdmin', { status: 1, userStatus: req.query.userSelect })
    }
})

app.post('/regAdmin', (req, res) => {
    req.body.password = hash.sha256().update(req.body.password).digest('hex');
    if (req.query.userStatus == 2) {    
        var state = [`
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
    } else {
        state = [`
            DECLARE @testIdUser INT
            BEGIN TRY
            BEGIN TRANSACTION
                INSERT INTO Users(Login, Password)
                VALUES ('${req.body.Login}', '${req.body.password}')
                SET @testIdUser = (SELECT Users.idUser FROM Users WHERE Login = '${req.body.Login}')
                INSERT INTO Doctors(idUser, FIO, Birthday, Speciality, Information)
                VALUES (@testIdUser, '${req.body.FIO}', '${req.body.bday}', '${req.body.speciality}', '${req.body.information}')
            COMMIT TRANSACTION
            END TRY
            BEGIN CATCH
            ROLLBACK TRANSACTION;
            END CATCH
        `]
    }
    const connect = db.request(state);
    connect.then(result => {
        console.log(result);
        if (result[0] != undefined) {
            res.redirect(`../profile?Login=admin`);
        } else {
            res.redirect('../regAdmin?status=1');
        }
    })
})

http.createServer(app).listen(port, function() {
    console.log('Express server listening on port ' + port);
});