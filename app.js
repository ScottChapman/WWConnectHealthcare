/*eslint-env node, express*/

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require("express");
var crypto = require("crypto");
var http = require("http");
var cfenv = require('cfenv');
var fs = require('fs');
var events = require("events");
var eventHandler = new events.EventEmitter();
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
var debug = require('debug');

var log = debug("WWConnect2017Healthcare");


var WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
// var WEBHOOK_SECRET = '32ltozd7yiykq1rcglxnxk77rbsg69je';
const WEBHOOK_CALLBACK = "/webhook_callback";

var WEBHOOK_VERIFICATION_TOKEN_HEADER="X-OUTBOUND-TOKEN".toLowerCase();
var WEBHOOK_ORDER_INDEX_HEADER="X-OUTBOUND-INDEX".toLowerCase();
var WEBHOOK_RETRY_COUNT_HEADER="X-OUTBOUND-RETRY-COUNT".toLowerCase();

// create a new express server
var app = express();

// serve the files out of ./public as our main files
app.use(express.static(__dirname + "/public"));

function rawBody(req, res, next) {
	var buffers = [];
	req.on("data", function(chunk) {
		buffers.push(chunk);
	});
	req.on("end", function(){
		req.rawBody = Buffer.concat(buffers);
		next();
	});
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  res.status(500);
  res.render("error", { error: err });
}

app.use(rawBody);
app.use(errorHandler);
var appEnv = cfenv.getAppEnv();

var httpServer = http.createServer(app).listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
  console.log("\n");
});
var io = require("socket.io").listen(httpServer);

// app.listen(process.env.PORT || 3000, () => {
//   console.log('environment variables', )
//   console.log("app is listening on port: " + (process.env.PORT || 3000));
//   console.log("\n");
// });

function formatDate(date) {
	return date.getMonth() + "/" + date.getDate() + "/" + date.getFullYear() + ", " +
		date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + "." + date.getMilliseconds();
}
app.get("/webhook", function(req, res) {
	fs.readFile(__dirname + "/public/webhook.html", 'utf-8', function(err, data) {
    if (err) {
      console.log("Error:" + err);
      res.writeHead(500);
      return res.end("Error loading webhook-event-log.html");
    }
    res.writeHead(200);
    res.end(data);
  });
});

app.get('/test', function(req, res){
	var d = new Date();
	console.log(formatDate(d));
  io.sockets.emit('webhook-event', { some: 'data' });
res.send('hey');
})

app.post(WEBHOOK_CALLBACK, function(req, res) {
	var data = { eventTime: new Date()};

	if (!verifySender(req.headers, req.rawBody)) {
			console.log("Cannot verify caller ! -------------");
			console.log(req.rawBody.toString());
			res.status(200).end();
			return;
	}
  var body = JSON.parse(req.rawBody.toString());
	var stringJsonbody = JSON.stringify(body);
	var eventType = body.type;
	if (eventType === "verification")
		handleVerificationRequest(res, body.challenge);
	else {
		var orderIndex = req.headers[WEBHOOK_ORDER_INDEX_HEADER];
		var retryCount = req.headers[WEBHOOK_RETRY_COUNT_HEADER];
		// console.log("X-OUTBOUND-ORDER-INDEX, OUTBOUND-RETRY-COUNT: " + orderIndex + ", " + retryCount);
		// console.log(stringJsonbody);
		// console.log("Event original time:" + Date (body.time));
		// console.log("Latency: " + (Date.now() - body.time) );
		data.body = body;
		io.sockets.emit('webhook-event', data);
		// React to 'hello' or 'hey' keywords in the message and send an echo
	  // message back to the conversation in the originating space
	  if(req.body.content
	    // Tokenize the message text into individual words
	    .split(/[^A-Za-z0-9]+/)
	    // Look for the hello and hey words
	    .filter((word) => /^(hello|hey)$/i.test(word)).length)

	    // Send the echo message
	    send(req.body.spaceId,
	      util.format(
	        'Hey %s, did you say %s?',
	        req.body.userName, req.body.content),
	      token(),
	      (err, res) => {
	        if(!err)
	          log('Sent message to space %s', req.body.spaceId);
	      });
		res.status(200).end();
	}

});



function verifySender(headers, rawbody)
{
    var headerToken = headers[WEBHOOK_VERIFICATION_TOKEN_HEADER];
    var endpointSecret =  WEBHOOK_SECRET;
		console.log("Verifying Sender:");
		console.dir("Secret: " + endpointSecret);
		console.dir("HeaderToken: " + headerToken);
    var expectedToken = crypto
		.createHmac("sha256", endpointSecret)
		.update(rawbody)
		.digest("hex");

    if (expectedToken === headerToken) {
		   return Boolean(true);
    }
	return Boolean(false);
}

// Send an app message to the conversation in a space
const send = (spaceId, text, tok, cb) => {
  request.post(
    'https://api.watsonwork.ibm.com/v1/spaces/' + spaceId + '/messages', {
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
            name: 'from sample echo app',
            avatar: 'https://avatars1.githubusercontent.com/u/22985179',
            url: 'https://github.com/watsonwork/watsonwork-echo'
          }
        }]
      }
    }, (err, res) => {
      if(err || res.statusCode !== 201) {
        log('Error sending message %o', err || res.statusCode);
        cb(err || new Error(res.statusCode));
        return;
      }
      log('Send result %d, %o', res.statusCode, res.body);
      cb(null, res.body);
    });
};


function handleVerificationRequest(response, challenge)
{
	  console.log("Secret: " + WEBHOOK_SECRET);
    var responseBodyObject = { "response" : challenge };
    var responseBodyString = JSON.stringify(responseBodyObject);
    var endpointSecret =  WEBHOOK_SECRET;

    var responseToken = crypto
		.createHmac("sha256", endpointSecret)
        .update(responseBodyString)
        .digest("hex");

    response.writeHead(200,
                       {
                           "Content-Type" : "application/json; charset=utf-8",
                           "X-OUTBOUND-TOKEN" : responseToken
                       });
		response.end(responseBodyString);

		console.log ("Verification request processed");
//		console.log("VERIFICATION BODY: " + responseBodyString);
//		console.log("VERIFICATION X-OUTBOUND-TOKEN: " + responseToken);
}

// create a websocket connection for both http+https to keep the content updated
// io.sockets.on("connection", function(socket) {
//   eventHandler.on("eventlog", function(data) {
//       socket.volatile.emit("webhook-event", data);
//   });
// });
