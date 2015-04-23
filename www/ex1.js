var pg = require('pg');
if (process.env.PT_HOST === undefined) {
    throw "PT_HOST is not defined";
}
var conString = "postgres://ptuser@" + process.env.PT_HOST + ":5432/ptdata";

var express = require('express');
var app = express();
var url = require('url');

var compression = require('compression');
app.use(compression());

var helmet = require('helmet');
app.use(helmet());

var doT = require('dot-express');
app.set('view engine', 'dot');
app.engine('html', doT.__express);





app.use('/dyg', express.static(__dirname + '/bower_components/dygraphs'));






app.use('/css', express.static(__dirname + '/public/css'));
app.use('/img', express.static(__dirname + '/public/img'));
app.use('/js', express.static(__dirname + '/public/js'));
app.get('/', function(req, res) {
    var templateData = {
        "PT_HOST": process.env.PT_HOST,
        "houseResults": [{
            "electorateName": "Grayndler",
            "state": "NSW"
        }]
    };
    res.render('index.html', templateData);
});

app.get('/twopp', function(req, res) {
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;
    var electorate = query.electorate;
    var acceptableElectorates = ['AUS', 'NSW', 'VIC', 'TAS', 'WA', 'SA', 'QLD', 'NT', 'ACT'];
    if (acceptableElectorates.indexOf(electorate) == -1) {
        res.writeHead(404, {
            'content-type': 'text/plain'
        });
        res.end("Unknown electorate");
        return;
    }
    getTwoPPJson(electorate, res);
});

app.get('/primary', function(req, res) {
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;
    var electorate = query.electorate;
    var acceptableElectorates = ['AUS', 'NSW', 'VIC', 'TAS', 'WA', 'SA', 'QLD', 'NT', 'ACT'];
    if (acceptableElectorates.indexOf(electorate) == -1) {
        res.writeHead(404, {
            'content-type': 'text/plain'
        });
        res.end("Unknown electorate");
        return;
    }
    var party = query.party;
    var acceptableParties = ['ALP', 'LNP', 'GRN', 'PUP', 'OTH'];
    if (acceptableParties.indexOf(party) == -1) {
        res.writeHead(404, {
            'content-type': 'text/plain'
        });
        res.end("Unknown party");
        return;
    }
    getPrimaryJson(electorate, party, res);
});

app.get('/polls', function(req, res) {
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;
    var electorate = query.electorate;
    var acceptableElectorates = ['AUS', 'NSW', 'VIC', 'TAS', 'WA', 'SA', 'QLD', 'NT', 'ACT'];
    if (acceptableElectorates.indexOf(electorate) == -1) {
        res.writeHead(404, {
            'content-type': 'text/plain'
        });
        res.end("Unknown electorate");
        return;
    }
    var party = query.party;
    var acceptableParties = ['ALP2pp', 'ALP', 'LNP', 'GRN', 'GRNOTH', 'PUP', 'PUPOTH', 'OTH'];
    if (acceptableParties.indexOf(party) == -1) {
        res.writeHead(404, {
            'content-type': 'text/plain'
        });
        res.end("Unknown party");
        return;
    }
    var pollster = query.pollster;
    var acceptablePollsters = ["Galaxy", "Ipsos", "Morgan", "EssentialOnline", "Newspoll",
        "Nielsen", "MorganSMS", "ReachTEL", "MorganMulti", "Essential",
        "Election", "NewspollQuarterly"
    ];
    if (acceptablePollsters.indexOf(pollster) == -1) {
        res.writeHead(404, {
            'content-type': 'text/plain'
        });
        res.end("Unknown pollster");
        return;
    }
    getPollData(electorate, party, pollster, res);
});


var server = app.listen(3001, function() {

    var host = server.address().address;
    var port = server.address().port;
    console.log('Example app listening at http://%s:%s', host, port);
});


function getTwoPPJson(electorate, res) {
    getDbQuery("SELECT pollenddate, avg(alp2pp), stddev(alp2pp)" +
        "FROM TwoPP WHERE electorate = $1" +
        "GROUP BY pollenddate ORDER BY pollenddate;", [electorate],
        function(v) {
            return ([new Date(v.pollenddate), [v.avg, v.stddev]]);
        },
        res);
}

function getPrimaryJson(electorate, party, res) {
    getDbQuery("SELECT pollenddate, vote AS avg, onesd AS stddev " +
        "FROM primarytrend WHERE electorate = $1 AND party = $2 " +
        "ORDER BY pollenddate;", [electorate, party],
        function(v) {
            return ([new Date(v.pollenddate), [v.avg, v.stddev]]);
        },
        res);
}

function getPollData(electorate, party, pollster, res) {
    getDbQuery("SELECT * FROM polldata WHERE electorate = $1 AND party = $2 AND pollster = $3 " +
        "AND pollenddate >= '2000-01-01' " +
        "ORDER BY pollenddate;", [electorate, party, pollster],
        function(v) {
            return ([new Date(v.pollenddate), v.pollster, v.vote, v.url]);
        },
        res);
}

function getDbQuery(query, arg, formatter, res) {
    pg.connect(conString, function(err, client, done) {
        var handleError = function(err) {
            if (!err) return false;
            done(client); // remove client from pool if it exists
            console.log(err);
            return true;
        };
        if (handleError(err)) {
            res.writeHead(500, {
                'content-type': 'text/plain'
            });
            res.end("Server error");
            return;
        }
        client.query(query, arg,
            function(err, result) {
                if (handleError(err)) {
                    res.writeHead(500, {
                        'content-type': 'text/plain'
                    });
                    res.end("Server error");
                    return;
                }
                done();
                var output = result.rows.map(formatter);
                res.send(output);
            });
    });
}