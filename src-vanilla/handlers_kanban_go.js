"use strict";
const url  = require('url');
const queryString = require('querystring');
const http = require('http');
const pathnames = require('./pathnames');
const kanbanGO = require('./resources_kanban_go');
const kanabanGoInitializer = require('./handlers_kanban_go_initialization');

function handleRequest(request, response) {
  if (request.method === "POST") {
    return handleRPCPOST(request, response);
  }
  if (request.method === "GET") {
    return handleRPCGET(request, response);
  }
  response.writeHead(400);
  return response.end(`Method not implemented: ${request.method} not implemented. `);
}

function handleRPCPOST(request, response) {
  let body = [];
  request.on('error', (theError) => {
    response.writeHead(400);
    response.end(`Error during message body retrieval. ${theError}`);
  }).on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    body = Buffer.concat(body).toString();
    return handleRPCURLEncodedInput(request, response, body);
  });
}

function handleRPCGET(request, response) {
  var parsedURL = null;
  try {
    parsedURL = url.parse(request.url);
  } catch (e) {
    response.writeHead(400);
    return response.end(`In handlers_kanban_go: bad RPC request: ${e}.`);
  }
  return handleRPCURLEncodedInput(request, response, parsedURL.query);
}

function handleRPCURLEncodedInput(request, response, messageBodyURLed) {
  var query = null;
  var queryCommand = null;
  var queryNode = null;
  try {
    query = queryString.parse(messageBodyURLed);
    queryCommand = JSON.parse(query.command);
    queryNode = JSON.parse(query[kanbanGO.urlStrings.node]);    
  } catch (e) {
    response.writeHead(400);
    return response.end(`Bad RPC input. ${e}`);
  }
  return handleRPCArguments(response, queryCommand, queryNode);
}

var numberRequestsRunning = 0;
var maxRequestsRunning = 4;

function getParameterFromType(input, type) {
  if (type === "number") {
    return Number(input);
  }
  if (type === "numberHex") {
    if (typeof input === "string") {
      if (!input.startsWith("0x")) {
        input = "0x" + input;
      }
      return input;
    }
  }
  return input;
}

function getRPCRequestJSON(rpcCallLabel, queryCommand, errors) {
  /**@type {{rpcCall: string, method: string, mandatoryFixedArguments: Object,  mandatoryModifiableArguments: Object,  optionalModifiableArguments: Object, allowedArgumentValues: Object, parameters: string[]}}*/
  var currentRPCCall = kanbanGO.rpcCalls[rpcCallLabel];
  var currentParameters = [];
  for (var counterCommands = 0; counterCommands < currentRPCCall.parameters.length; counterCommands ++) {
    var currentParameterName = currentRPCCall.parameters[counterCommands];
    if (currentParameterName in currentRPCCall.mandatoryFixedArguments) {
      currentParameters.push(currentRPCCall.mandatoryFixedArguments[currentParameterName]);
      continue;
    }
    if (currentParameterName in queryCommand) {
      var incomingParameter = queryCommand[currentParameterName];
      if (currentRPCCall.types !== undefined) {
        incomingParameter = getParameterFromType(incomingParameter, currentRPCCall.types[currentParameterName]);
      }
      currentParameters.push(incomingParameter);
      continue;
    }
    if (currentRPCCall.optionalModifiableArguments !== undefined && currentRPCCall.optionalModifiableArguments !== null) {
      var currentDefault = currentRPCCall.optionalModifiableArguments[currentParameterName];
      if (currentDefault !== undefined && currentDefault !== null) {
        currentParameters.push(currentDefault);
        continue;
      }
    }
    if (currentRPCCall.mandatoryModifiableArguments !== undefined && currentRPCCall.mandatoryModifiableArguments !== null) {
      if (currentParameterName in currentRPCCall.mandatoryModifiableArguments) {
        errors.push(`Missing parameter ${currentParameterName} in method ${rpcCallLabel}.`);
        return {};
      }
      var currentDefault = currentRPCCall.optionalModifiableArguments[currentParameterName];
      if (currentDefault !== null && currentDefault !== undefined) {
        currentParameters.push(currentDefault);
        continue;
      }
    }
  }
  var result = {
    jsonrpc: "2.0",
    method: currentRPCCall.method,
    params: currentParameters,
    id : (new Date()).getTime() //<- not guaranteed to be unique
  };
  return result;
}

function handleRPCArguments(response, queryCommand, queryNode) {
  numberRequestsRunning ++;
  if (numberRequestsRunning > maxRequestsRunning) {
    response.writeHead(500);
    numberRequestsRunning --;
    return response.end(`Too many (${numberRequestsRunning}) requests running, maximum allowed: ${maxRequestsRunning}`);
  }
  var currentNode = null;
  try {
    if (queryCommand[pathnames.rpcCall] === undefined) {
      response.writeHead(400);
      numberRequestsRunning --;
      return response.end(`Command is missing the ${pathnames.rpcCall} entry. `);        
    }
    var currentNodeId = queryNode.id;
    if (currentNodeId === undefined || currentNodeId === null) {
      response.writeHead(400);
      numberRequestsRunning --;
      return response.end(`Node is missing the id variable. `);        
    }
    currentNodeId = Number(currentNodeId);
    var initializer = kanabanGoInitializer.getInitializer(); 
    currentNode = initializer.nodes[currentNodeId];
    if (currentNode === undefined || currentNode === null) {
      response.writeHead(400);
      numberRequestsRunning --;
      return response.end(`Failed to extract node id. ${e}`);          
    }
  } catch (e) {
    response.writeHead(400);
    numberRequestsRunning --;
    return response.end(`Failed to extract node id. ${e}`);        
  }
  var theCallLabel = queryCommand[pathnames.rpcCall];
  var callCollection = kanbanGO.rpcCalls;
  if (!(theCallLabel in callCollection)) {
    response.writeHead(400);
    numberRequestsRunning --;
    return response.end(`RPC call label ${theCallLabel} not found. `);    
  }
  var currentCall = callCollection[theCallLabel];
  if (currentCall.easyAccessControlOrigin === true) {
    //console.log("Setting header ...");
    response.setHeader('Access-Control-Allow-Origin', '*');
  }
  var errors = [];
  var theRequestJSON = getRPCRequestJSON(theCallLabel, queryCommand, errors);
  if (errors.length > 0) {
    response.writeHead(400);
    return response.end(JSON.stringify({error: errors[0]}));
  }
  console.log("DEBUG: request stringified: " + JSON.stringify(theRequestJSON));
  var requestStringified = JSON.stringify(theRequestJSON);
  return handleRPCArgumentsPartTwo(response, requestStringified, currentNode);
}

function handleRPCArgumentsPartTwo(response, requestStringified, currentNode) {
  var requestOptions = {
    host: '127.0.0.1',
    port: currentNode.RPCPort,
    method: 'POST',
    path: '/',
    headers: {
      'Host': 'localhost',
      'Content-Length': requestStringified.length,
      'Content-Type': 'application/json'
    },
    //auth: "bb98a0b6442386d0cdf8a31b267892c1"    
    //agent: false,
    //rejectUnauthorized: this.opts.ssl && this.opts.sslStrict !== false
  };
  //console.log ("DEBUG: options for request: " + JSON.stringify(requestOptions));
  console.log (`DEBUG: about to submit request: ${requestStringified}`.green);
  console.log (`DEBUG:  submit options: ${JSON.stringify(requestOptions)}`.green);
  //console.log ("DEBUG: request object: " + JSON.stringify(RPCRequestObject));

  var theHTTPrequest = http.request(requestOptions);

  try {
    //console.log("DEBUG: got to here");
    theHTTPrequest.on('error', function(theError) {
      response.writeHead(500);
      numberRequestsRunning --;
      response.end(`Eror during commmunication with rpc server. ${theError}. `);
      console.log(`Eror during commmunication with rpc server. ${theError}. `);
    }); 
    theHTTPrequest.on('response', function(theHTTPresponse) {
      var finalData = "";
      //console.log("DEBUG: got response!")
      theHTTPresponse.on ('data', function (chunk) {
        finalData += chunk;
        //console.log(`DEBUG: got data chunk: ${chunk}`)
      });
      theHTTPresponse.on('error', function(yetAnotherError){
        response.writeHead(500);
        numberRequestsRunning --;
        response.end(`Eror during commmunication with rpc server. ${yetAnotherError}. `);
        //console.log(`Eror during commmunication with rpc server. ${yetAnotherError}. `);  
      });
      theHTTPresponse.on('end', function() {
        numberRequestsRunning --;
        //console.log(`DEBUG: about to respond with status code: ${theHTTPresponse.statusCode}. Final data: ${finalData}`);
        if (theHTTPresponse.statusCode !== 200) {
          response.writeHead(theHTTPresponse.statusCode);
          return response.end(finalData);
        }
        try {
          //console.log("DEBUG: Parsing: " + finalData + " typeof final data: " + (typeof finalData));
          var dataParsed = JSON.parse(finalData);
          if (dataParsed.error !== null && dataParsed.error !== "" && dataParsed.error !== undefined) {
            //console.log("DEBUG: Data parsed error:" + dataParsed.error);
            response.writeHead(200);
            return response.end(dataParsed.error);
          }
          response.writeHead(200);
          return response.end(JSON.stringify(dataParsed.result));
        } catch (errorParsing) {
          response.writeHead(500);
          return response.end(`Error parsing kanbanGO's output: ${finalData}. Error message: ${errorParsing}. `);
        }
      });
    });
    //console.log("DEBUG: got to before end.");
    theHTTPrequest.end(requestStringified);
  } catch (e) {
    response.writeHead(500);
    numberRequestsRunning --;
    response.end(`Eror spawning fabcoin-cli process. ${escapeHtml(e)}. `);
    console.log(`Eror spawning process fabcoin-cli. ${e}`);
  }
}

module.exports = {
  handleRequest
}