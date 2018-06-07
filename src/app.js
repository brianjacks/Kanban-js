#!/usr/bin/env node
/**
 * Entry point for Kanban
 * 
 */

"use strict";
const pathnames = require('./pathnames');
const path = require('path');
const https = require('https');
const http = require('http');
const openCLDriver = require('./open_cl_driver');
const jobs = require('./jobs');
global.kanban = {
  openCLDriver: new openCLDriver.OpenCLDriver(),
  jobs: new jobs.Jobs()
};
const handleRequests = require('./handle_requests');
const fs = require('fs');
const execSync = require('child_process').execSync;
const colors = require('colors');
const buildFrontEnd = require('./build_frontend');

buildFrontEnd.buildFrontEnd();
// This line is from the Node.js HTTPS documentation.

console.log(`The OpenCL driver is disabled from source code (file ${__filename}).`.blue);
global.kanban.openCLDriver.enabled = false;
global.kanban.openCLDriver.startAndConnect();

var currentPath = pathnames.path.base + "/";
while (currentPath !== "/") {
  var currentPathFabcoin = currentPath + ".fabcoin";
  //console.log("DEBUG: trying current path: " + currentPath + ", fab path: " + currentPathFabcoin);
  if (fs.existsSync(currentPathFabcoin)) {
    pathnames.path.fabcoinConfigurationFolder = currentPathFabcoin;
    pathnames.path.fabcoinConfigurationFolder = path.normalize(pathnames.path.fabcoinConfigurationFolder);
    console.log(`Using fabcoin configuration folder: ${pathnames.path.fabcoinConfigurationFolder}`.green);
    break;
  }
  currentPath = path.normalize(currentPath + "../");
}
if (pathnames.path.fabcoinConfigurationFolder === null) {
  console.log("Was not able to find the fabcoin configuration folder .fabcoin in any of the parent folders. ".red);
}

if (!fs.existsSync(pathnames.pathname.privateKey)) {
  console.log(`Private key file: ${pathnames.pathname.privateKey} appears not to exist. Let me create that for you. Answer all prompts please (enter for defaults). `);
  execSync(`openssl req -new -newkey rsa:2048 -days 3000 -nodes -x509 -subj "/C=CA/ST=ON/L=Markham/O=FA Enterprise System/CN=none" -keyout ${pathnames.pathname.privateKey} -out ${pathnames.pathname.certificate}`);
}
var options = {
  cert: fs.readFileSync(pathnames.pathname.certificate),
  key: fs.readFileSync(pathnames.pathname.privateKey)
};

var portHttps = 52907;
var portHttp = 51846;

var serverHTTPS = https.createServer(options, handleRequests.handle_requests);
serverHTTPS.listen(portHttps, function() {
  console.log(`Listening on https port: ${portHttps}`.green);
});

var serverHTTP = http.createServer(handleRequests.handle_requests);
serverHTTP.listen(portHttp, function(){
  console.log(`Listening on http port: ${portHttp}`.yellow);
});