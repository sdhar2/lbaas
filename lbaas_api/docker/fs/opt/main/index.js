/**
 * Copyright 2015 ARRIS Enterprises, Inc. All rights reserved.
 * This program is confidential and proprietary to ARRIS Enterprises, Inc. (ARRIS),
 * and may not be copied, reproduced, modified, disclosed to others, published or used,
 * in whole or in part, without the express prior written permission of ARRIS.
 */

/**
 * Main lbaas_api REST API Handlers
 */

/**
 * Import modules
 */
var express = require('express');
var router = express.Router();
var appLogger = require('../utils/app_logger');
var RouteManager = require('../modules/RouteManager')

/**
 * Global variables
 */

function createJsonResponse(message) 
{
	var jsonResponse = {};
	jsonResponse.$schema = "/schemas/Report/v1.0";
	jsonResponse.Report = {};
	jsonResponse.Report.message = message;

	return jsonResponse;
}

/**
 * GET home page. 
 */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/** 
 * Handler for create or update a route
 */
router.put('/lbaas/v1.0/apps/:appId/routes/:routeName', function(req, res, next)
  {
    var appId = req.params.appId;
    var routeName = req.params.routeName;
    var fePort = req.query.fePort;
    var feUriMatch = req.query.feUriMatch;
    var beServerContainerId = req.query.beServerContainerId;
    var beServerContainerPort = req.query.beServerContainerPort;
    var beServerHost = req.query.beServerHost;
    var beServerHostPort = req.query.beServerHostPort;
    var beHealthUri = req.query.beHealthUri;
    var beServerBackup = req.query.beServerBackup;

    appLogger.info("LBAPI: Received create or update route request, appId=" + appId +
                   ", routeName=" + routeName + ", fePort=" + fePort + ", feUriMatch=" + feUriMatch +
                   ", beServerContainerId=" + beServerContainerId + ", beServerContainerPort=" + beServerContainerPort +
                   ", beServerHostPort=" + beServerHostPort, + ", beHealthUri=" + beHealthUri +
                   ", beServerBackup=" + beServerBackup);

    if (!appId || !routeName || !fePort)
    {
    	var message = "LBAPI: Not all required parameters are supplied to create or update route.";
    	appLogger.info(message);
    	res.status(400).send(JSON.stringify(createJsonResponse(message)));
    	return;
    }
 
	var routeManager = new RouteManager(appId);
	routeManager.createUpdateRoute(routeName, fePort, feUriMatch, beServerBackup, beServerContainerId, beServerContainerPort, beServerHost, beServerHostPort, beHealthUri, function (err)
	{
		var message = "LBAPI: The route was successfully added.";
        if (err) 
        {
        	message = "LBAPI: Create/Update Route Error. "+ err.message;
        	res.status(err.code).send(JSON.stringify(createJsonResponse(message)));
        	return;
        }
        appLogger.info(message);
        res.status(201).send(JSON.stringify(createJsonResponse(message)));
	});
  }
);

router.delete('/lbaas/v1.0/apps/:appId/routes/:routeName', function(req, res, next)
  {
    var appId = req.params.appId;
    var routeName = req.params.routeName;

    appLogger.info("LBAPI: Received delete route request, appId=" + appId + ", routeName=" + routeName);

    if (!appId || !routeName)
    {
    	var message = "LBAPI: Not all required parameters are supplied to delete route."
    	appLogger.info(message);
        res.status(400).send(JSON.stringify(createJsonResponse(message)));
        return;
    }
    
    var routeManager = new RouteManager(appId);
	routeManager.deleteRoute(routeName, function (err) 
	{
		var message = "LBAPI: The route was successfully deleted.";
        if (err) 
        {
        	message = "LBAPI: Delete Route Error. "+ err.message;
        	res.status(err.code).send(JSON.stringify(createJsonResponse(message)));
        	return;
        }
        appLogger.info(message);
        res.status(200).send(JSON.stringify(createJsonResponse(message)));
	});
  }
);

router.delete('/lbaas/v1.0/apps/:appId/routes/:routeName/backend/servers/:backend', function(req, res, next)
  {
    var appId = req.params.appId;
    var routeName = req.params.routeName;
    var backend = req.params.backend;

    appLogger.info("LBAPI: Received delete route request, appId=" + appId + ", routeName=" + routeName + ", backend=" + backend);

    if (!appId || !routeName || !backend)
    {
    	var message = "LBAPI: Not all required parameters are supplied to delete backend server.";
    	appLogger.info(message);
    	res.status(400).send(JSON.stringify(createJsonResponse(message)));
    	return;
    }
    
    // parse the backend and separate the container/host and the port
    var index = backend.indexOf(":");
    var container_host;
    var port;
    if (index > 0)
    {
    	container_host = backend.substr(0, index);
    	port = backend.substr(index + 1);
    }
    if (!container_host || !port)
    {
    	var message = "LBAPI: Backend parameters must be of the format {container-id-or-host}:{container-or-host-port}.";
    	appLogger.info(message);
    	res.status(400).send(JSON.stringify(createJsonResponse(message)));
        return;
    }
      
    var routeManager = new RouteManager(appId);
	routeManager.deleteBackendServer(routeName, container_host, port, function (err) 
	{
		var message = "LBAPI: The backend server was successfully deleted.";
        if (err) 
        {
        	message = "LBAPI: Delete Backend Server Error. "+ err.message;
        	res.status(err.code).send(JSON.stringify(createJsonResponse(message)));
        	return;
        }
        appLogger.info(message);
        res.status(200).send(JSON.stringify(createJsonResponse(message)));
	});
  }
);

router.get('/lbaas/v1.0/apps/:appId/routes/:routeName', function(req, res, next)
  {
    var appId = req.params.appId;
    var routeName = req.params.routeName;

    appLogger.info("LBAPI: Received retrieve route request, appId=" + appId + ", routeName=" + routeName);

    if (!appId || !routeName)
    {
    	var message = "LBAPI: Not all required parameters are supplied to retrieve route.";
    	appLogger.info(message);
    	res.status(400).send(JSON.stringify(createJsonResponse(message)));
    	return;
    }
    
    var routeManager = new RouteManager(appId);
	routeManager.retrieveRoute(routeName, function (err, contentBody) 
	{	
        if (err) 
        {
        	var message = "LBAPI: Retrieve Route Error. "+ err.message;
        	res.status(err.code).send(JSON.stringify(createJsonResponse(message)));
        	return;
        }
        appLogger.info(contentBody);
        res.status(200).send(JSON.stringify(contentBody));
	});
  }
);

router.get('/lbaas/v1.0/apps/:appId/routes/', function(req, res, next)
  {
    var appId = req.params.appId;

    appLogger.info("LBAPI: Received retrieve route list request, appId=" + appId);

    if (!appId)
    {
    	var message = "LBAPI: Not all required parameters are supplied to retrieve route list.";
    	res.status(400).send(JSON.stringify(createJsonResponse(message)));
    	return;
    }
    
    var routeManager = new RouteManager(appId);
	routeManager.retrieveRouteList(function (err, contentBody) 
	{	
        if (err) 
        {
        	var message = "LBAPI: Retrieve Route List Error. "+ err.message;
        	res.status(err.code).send(JSON.stringify(createJsonResponse(message)));
        	return;
        }
        appLogger.info(contentBody);
        res.status(200).send(JSON.stringify(contentBody));
	});
  }
);

module.exports = router;
