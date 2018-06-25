"use strict";
const childProcess = require('child_process');
const colors = require('colors');
const pathnames = require('./pathnames');
const escapeHtml = require('escape-html');

var numberRequestsRunning = 0;
var maxRequestsRunning = 4;

function fabcoinInitialize(request, response, desiredCommand) {
  numberRequestsRunning ++;
  if (numberRequestsRunning > maxRequestsRunning) {
    response.writeHead(500);
    numberRequestsRunning --;
    return response.end(`Too many (${numberRequestsRunning}) requests running, maximum allowed: ${maxRequestsRunning}`);
  }
  if (desiredCommand[pathnames.fabcoinInitialization] === undefined) {
    response.writeHead(400);
    numberRequestsRunning --;
    return response.end(`Request is missing the ${pathnames.fabcoinInitialization} entry. `);        
  }
  var theCallLabel = desiredCommand[pathnames.fabcoinInitialization];
  if (!(theCallLabel in pathnames.fabcoinInitializationProcedures)){
    response.writeHead(400);
    numberRequestsRunning --;
    return response.end(`Fabcoin initialization call label ${theCallLabel} not found. `);    
  }
  var theErrors = [];
  var theArguments = pathnames.getFabcoinInitializationCallArguments(theCallLabel, desiredCommand, theErrors);
  if (theErrors.length > 0) {
    response.writeHead(200);
    return response.end(`{"error": "${theErrors[0]}"}`);
  }
  var theCall = pathnames.fabcoinInitializationProcedures[theCallLabel];
  var theCommand = `${theCall.command}`;
  const defaultOptions = {
    cwd: undefined,
    env: process.env
  };
  console.log(`Executing fabcoin initialization command: ${theCommand}.`.blue);
  console.log(`Arguments: ${theArguments}.`.green);
  if (theCall.path !== undefined && theCall.path !== null && theCall.path !== "") {
    if (theCall.path in pathnames.pathsComputedAtRunTime) {
      console.log(`Path substitution: ${theCall.path} is replaced by: ${pathnames.pathsComputedAtRunTime[theCall.path]}`);
      theCall.path = pathnames.pathsComputedAtRunTime[theCall.path];
    }
    defaultOptions.cwd = theCall.path;
    console.log(`Command will start from: ${defaultOptions.cwd}`.yellow);
  }
  var finalData = "";
  var sentResponse = false;
  try {
    var child = childProcess.spawn(theCommand, theArguments, defaultOptions);
    child.stdout.on('data', function(data) {
      console.log(data.toString());
      finalData += data.toString();
    });
    child.stderr.on('data', function(data) {
      console.log(data.toString());
      finalData += data.toString();
    });
    child.on('error', function(data) {
      console.log(data.toString());
      numberRequestsRunning --;
      if (!sentResponse) {
        sentResponse = true;
        response.writeHead(200);
        response.end(`{"error": "${data}", "data": "${finalData}"}`);
      }
    });
    child.on('exit', function(code) {
      console.log(`Fabcoin initialization exited with code: ${code}`.green);
      numberRequestsRunning --;
      if (code === 0) {
        response.writeHead(200);
        if (finalData === "") {
          finalData = `Nothing to output: most likely your command was executed correctly.`;
        }
        response.end(finalData);
      } else {
        if (!sentResponse) {
          sentResponse = true;
          response.writeHead(200);
          response.end(`{"error": "${finalData}"}`);
        }
      }
    });
  } catch (e) {
    response.writeHead(500);
    numberRequestsRunning --;
    response.end(`Eror: ${escapeHtml(e)}. `);
    console.log(`Error: ${e}`);
  }
  return;
}

module.exports = {
  fabcoinInitialize
}