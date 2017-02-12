/*istanbul ignore next*/'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.webapp = exports.challenge = exports.verify = exports.echo = undefined;

var /*istanbul ignore next*/_express = require('express');

/*istanbul ignore next*/var _express2 = _interopRequireDefault(_express);

var /*istanbul ignore next*/_request = require('request');

/*istanbul ignore next*/var request = _interopRequireWildcard(_request);

var /*istanbul ignore next*/_util = require('util');

/*istanbul ignore next*/var util = _interopRequireWildcard(_util);

var /*istanbul ignore next*/_bodyParser = require('body-parser');

/*istanbul ignore next*/var bparser = _interopRequireWildcard(_bodyParser);

var /*istanbul ignore next*/_crypto = require('crypto');

var /*istanbul ignore next*/_http = require('http');

/*istanbul ignore next*/var http = _interopRequireWildcard(_http);

var /*istanbul ignore next*/_https = require('https');

/*istanbul ignore next*/var https = _interopRequireWildcard(_https);

var /*istanbul ignore next*/_oauth = require('./oauth');

/*istanbul ignore next*/var oauth = _interopRequireWildcard(_oauth);

var /*istanbul ignore next*/_ssl = require('./ssl');

/*istanbul ignore next*/var ssl = _interopRequireWildcard(_ssl);

var /*istanbul ignore next*/_debug = require('debug');

/*istanbul ignore next*/var _debug2 = _interopRequireDefault(_debug);

var /*istanbul ignore next*/_path = require('path');

/*istanbul ignore next*/var path = _interopRequireWildcard(_path);

var /*istanbul ignore next*/_socket = require('socket.io');

/*istanbul ignore next*/var socket = _interopRequireWildcard(_socket);

var /*istanbul ignore next*/_fs = require('fs');

/*istanbul ignore next*/var fs = _interopRequireWildcard(_fs);

/*istanbul ignore next*/function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var io;

// Debug log
// A sample chatbot app that listens to messages posted to a space in IBM
// Watson Workspace and echoes hello messages back to the space

var log = /*istanbul ignore next*/(0, _debug2.default)('watsonwork-echo-app');

// Echoes Watson Work chat messages containing 'hello' or 'hey' back
// to the space they were sent to
var echo = /*istanbul ignore next*/exports.echo = function echo(appId, token) /*istanbul ignore next*/{
  return function (req, res) {
    // Respond to the Webhook right away, as the response message will
    // be sent asynchronously
    res.status(201).end();

    io.sockets.emit('webhook-event', { eventTime: new Date(), body: req.body });
    console.log("Got event!");
    console.dir(req.body);
    log('Event: %o', req.body);
    // Only handle message-created Webhook events, and ignore the app's
    // own messages
    if (req.body.type !== 'message-created' && req.body.type !== 'annotation-created' || req.body.userId === appId) return;

    log('Got a message %o', req.body);

    // React to 'hello' or 'hey' keywords in the message and send an echo
    // message back to the conversation in the originating space
    if (req.body.content
    // Tokenize the message text into individual words
    .split(/[^A-Za-z0-9]+/)
    // Look for the hello and hey words
    .filter(function (word) /*istanbul ignore next*/{
      return (/^(hello|hey)$/i.test(word)
      );
    }).length)

      // Send the echo message
      send(req.body.spaceId, util.format('Hey %s, did you say %s?', req.body.userName, req.body.content), token(), function (err, res) {
        if (!err) log('Sent message to space %s', req.body.spaceId);
      });
  };
};

// Send an app message to the conversation in a space
var send = function send(spaceId, text, tok, cb) {
  request.post('https://api.watsonwork.ibm.com/v1/spaces/' + spaceId + '/messages', {
    headers: {
      Authorization: 'Bearer ' + tok
    },
    json: true,
    // An App message can specify a color, a title, markdown text and
    // an 'actor' useful to show where the message is coming from
    body: {
      type: 'appMessage',
      version: 1.0,
      annotations: [{
        type: 'generic',
        version: 1.0,

        color: '#6CB7FB',
        title: 'Echo message',
        text: text,

        actor: {
          name: 'HealthCare Bot V1.0',
          avatar: 'https://scwatsonwork-echo.mybluemix.net/bot.png',
          url: 'https://github.com/watsonwork/watsonwork-echo'
        }
      }]
    }
  }, function (err, res) {
    if (err || res.statusCode !== 201) {
      log('Error sending message %o', err || res.statusCode);
      cb(err || new Error(res.statusCode));
      return;
    }
    log('Send result %d, %o', res.statusCode, res.body);
    cb(null, res.body);
  });
};

// Verify Watson Work request signature
var verify = /*istanbul ignore next*/exports.verify = function verify(wsecret) /*istanbul ignore next*/{
  return function (req, res, buf, encoding) {
    if (req.get('X-OUTBOUND-TOKEN') !== /*istanbul ignore next*/(0, _crypto.createHmac)('sha256', wsecret).update(buf).digest('hex')) {
      log('Invalid request signature');
      var err = new Error('Invalid request signature');
      err.status = 401;
      throw err;
    }
  };
};

// Handle Watson Work Webhook challenge requests
var challenge = /*istanbul ignore next*/exports.challenge = function challenge(wsecret) /*istanbul ignore next*/{
  return function (req, res, next) {
    if (req.body.type === 'verification') {
      log('Got Webhook verification challenge %o', req.body);
      var body = JSON.stringify({
        response: req.body.challenge
      });
      res.set('X-OUTBOUND-TOKEN', /*istanbul ignore next*/(0, _crypto.createHmac)('sha256', wsecret).update(body).digest('hex'));
      res.type('json').send(body);
      return;
    }
    next();
  };
};

// Create Express App
var app = /*istanbul ignore next*/(0, _express2.default)();

// serve the files out of ./public as our main files
app.use( /*istanbul ignore next*/_express2.default.static(path.dirname(__dirname) + "/public"));
log("Using path: " + path.dirname(__dirname) + "/public");

app.get("/webhook", function (req, res) {
  fs.readFile(path.dirname(__dirname) + "/public/webhook.html", 'utf-8', function (err, data) {
    if (err) {
      console.log("Error:" + err);
      res.writeHead(500);
      return res.end("Error loading webhook-event-log.html");
    }
    res.writeHead(200);
    res.end(data);
  });
});

// Create Express Web app
var webapp = /*istanbul ignore next*/exports.webapp = function webapp(appId, secret, wsecret, cb) {
  // Authenticate the app and get an OAuth token
  oauth.run(appId, secret, function (err, token) {
    if (err) {
      cb(err);
      return;
    }

    // Return the Express Web app
    cb(null, app

    // Configure Express route for the app Webhook
    .post('/echo',

    // Verify Watson Work request signature and parse request body
    bparser.json({
      type: '*/*',
      verify: verify(wsecret)
    }),

    // Handle Watson Work Webhook challenge requests
    challenge(wsecret),

    // Handle Watson Work messages
    echo(appId, token)));
  });
};

// App main entry point
var main = function main(argv, env, cb) {
  // Create Express Web app
  log("ECHO_APP_ID: %s", env.ECHO_APP_ID);
  log("ECHO_APP_SECRET: %s", env.ECHO_APP_SECRET);
  log("ECHO_WEBHOOK_SECRET: %s", env.ECHO_WEBHOOK_SECRET);
  webapp(env.ECHO_APP_ID, env.ECHO_APP_SECRET, env.ECHO_WEBHOOK_SECRET, function (err, app) {
    if (err) {
      cb(err);
      return;
    }

    if (env.PORT) {
      // In a hosting environment like Bluemix for example, HTTPS is
      // handled by a reverse proxy in front of the app, just listen
      // on the configured HTTP port
      log('HTTP server listening on port %d', env.PORT);
      io = socket.listen(http.createServer(app).listen(env.PORT, cb));
    } else
      // Listen on the configured HTTPS port, default to 443
      ssl.conf(env, function (err, conf) {
        if (err) {
          cb(err);
          return;
        }
        var port = env.SSLPORT || 443;
        log('HTTPS server listening on port %d', port);
        https.createServer(conf, app).listen(port, cb);
      });
  });
};

if (require.main === module) main(process.argv, process.env, function (err) {
  if (err) {
    console.log('Error starting app:', err);
    return;
  }
  log('App started');
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9hcHAuanMiXSwibmFtZXMiOlsicmVxdWVzdCIsInV0aWwiLCJicGFyc2VyIiwiaHR0cCIsImh0dHBzIiwib2F1dGgiLCJzc2wiLCJwYXRoIiwic29ja2V0IiwiZnMiLCJpbyIsImxvZyIsImVjaG8iLCJhcHBJZCIsInRva2VuIiwicmVxIiwicmVzIiwic3RhdHVzIiwiZW5kIiwic29ja2V0cyIsImVtaXQiLCJldmVudFRpbWUiLCJEYXRlIiwiYm9keSIsImNvbnNvbGUiLCJkaXIiLCJ0eXBlIiwidXNlcklkIiwiY29udGVudCIsInNwbGl0IiwiZmlsdGVyIiwid29yZCIsInRlc3QiLCJsZW5ndGgiLCJzZW5kIiwic3BhY2VJZCIsImZvcm1hdCIsInVzZXJOYW1lIiwiZXJyIiwidGV4dCIsInRvayIsImNiIiwicG9zdCIsImhlYWRlcnMiLCJBdXRob3JpemF0aW9uIiwianNvbiIsInZlcnNpb24iLCJhbm5vdGF0aW9ucyIsImNvbG9yIiwidGl0bGUiLCJhY3RvciIsIm5hbWUiLCJhdmF0YXIiLCJ1cmwiLCJzdGF0dXNDb2RlIiwiRXJyb3IiLCJ2ZXJpZnkiLCJ3c2VjcmV0IiwiYnVmIiwiZW5jb2RpbmciLCJnZXQiLCJ1cGRhdGUiLCJkaWdlc3QiLCJjaGFsbGVuZ2UiLCJuZXh0IiwiSlNPTiIsInN0cmluZ2lmeSIsInJlc3BvbnNlIiwic2V0IiwiYXBwIiwidXNlIiwic3RhdGljIiwiZGlybmFtZSIsIl9fZGlybmFtZSIsInJlYWRGaWxlIiwiZGF0YSIsIndyaXRlSGVhZCIsIndlYmFwcCIsInNlY3JldCIsInJ1biIsIm1haW4iLCJhcmd2IiwiZW52IiwiRUNIT19BUFBfSUQiLCJFQ0hPX0FQUF9TRUNSRVQiLCJFQ0hPX1dFQkhPT0tfU0VDUkVUIiwiUE9SVCIsImxpc3RlbiIsImNyZWF0ZVNlcnZlciIsImNvbmYiLCJwb3J0IiwiU1NMUE9SVCIsInJlcXVpcmUiLCJtb2R1bGUiLCJwcm9jZXNzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBR0E7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QWU7QUFDM0IsWUFBR25ELEdBQUgsRUFBUTtBQUNORyxhQUFHSCxHQUFIO0FBQ0E7QUFDRDtBQUNELFlBQU1vRCxPQUFPUixJQUFJUyxPQUFKLElBQWUsR0FBNUI7QUFDQWhGLFlBQUksbUNBQUosRUFBeUMrRSxJQUF6QztBQUNBdEYsY0FBTW9GLFlBQU4sQ0FBbUJDLElBQW5CLEVBQXlCcEIsR0FBekIsRUFBOEJrQixNQUE5QixDQUFxQ0csSUFBckMsRUFBMkNqRCxFQUEzQztBQUNELE9BUkQ7QUFTSCxHQTNCSDtBQTRCRCxDQWpDRDs7QUFtQ0EsSUFBSW1ELFFBQVFaLElBQVIsS0FBaUJhLE1BQXJCLEVBQ0ViLEtBQUtjLFFBQVFiLElBQWIsRUFBbUJhLFFBQVFaLEdBQTNCLEVBQWdDLFVBQUM1QyxHQUFELEVBQVM7QUFDdkMsTUFBR0EsR0FBSCxFQUFRO0FBQ05kLFlBQVFiLEdBQVIsQ0FBWSxxQkFBWixFQUFtQzJCLEdBQW5DO0FBQ0E7QUFDRDtBQUNEM0IsTUFBSSxhQUFKO0FBQ0QsQ0FORCIsImZpbGUiOiJhcHAuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBBIHNhbXBsZSBjaGF0Ym90IGFwcCB0aGF0IGxpc3RlbnMgdG8gbWVzc2FnZXMgcG9zdGVkIHRvIGEgc3BhY2UgaW4gSUJNXG4vLyBXYXRzb24gV29ya3NwYWNlIGFuZCBlY2hvZXMgaGVsbG8gbWVzc2FnZXMgYmFjayB0byB0aGUgc3BhY2VcblxuaW1wb3J0IGV4cHJlc3MgZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgKiBhcyByZXF1ZXN0IGZyb20gJ3JlcXVlc3QnO1xuaW1wb3J0ICogYXMgdXRpbCBmcm9tICd1dGlsJztcbmltcG9ydCAqIGFzIGJwYXJzZXIgZnJvbSAnYm9keS1wYXJzZXInO1xuaW1wb3J0IHsgY3JlYXRlSG1hYyB9IGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xuaW1wb3J0ICogYXMgaHR0cHMgZnJvbSAnaHR0cHMnO1xuaW1wb3J0ICogYXMgb2F1dGggZnJvbSAnLi9vYXV0aCc7XG5pbXBvcnQgKiBhcyBzc2wgZnJvbSAnLi9zc2wnO1xuaW1wb3J0IGRlYnVnIGZyb20gJ2RlYnVnJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBzb2NrZXQgZnJvbSAnc29ja2V0LmlvJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbnZhciBpbztcblxuLy8gRGVidWcgbG9nXG5jb25zdCBsb2cgPSBkZWJ1Zygnd2F0c29ud29yay1lY2hvLWFwcCcpO1xuXG4vLyBFY2hvZXMgV2F0c29uIFdvcmsgY2hhdCBtZXNzYWdlcyBjb250YWluaW5nICdoZWxsbycgb3IgJ2hleScgYmFja1xuLy8gdG8gdGhlIHNwYWNlIHRoZXkgd2VyZSBzZW50IHRvXG5leHBvcnQgY29uc3QgZWNobyA9IChhcHBJZCwgdG9rZW4pID0+IChyZXEsIHJlcykgPT4ge1xuICAvLyBSZXNwb25kIHRvIHRoZSBXZWJob29rIHJpZ2h0IGF3YXksIGFzIHRoZSByZXNwb25zZSBtZXNzYWdlIHdpbGxcbiAgLy8gYmUgc2VudCBhc3luY2hyb25vdXNseVxuICByZXMuc3RhdHVzKDIwMSkuZW5kKCk7XG5cblx0aW8uc29ja2V0cy5lbWl0KCd3ZWJob29rLWV2ZW50Jywge2V2ZW50VGltZTogbmV3IERhdGUoKSwgYm9keTogcmVxLmJvZHl9KTtcbiAgY29uc29sZS5sb2coXCJHb3QgZXZlbnQhXCIpXG4gIGNvbnNvbGUuZGlyKHJlcS5ib2R5KTtcbiAgbG9nKCdFdmVudDogJW8nLCByZXEuYm9keSk7XG4gIC8vIE9ubHkgaGFuZGxlIG1lc3NhZ2UtY3JlYXRlZCBXZWJob29rIGV2ZW50cywgYW5kIGlnbm9yZSB0aGUgYXBwJ3NcbiAgLy8gb3duIG1lc3NhZ2VzXG4gIGlmKChyZXEuYm9keS50eXBlICE9PSAnbWVzc2FnZS1jcmVhdGVkJyAmJiByZXEuYm9keS50eXBlICE9PSAnYW5ub3RhdGlvbi1jcmVhdGVkJykgfHwgcmVxLmJvZHkudXNlcklkID09PSBhcHBJZClcbiAgICByZXR1cm47XG5cbiAgbG9nKCdHb3QgYSBtZXNzYWdlICVvJywgcmVxLmJvZHkpO1xuXG4gIC8vIFJlYWN0IHRvICdoZWxsbycgb3IgJ2hleScga2V5d29yZHMgaW4gdGhlIG1lc3NhZ2UgYW5kIHNlbmQgYW4gZWNob1xuICAvLyBtZXNzYWdlIGJhY2sgdG8gdGhlIGNvbnZlcnNhdGlvbiBpbiB0aGUgb3JpZ2luYXRpbmcgc3BhY2VcbiAgaWYocmVxLmJvZHkuY29udGVudFxuICAgIC8vIFRva2VuaXplIHRoZSBtZXNzYWdlIHRleHQgaW50byBpbmRpdmlkdWFsIHdvcmRzXG4gICAgLnNwbGl0KC9bXkEtWmEtejAtOV0rLylcbiAgICAvLyBMb29rIGZvciB0aGUgaGVsbG8gYW5kIGhleSB3b3Jkc1xuICAgIC5maWx0ZXIoKHdvcmQpID0+IC9eKGhlbGxvfGhleSkkL2kudGVzdCh3b3JkKSkubGVuZ3RoKVxuXG4gICAgLy8gU2VuZCB0aGUgZWNobyBtZXNzYWdlXG4gICAgc2VuZChyZXEuYm9keS5zcGFjZUlkLFxuICAgICAgdXRpbC5mb3JtYXQoXG4gICAgICAgICdIZXkgJXMsIGRpZCB5b3Ugc2F5ICVzPycsXG4gICAgICAgIHJlcS5ib2R5LnVzZXJOYW1lLCByZXEuYm9keS5jb250ZW50KSxcbiAgICAgIHRva2VuKCksXG4gICAgICAoZXJyLCByZXMpID0+IHtcbiAgICAgICAgaWYoIWVycilcbiAgICAgICAgICBsb2coJ1NlbnQgbWVzc2FnZSB0byBzcGFjZSAlcycsIHJlcS5ib2R5LnNwYWNlSWQpO1xuICAgICAgfSk7XG59O1xuXG4vLyBTZW5kIGFuIGFwcCBtZXNzYWdlIHRvIHRoZSBjb252ZXJzYXRpb24gaW4gYSBzcGFjZVxuY29uc3Qgc2VuZCA9IChzcGFjZUlkLCB0ZXh0LCB0b2ssIGNiKSA9PiB7XG4gIHJlcXVlc3QucG9zdChcbiAgICAnaHR0cHM6Ly9hcGkud2F0c29ud29yay5pYm0uY29tL3YxL3NwYWNlcy8nICsgc3BhY2VJZCArICcvbWVzc2FnZXMnLCB7XG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIEF1dGhvcml6YXRpb246ICdCZWFyZXIgJyArIHRva1xuICAgICAgfSxcbiAgICAgIGpzb246IHRydWUsXG4gICAgICAvLyBBbiBBcHAgbWVzc2FnZSBjYW4gc3BlY2lmeSBhIGNvbG9yLCBhIHRpdGxlLCBtYXJrZG93biB0ZXh0IGFuZFxuICAgICAgLy8gYW4gJ2FjdG9yJyB1c2VmdWwgdG8gc2hvdyB3aGVyZSB0aGUgbWVzc2FnZSBpcyBjb21pbmcgZnJvbVxuICAgICAgYm9keToge1xuICAgICAgICB0eXBlOiAnYXBwTWVzc2FnZScsXG4gICAgICAgIHZlcnNpb246IDEuMCxcbiAgICAgICAgYW5ub3RhdGlvbnM6IFt7XG4gICAgICAgICAgdHlwZTogJ2dlbmVyaWMnLFxuICAgICAgICAgIHZlcnNpb246IDEuMCxcblxuICAgICAgICAgIGNvbG9yOiAnIzZDQjdGQicsXG4gICAgICAgICAgdGl0bGU6ICdFY2hvIG1lc3NhZ2UnLFxuICAgICAgICAgIHRleHQ6IHRleHQsXG5cbiAgICAgICAgICBhY3Rvcjoge1xuICAgICAgICAgICAgbmFtZTogJ0hlYWx0aENhcmUgQm90IFYxLjAnLFxuICAgICAgICAgICAgYXZhdGFyOiAnaHR0cHM6Ly9zY3dhdHNvbndvcmstZWNoby5teWJsdWVtaXgubmV0L2JvdC5wbmcnLFxuICAgICAgICAgICAgdXJsOiAnaHR0cHM6Ly9naXRodWIuY29tL3dhdHNvbndvcmsvd2F0c29ud29yay1lY2hvJ1xuICAgICAgICAgIH1cbiAgICAgICAgfV1cbiAgICAgIH1cbiAgICB9LCAoZXJyLCByZXMpID0+IHtcbiAgICAgIGlmKGVyciB8fCByZXMuc3RhdHVzQ29kZSAhPT0gMjAxKSB7XG4gICAgICAgIGxvZygnRXJyb3Igc2VuZGluZyBtZXNzYWdlICVvJywgZXJyIHx8IHJlcy5zdGF0dXNDb2RlKTtcbiAgICAgICAgY2IoZXJyIHx8IG5ldyBFcnJvcihyZXMuc3RhdHVzQ29kZSkpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBsb2coJ1NlbmQgcmVzdWx0ICVkLCAlbycsIHJlcy5zdGF0dXNDb2RlLCByZXMuYm9keSk7XG4gICAgICBjYihudWxsLCByZXMuYm9keSk7XG4gICAgfSk7XG59O1xuXG4vLyBWZXJpZnkgV2F0c29uIFdvcmsgcmVxdWVzdCBzaWduYXR1cmVcbmV4cG9ydCBjb25zdCB2ZXJpZnkgPSAod3NlY3JldCkgPT4gKHJlcSwgcmVzLCBidWYsIGVuY29kaW5nKSA9PiB7XG4gIGlmKHJlcS5nZXQoJ1gtT1VUQk9VTkQtVE9LRU4nKSAhPT1cbiAgICBjcmVhdGVIbWFjKCdzaGEyNTYnLCB3c2VjcmV0KS51cGRhdGUoYnVmKS5kaWdlc3QoJ2hleCcpKSB7XG4gICAgbG9nKCdJbnZhbGlkIHJlcXVlc3Qgc2lnbmF0dXJlJyk7XG4gICAgY29uc3QgZXJyID0gbmV3IEVycm9yKCdJbnZhbGlkIHJlcXVlc3Qgc2lnbmF0dXJlJyk7XG4gICAgZXJyLnN0YXR1cyA9IDQwMTtcbiAgICB0aHJvdyBlcnI7XG4gIH1cbn07XG5cbi8vIEhhbmRsZSBXYXRzb24gV29yayBXZWJob29rIGNoYWxsZW5nZSByZXF1ZXN0c1xuZXhwb3J0IGNvbnN0IGNoYWxsZW5nZSA9ICh3c2VjcmV0KSA9PiAocmVxLCByZXMsIG5leHQpID0+IHtcbiAgaWYocmVxLmJvZHkudHlwZSA9PT0gJ3ZlcmlmaWNhdGlvbicpIHtcbiAgICBsb2coJ0dvdCBXZWJob29rIHZlcmlmaWNhdGlvbiBjaGFsbGVuZ2UgJW8nLCByZXEuYm9keSk7XG4gICAgY29uc3QgYm9keSA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIHJlc3BvbnNlOiByZXEuYm9keS5jaGFsbGVuZ2VcbiAgICB9KTtcbiAgICByZXMuc2V0KCdYLU9VVEJPVU5ELVRPS0VOJyxcbiAgICAgIGNyZWF0ZUhtYWMoJ3NoYTI1NicsIHdzZWNyZXQpLnVwZGF0ZShib2R5KS5kaWdlc3QoJ2hleCcpKTtcbiAgICByZXMudHlwZSgnanNvbicpLnNlbmQoYm9keSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIG5leHQoKTtcbn07XG5cbi8vIENyZWF0ZSBFeHByZXNzIEFwcFxuY29uc3QgYXBwID0gZXhwcmVzcygpO1xuXG4vLyBzZXJ2ZSB0aGUgZmlsZXMgb3V0IG9mIC4vcHVibGljIGFzIG91ciBtYWluIGZpbGVzXG5hcHAudXNlKGV4cHJlc3Muc3RhdGljKHBhdGguZGlybmFtZShfX2Rpcm5hbWUpICsgXCIvcHVibGljXCIpKTtcbmxvZyhcIlVzaW5nIHBhdGg6IFwiICsgcGF0aC5kaXJuYW1lKF9fZGlybmFtZSkgKyBcIi9wdWJsaWNcIik7XG5cbmFwcC5nZXQoXCIvd2ViaG9va1wiLCBmdW5jdGlvbihyZXEsIHJlcykge1xuXHRmcy5yZWFkRmlsZShwYXRoLmRpcm5hbWUoX19kaXJuYW1lKSArIFwiL3B1YmxpYy93ZWJob29rLmh0bWxcIiwgJ3V0Zi04JywgZnVuY3Rpb24oZXJyLCBkYXRhKSB7XG4gICAgaWYgKGVycikge1xuICAgICAgY29uc29sZS5sb2coXCJFcnJvcjpcIiArIGVycik7XG4gICAgICByZXMud3JpdGVIZWFkKDUwMCk7XG4gICAgICByZXR1cm4gcmVzLmVuZChcIkVycm9yIGxvYWRpbmcgd2ViaG9vay1ldmVudC1sb2cuaHRtbFwiKTtcbiAgICB9XG4gICAgcmVzLndyaXRlSGVhZCgyMDApO1xuICAgIHJlcy5lbmQoZGF0YSk7XG4gIH0pO1xufSk7XG5cbi8vIENyZWF0ZSBFeHByZXNzIFdlYiBhcHBcbmV4cG9ydCBjb25zdCB3ZWJhcHAgPSAoYXBwSWQsIHNlY3JldCwgd3NlY3JldCwgY2IpID0+IHtcbiAgLy8gQXV0aGVudGljYXRlIHRoZSBhcHAgYW5kIGdldCBhbiBPQXV0aCB0b2tlblxuICBvYXV0aC5ydW4oYXBwSWQsIHNlY3JldCwgKGVyciwgdG9rZW4pID0+IHtcbiAgICBpZihlcnIpIHtcbiAgICAgIGNiKGVycik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIHRoZSBFeHByZXNzIFdlYiBhcHBcbiAgICBjYihudWxsLCBhcHBcblxuICAgICAgLy8gQ29uZmlndXJlIEV4cHJlc3Mgcm91dGUgZm9yIHRoZSBhcHAgV2ViaG9va1xuICAgICAgLnBvc3QoJy9lY2hvJyxcblxuICAgICAgICAvLyBWZXJpZnkgV2F0c29uIFdvcmsgcmVxdWVzdCBzaWduYXR1cmUgYW5kIHBhcnNlIHJlcXVlc3QgYm9keVxuICAgICAgICBicGFyc2VyLmpzb24oe1xuICAgICAgICAgIHR5cGU6ICcqLyonLFxuICAgICAgICAgIHZlcmlmeTogdmVyaWZ5KHdzZWNyZXQpXG4gICAgICAgIH0pLFxuXG4gICAgICAgIC8vIEhhbmRsZSBXYXRzb24gV29yayBXZWJob29rIGNoYWxsZW5nZSByZXF1ZXN0c1xuICAgICAgICBjaGFsbGVuZ2Uod3NlY3JldCksXG5cbiAgICAgICAgLy8gSGFuZGxlIFdhdHNvbiBXb3JrIG1lc3NhZ2VzXG4gICAgICAgIGVjaG8oYXBwSWQsIHRva2VuKSkpO1xuICB9KTtcbn07XG5cbi8vIEFwcCBtYWluIGVudHJ5IHBvaW50XG5jb25zdCBtYWluID0gKGFyZ3YsIGVudiwgY2IpID0+IHtcbiAgLy8gQ3JlYXRlIEV4cHJlc3MgV2ViIGFwcFxuICBsb2coXCJFQ0hPX0FQUF9JRDogJXNcIiwgZW52LkVDSE9fQVBQX0lEKTtcbiAgbG9nKFwiRUNIT19BUFBfU0VDUkVUOiAlc1wiLCBlbnYuRUNIT19BUFBfU0VDUkVUKTtcbiAgbG9nKFwiRUNIT19XRUJIT09LX1NFQ1JFVDogJXNcIiwgZW52LkVDSE9fV0VCSE9PS19TRUNSRVQpO1xuICB3ZWJhcHAoXG4gICAgZW52LkVDSE9fQVBQX0lELCBlbnYuRUNIT19BUFBfU0VDUkVULFxuICAgIGVudi5FQ0hPX1dFQkhPT0tfU0VDUkVULCAoZXJyLCBhcHApID0+IHtcbiAgICAgIGlmKGVycikge1xuICAgICAgICBjYihlcnIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmKGVudi5QT1JUKSB7XG4gICAgICAgIC8vIEluIGEgaG9zdGluZyBlbnZpcm9ubWVudCBsaWtlIEJsdWVtaXggZm9yIGV4YW1wbGUsIEhUVFBTIGlzXG4gICAgICAgIC8vIGhhbmRsZWQgYnkgYSByZXZlcnNlIHByb3h5IGluIGZyb250IG9mIHRoZSBhcHAsIGp1c3QgbGlzdGVuXG4gICAgICAgIC8vIG9uIHRoZSBjb25maWd1cmVkIEhUVFAgcG9ydFxuICAgICAgICBsb2coJ0hUVFAgc2VydmVyIGxpc3RlbmluZyBvbiBwb3J0ICVkJywgZW52LlBPUlQpO1xuICAgICAgICBpbyA9IHNvY2tldC5saXN0ZW4oaHR0cC5jcmVhdGVTZXJ2ZXIoYXBwKS5saXN0ZW4oZW52LlBPUlQsIGNiKSk7XG4gICAgICB9XG5cbiAgICAgIGVsc2VcbiAgICAgICAgLy8gTGlzdGVuIG9uIHRoZSBjb25maWd1cmVkIEhUVFBTIHBvcnQsIGRlZmF1bHQgdG8gNDQzXG4gICAgICAgIHNzbC5jb25mKGVudiwgKGVyciwgY29uZikgPT4ge1xuICAgICAgICAgIGlmKGVycikge1xuICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgcG9ydCA9IGVudi5TU0xQT1JUIHx8IDQ0MztcbiAgICAgICAgICBsb2coJ0hUVFBTIHNlcnZlciBsaXN0ZW5pbmcgb24gcG9ydCAlZCcsIHBvcnQpO1xuICAgICAgICAgIGh0dHBzLmNyZWF0ZVNlcnZlcihjb25mLCBhcHApLmxpc3Rlbihwb3J0LCBjYik7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufTtcblxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKVxuICBtYWluKHByb2Nlc3MuYXJndiwgcHJvY2Vzcy5lbnYsIChlcnIpID0+IHtcbiAgICBpZihlcnIpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdFcnJvciBzdGFydGluZyBhcHA6JywgZXJyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbG9nKCdBcHAgc3RhcnRlZCcpO1xuICB9KTtcbiJdfQ==