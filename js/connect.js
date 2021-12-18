const sql = require('mssql');

const config = {  
    user: "deanny",
    password: "1",
    database: "clinic",
    server: "DESKTOP-8KEEL5I",
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};  

var sqlReq = exports.sqlReq  = function (req = 'SELECT * FROM Students') {
    return new Promise (function (resolve, reject) {
        sql.on('error', err => {
            console.log(err)
        });

        sql.connect(config).then(pool => {
            return pool.request().query(req)
        }).then(result => { 
            resolve(result.recordset);
        }).catch(err => {
            resolve(err);
        });
    });
}

var request = exports.request = function (req) {
    return new Promise (function (resolve, reject) {
        let output = [];
        let testa = req.length - 1;
        req.forEach ((state, index) => {
            let promise = sqlReq(state);
            promise.then(function (columns) {
                output[index] = columns;
                if (testa == index) {
                    resolve(output)
                }
            });
        });
    });
} 
