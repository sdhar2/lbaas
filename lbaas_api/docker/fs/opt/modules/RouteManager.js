/**
 * Copyright 2015 ARRIS Enterprises, Inc. All rights reserved.
 * This program is confidential and proprietary to ARRIS Enterprises, Inc. (ARRIS),
 * and may not be copied, reproduced, modified, disclosed to others, published or used,
 * in whole or in part, without the express prior written permission of ARRIS.
 */

/**
 * This module handles route management
 */

/**
 * Import modules
 */
var appLogger = require('../utils/app_logger');
var RouteError = require('../modules/RouteError');
var Etcd = require('node-etcd');
var http = require('http');

/**
 * Constants
 */

/**
 * Globals
 */
var appIdRef;

/**
 * Module class definition 
 */
module.exports = function(appId) 
{
  appLogger.info("RouteManager.enter");

  appIdRef = appId;
  var etcd = new Etcd('etcdcluster', '4001');
  
  function checkFePortUnique(portValue, callback)
  { 
	  etcd.get("/lbaas/ports/", { recursive: true }, function (err, reponse) 
	  {
		  if (err) 
		  {
			  // "/lbaas/ports/" may not be created yet.  This is ok
			  if (err.errorCode == 100)
			  {
				  return callback(null, true);
			  }
			  return callback(new RouteError(400, "ETCD get key error. " + err.message));
		  }

		  var nodes = reponse.node.nodes;
		  for (var index in nodes)
		  {
			  if (nodes[index].value == portValue)
			  {
				  return callback(null, false);
			  }
		  }

		  return callback(null, true);
	  });
  }
  
  
  function addRouteEtcd(routeKey, hostKey, hostValue, portKey, portValue, healthKey, healthValue, swarmKey, swarmValue, callback)
  { 
	// Check if this is new route or an update to an existing route
    etcd.get(routeKey, { recursive: true }, function (err, reponse) 
    {
        if (err && err.errorCode == 100) 
        {
        	// Key not found, this is a new route
        	checkFePortUnique(portValue, function (err, unique)
        	{
        		if (err)
        		{
        			return callback(err);
        		}
        		if (unique == false)
        		{
        			return callback(new RouteError(409, "fePort / feUriMatch combination must be unique on new route."));
        		}
        		
        		// Set ETCD key values for a new route
        	    etcd.set(hostKey, hostValue, function (err, response)
        	    {
        	    	appLogger.info(response);
        	    	if (err) 
        	        {
        	    		return callback(new RouteError(500, "ETCD set key error. " + err.message));
        	        }
        	        
        	        etcd.set(portKey, portValue, function (err, response)
        	        {
        	        	appLogger.info(response);
        	        	if (err) 
        	            {
        	        		return callback(new RouteError(500, "ETCD set key error. " + err.message));
        	            }
        	        	
    	        		etcd.set(healthKey, healthValue, function (err, response)
        	            {
        	            	appLogger.info(response);
        	            	if (err) 
        	                {
        	            		return callback(new RouteError(500, "ETCD set key error. " + err.message));
        	                }
        	            	
        	            	return setSwarmKey(swarmKey, swarmValue, callback); 	
        	            });
        	        });   
        	    });  
        	});
        }
        else if (err)
        {
        	// Some other unexpected error
        	return callback(new RouteError(500, "ETCD get key error. " + err.message));
        }
        else
        {
        	// This is an update of an existing route
        	checkFePortUnique(portValue, function (err, unique)
        	{
        		if (err)
        		{
        			return callback(err);
        		}
        		if (unique == true)
        		{
        			return callback(new RouteError(409, "fePort / feUriMatch combination cannot be unique on route update."));
        		}
        		
        		// Set ETCD key values for a new route
        	    etcd.set(hostKey, hostValue, function (err, response)
        	    {
        	    	appLogger.info(response);
        	    	if (err) 
        	        {
        	    		return callback(new RouteError(500, "ETCD set key error. " + err.message));
        	        }
        	    	
	        		etcd.set(healthKey, healthValue, function (err, response)
    	            {
    	            	appLogger.info(response);
    	            	if (err) 
    	                {
    	            		return callback(new RouteError(500, "ETCD set key error. " + err.message));
    	                }
    	            	
    	            	return setSwarmKey(swarmKey, swarmValue, callback); 	
    	            });
        	    });
        	});
        }
    });
  }
  
  function setSwarmKey(swarmKey, swarmValue, callback)
  {
	  if (swarmKey)
	  {
  		etcd.set(swarmKey, swarmValue, function (err, response)
          {
          	appLogger.info(response);
          	if (err) 
              {
          		return callback(new RouteError(500, "ETCD set key error. " + err.message));
              }
          	
          	return callback(null);
          });
  	  }
  	  else
  	  {
  		  return callback(null);
  	  }  
  }
  
  function createRoute(routeName, fePort, feUriMatch, beHealthUri, backends)
  { 
	  var route = {};
	  route.name = routeName;
	  
	  route.Frontend = {};
	  route.Frontend.port = fePort;
	  route.Frontend.uriMatch = feUriMatch;
	  
	  route.Backend = {};
	  route.Backend.healthUri = beHealthUri;
	  route.Backend.servers = [];
	  
	  for (var i in backends)
	  {
		  var containerId = backends[i].containerId;
		  var containerPort = backends[i].containerPort;
		  var host = backends[i].host;
		  var hostPort = backends[i].hostPort;
		  var backup = backends[i].backup;
		  
		  route.Backend.servers[i] = {};
		  if (containerId)
		  {
			  route.Backend.servers[i].containerId = containerId;
		  }
		  if (containerPort)
		  {
			  route.Backend.servers[i].containerPort = containerPort;
		  }
		  route.Backend.servers[i].host = host;
		  route.Backend.servers[i].hostPort = hostPort;
		  if (backup)
          {
          	route.Backend.servers[i].backup = "true";
          }
          else
          {
          	route.Backend.servers[i].backup = "false";
          }
	  }
	  
	  appLogger.info("route Json = " + JSON.stringify(route));
	  return route;
  }

  /**
   * Create or Update Route 
   */
  this.createUpdateRoute = function(routeName, 
		  fePort, 
		  feUriMatch,
		  beServerBackup,
		  beServerContainerId, 
		  beServerContainerPort, 
		  beServerHost, 
		  beServerHostPort,
		  beHealthUri,
		  callback)
  {
    appLogger.info("RouteManager.createUpdateRoute.enter");

    // Check that the correct combination of parameters are passed in.
    if (beServerContainerId && beServerHost)
    {
    	return callback(new RouteError(400, "Both the beServerContainerId and beServerHost parameters were present in the query string."));
    }
    if (beServerContainerPort && beServerHostPort)
    {
    	return callback(new RouteError(400, "Both the beServerContainerPort and beServerHostPort parameters were present in the query string."));
    }
    if (beServerContainerId && !beServerContainerPort)
    {
    	return callback(new RouteError(400, "The beServerContainerId parameter was present in the query string; however, the beServerContainerPort parameter was not present in the query string."));
    }
    if (beServerHost && !beServerHostPort)
    {
    	return callback(new RouteError(400, "The beServerHost parameter was present in the query string; however, the beServerHostPort parameter was not present in the query string."));
    }
    if (!beServerContainerId && !beServerHost)
    {
    	return callback(new RouteError(400, "Neither beServerContainerId nor beServerHost was present in the query string."));
    }
    if (!beServerContainerPort && !beServerHostPort)
    {
    	return callback(new RouteError(400, "Neither beServerContainerPort nor beServerHostPort was present in the query string."));
    }
    
    var routeKey = "/lbaas/" + appIdRef + "_" + routeName;
    var portKey = "/lbaas/ports/" + appIdRef + "_" + routeName;
	var portValue = fePort;
	if (feUriMatch)
	{
		portValue += ":" + feUriMatch;
	}
	else
	{
		portValue += ":/";
	}
    
	var healthKey = "/lbaas/health/" + appIdRef + "_" + routeName;
    var healthValue = beHealthUri;
    
    // If beServerContainerId / beServerContainerPort combination is used, get the beServerHost and beServerHostPort from the swarm API
    if (beServerContainerId)
    { 		
    	var options =
    	{
    		host: 'swarmcluster',
    		path: '/containers/' + beServerContainerId + '/json',
    		port: '2377',
    		method: 'GET'
    	};

    	var request = http.request(options, function(response)	
    	{
    		var swarm_json_response_str = '';

    		//continue to retrieve date until done 
    		response.on('data', function(chunk) 
    		{
    			swarm_json_response_str += chunk;
    		});

    		//the whole response has been received, process the result
    		response.on('end', function () 
    		{
    			appLogger.info("Received SWARM API response: %s", swarm_json_response_str);

    			//convert the response to JSON object
    			try 
    			{
    				var swarm_json_response = JSON.parse(swarm_json_response_str);
    				var ports = swarm_json_response.NetworkSettings.Ports;
        			var tcp = beServerContainerPort + "/tcp";

        			if (ports[tcp] == undefined)
        			{
        				return callback(new RouteError(409, "Error retrieving HostIp and HostPort from swarmcluster. " + tcp + " undefined."));
        			}
        			else
        			{
        				var hostKey = "/lbaas/" + appIdRef + "_" + routeName + "/" + ports[tcp][0].HostIp + ":" + ports[tcp][0].HostPort;
        				var hostValue = ports[tcp][0].HostIp + ":" + ports[tcp][0].HostPort;
        				
        				var swarmKey = "/swarm/docker/containers/" + appIdRef + "_" + routeName + "/" + ports[tcp][0].HostIp + ":" + ports[tcp][0].HostPort;
        			    var swarmValue = beServerContainerId + ":" + beServerContainerPort;

        			    if (beServerBackup && beServerBackup == "true")
                        {
                        	hostValue += ":backup";
                        }

        				return addRouteEtcd(routeKey, hostKey, hostValue, portKey, portValue, healthKey, healthValue, swarmKey, swarmValue, callback);
        			}
    			}
    			catch (err)
    			{
    				// If it will not parse, then swarm_json_response_str is an error message
    				return callback(new RouteError(409, "Error retrieving HostIp and HostPort from swarmcluster. " + swarm_json_response_str));
    			}
    		});
    	});

    	//request error handling
    	request.on('error', function(err) 
    	{
    		return callback(new RouteError(409, "Error retrieving HostIp and HostPort from swarmcluster. " + e.message));
    	});

    	request.end();
    }
    else
    {
    	var hostKey = "/lbaas/" + appIdRef + "_" + routeName + "/" + beServerHost + ":" + beServerHostPort;
        var hostValue = beServerHost + ":" + beServerHostPort;

        if (beServerBackup && beServerBackup == "true")
        {
            hostValue += ":backup";
        }
        // No swarm info
        return addRouteEtcd(routeKey, hostKey, hostValue, portKey, portValue, healthKey, healthValue, null, null, callback);
    }
    
    appLogger.info("RouteManager.createUpdateRoute.exit");
  }
  
  /**
   * Delete Route 
   */
  this.deleteRoute = function(routeName, callback)
  {
    appLogger.info("RouteManager.deleteRoute.enter");
    
    var routeKey = "/lbaas/" + appIdRef + "_" + routeName;
    var portKey = "/lbaas/ports/" + appIdRef + "_" + routeName;
	var healthKey = "/lbaas/health/" + appIdRef + "_" + routeName;
	var swarmKey = "/swarm/docker/containers/" + appIdRef + "_" + routeName;
	
	// Delete the swarmkey and ignore any errors.  It may or may not have been added so errors are common.
	etcd.del(swarmKey, { recursive: true });
    
    // delete the keys from etcd
    etcd.del(routeKey, { recursive: true }, function (err) 
    {
        if (err && err.errorCode == 100) 
        {
        	// In the case of an error, try to delete the other keys anyway.  
        	etcd.del(portKey, { recursive: true });
        	etcd.del(healthKey, { recursive: true });
        	
        	return callback(new RouteError(404, "The route is not presently configured in the load balancer"));
        }
        else if (err)
        {
        	// In the case of an error, try to delete the other keys anyway.
        	etcd.del(portKey, { recursive: true });
        	etcd.del(healthKey, { recursive: true });
        	
        	// Some other unexpected error
        	return callback(new RouteError(500, "ETCD delete key error. " + err.message));
        }
        else
        {
        	etcd.del(portKey, { recursive: true }, function (err) 
		    {
		        if (err && err.errorCode == 100) 
		        {
		        	// In the case of an error, try to delete the other keys anyway.
		        	etcd.del(healthKey, { recursive: true });
		        	
		        	return callback(new RouteError(404, "The route is not presently configured in the load balancer"));
		        }
		        else if (err)
		        {
		        	// In the case of an error, try to delete the other keys anyway.
		        	etcd.del(healthKey, { recursive: true });
		        	
		        	// Some other unexpected error
		        	return callback(new RouteError(500, "ETCD delete key error. " + err.message));
		        }
		        else
		        {
		        	etcd.del(healthKey, { recursive: true }, function (err) 
        		    {
        		        if (err && err.errorCode == 100) 
        		        {
        		        	return callback(new RouteError(404, "The route is not presently configured in the load balancer"));
        		        }
        		        else if (err)
        		        {
        		        	// Some other unexpected error
        		        	return callback(new RouteError(500, "ETCD delete key error. " + err.message));
        		        }
        		        else
        		        {
        		        	return callback(null);
        		        }
        		    });
		        }
		    });
        }
    });
    appLogger.info("RouteManager.deleteRoute.exit");
  }
  
  /**
   * Delete Backend Server 
   */
  this.deleteBackendServer = function(routeName, container_host, container_host_port, callback)
  {
    appLogger.info("RouteManager.deleteBackendServer.enter");
    
    var hostKey = "/lbaas/" + appIdRef + "_" + routeName + "/" + container_host + ":" + container_host_port;
   
    etcd.del(hostKey, { recursive: true }, function (err) 
    {
        // If the key is not found, then a container_id may have been passed in
    	if (err && err.errorCode == 100) 
        {
    		// Try to get the host IP and port from the swarm cluster
    	    var options =
    		{
    			host: 'swarmcluster',
    			path: '/containers/' + container_host + '/json',
    			port: '2377',
    			method: 'GET'
    		};

    		var request = http.request(options, function(response)	
    		{
    			var swarm_json_response_str = '';

    			//continue to retrieve date until done 
    			response.on('data', function(chunk) 
    			{
    				swarm_json_response_str += chunk;
    			});

    			//the whole response has been received, process the result
    			response.on('end', function () 
    			{
    				appLogger.info("Received SWARM API response: %s", swarm_json_response_str);

    				//convert the response to JSON object
    				try 
    				{
    					var swarm_json_response = JSON.parse(swarm_json_response_str);
    					var ports = swarm_json_response.NetworkSettings.Ports;
        				var tcp = container_host_port + "/tcp";

        				if (ports[tcp] == undefined)
        				{
        					return callback(new RouteError(409, "Error reteieving HostIp and HostPort from swarmcluster. " + tcp + " undefined."));
        				}
        				else
        				{
        					var hostKey = "/lbaas/" + appIdRef + "_" + routeName + "/" + ports[tcp][0].HostIp + ":" + ports[tcp][0].HostPort;
        					var swarmKey = "/swarm/docker/containers/" + appIdRef + "_" + routeName + "/" + ports[tcp][0].HostIp + ":" + ports[tcp][0].HostPort;
        					
        					// Do not need to worry about errors
        					etcd.del(hostKey, { recursive: true });
        					etcd.del(swarmKey, { recursive: true });	
        					
        					return callback(null);
        				}
    				}
    				catch (err)
    				{
    					// If it will not parse, then swarm_json_response_str is an error message
    					return callback(new RouteError(404, "The backend server is not presently configured in the load balancer. " + swarm_json_response_str));
    				}	
    			});
    		});

    		//request error handling
    		request.on('error', function(err) 
    		{
    			return callback(new RouteError(404, "The backend server is not presently configured in the load balancer. " + err.message));
    		});

    		request.end();
        }
    	else if (err)
        {	
        	// Some other unexpected error
        	return callback(new RouteError(500, "ETCD delete key error. " + err.message));
        }
    	else
    	{
    		return callback(null);
    	}
    });
    appLogger.info("RouteManager.deleteBackendServer.exit");
  }
  
  /**
   * Retrieve Route 
   */
  this.retrieveRoute = function(routeName, callback)
  {
    appLogger.info("RouteManager.retrieveRoute.enter");
    
    var routeKey = "/lbaas/" + appIdRef + "_" + routeName;
    var portKey = "/lbaas/ports/" + appIdRef + "_" + routeName;
	var healthKey = "/lbaas/health/" + appIdRef + "_" + routeName;
	var swarmKey = "/swarm/docker/containers/" + appIdRef + "_" + routeName;
	
	var fePort; 
	var feUriMatch;
	var beHealthUri; 
	var backends = [];
	
	etcd.get(healthKey, { recursive: true }, function (err, response) 
    {
        if (err && err.errorCode == 100) 
        {
        	return callback(new RouteError(404, "The route is not presently configured in the load balancer"));
        }
        else if (err)
        {
        	// Some other unexpected error
        	return callback(new RouteError(500, "ETCD get key error. " + err.message));
        }
        else
        {
        	beHealthUri = response.node.value;
        	
        	etcd.get(portKey, { recursive: true }, function (err, response) 
		    {
		        if (err && err.errorCode == 100) 
		        {
		        	return callback(new RouteError(404, "The route is not presently configured in the load balancer"));
		        }
		        else if (err)
		        {
		        	// Some other unexpected error
		        	return callback(new RouteError(500, "ETCD get key error. " + err.message));
		        }
		        else
		        {
		        	var portUriMatch = response.node.value.split(":");
		        	fePort = portUriMatch[0];
		        	feUriMatch = portUriMatch[1];
		        	// Change undefined to empty string. Do this so uriMatch appears in the route list.
		        	if (!feUriMatch)
		        	{
		        		feUriMatch = "";
		        	}
		        	
		        	etcd.get(routeKey, { recursive: true }, function (err, response) 
        		    {
        		        if (err && err.errorCode == 100) 
        		        {
        		        	return callback(new RouteError(404, "The route is not presently configured in the load balancer"));
        		        }
        		        else if (err)
        		        {
        		        	// Some other unexpected error
        		        	return callback(new RouteError(500, "ETCD get key error. " + err.message));
        		        }
        		        else
        		        {
        		        	var nodes = response.node.nodes;
        		  		    for (var index in nodes)
        		  		    {
        		  		    	var hostAndPort = nodes[index].value.split(":");
        		  		    	backends[index] = {};
        		  		    	backends[index].host = hostAndPort[0];
        		  		    	backends[index].hostPort = hostAndPort[1];
        		  		    	backends[index].backup = hostAndPort[2];
        		  		    }
        		  		    
        		  		    // Now check if there are swarm entries for this route in etcd.
        		        	// There may not be, and this is normal behavior
    		  		    	etcd.get(swarmKey, { recursive: true }, function (err, response) 
	  	        		    {
	  	        		        if (err && err.errorCode == 100) 
	  	        		        {
	  	        		        	appLogger.info("No swarm information for route: " + routeName);
	  	        		        	
	  	        		        	var retrieveRoute = {};
	  	        		  		    retrieveRoute.$schema = "/schemas/Route/v1.0";
	  	        		  		    retrieveRoute.Route = createRoute(routeName, fePort, feUriMatch, beHealthUri, backends);
	  	        			  
	  	        		  		    return callback(null, retrieveRoute);
	  	        		        }
	  	        		        else if (err)
	  	        		        {
	  	        		        	// Some other unexpected error
	  	        		        	return callback(new RouteError(500, "ETCD get key error. " + err.message));
	  	        		        }
	  	        		        else
	  	        		        {
	  	        		        	// Compare the swarm entries with the routes stored in backends
	  	        		        	var nodes = response.node.nodes;
	  	        		  		    for (var i in nodes)
	  	        		  		    {
	  	        		  		    	var swarmKeyIdAndPort = nodes[i].key.split("/");
	  	        		  		    	var hostAndPort = swarmKeyIdAndPort[swarmKeyIdAndPort.length - 1];
	  	        		  		    
		  	        		  		    for (var j in backends)
		  	        		  		    {
		  	        		  		    	if ((backends[j].host + ":" + backends[j].hostPort) == hostAndPort)
		  	        		  		    	{
			  	        		  		    	var idAndPort = nodes[i].value.split(":");		  	        		
				  	        		        	backends[j].containerId = idAndPort[0];
				  	        		        	backends[j].containerPort = idAndPort[1];
				  	        		        	break;
		  	        		  		    	}
		  	        		  		    }
	  	        		  		    }
	  	        		        	
	  	        		  		    var retrieveRoute = {};
	  	        		  		    retrieveRoute.$schema = "/schemas/Route/v1.0";
	  	        		  		    retrieveRoute.Route = createRoute(routeName, fePort, feUriMatch, beHealthUri, backends);
	  	        			  
	  	        		  		    return callback(null, retrieveRoute);
	  	        		        }
	  	        		    });
        		        }
        		    });	
		        }
		    });
        }
    });
	
    appLogger.info("RouteManager.retrieveRoute.exit");
  }
  
  /**
   * Retrieve Route 
   */
  this.retrieveRouteList = function(callback)
  {
    appLogger.info("RouteManager.retrieveRouteList.enter"); 
    
    var routeKey = "/lbaas/";
    var portKey = "/lbaas/ports/";
	var healthKey = "/lbaas/health/";
	var swarmKey = "/swarm/docker/containers/";
	
	
	var portUriMatchMap = {};
	var healthUriMap = {}; 
	var backendsMap = {};
	
	etcd.get(healthKey, { recursive: true }, function (err, response) 
    {
        if (err && err.errorCode == 100) 
        {
        	return callback(new RouteError(404, "The route is not presently configured in the load balancer"));
        }
        else if (err)
        {
        	// Some other unexpected error
        	return callback(new RouteError(500, "ETCD get key error. " + err.message));
        }
        else
        {
        	// Find the health keys that match the current route
        	var nodes = response.node.nodes;
  		    for (var i in nodes)
  		    {
  		    	var healthKeyAppAndRoute = nodes[i].key.split("/");
	  		    var appAndRoute = healthKeyAppAndRoute[healthKeyAppAndRoute.length - 1];
  		    	
	  		    // Must start with "{appIdRef}_"
	  		    if (appAndRoute.indexOf(appIdRef + "_") == 0)
	  		    {
	  		    	healthUriMap[appAndRoute] = nodes[i].value;
	  		    }	
  		    }
        	
        	etcd.get(portKey, { recursive: true }, function (err, response) 
		    {
		        if (err && err.errorCode == 100) 
		        {
		        	return callback(new RouteError(404, "The route is not presently configured in the load balancer"));
		        }
		        else if (err)
		        {
		        	// Some other unexpected error
		        	return callback(new RouteError(500, "ETCD get key error. " + err.message));
		        }
		        else
		        {
		        	// Find the port keys that match the current route
		        	var nodes = response.node.nodes;
		  		    for (var i in nodes)
		  		    {
		  		    	var portKeyAppAndRoute = nodes[i].key.split("/");
			  		    var appAndRoute = portKeyAppAndRoute[portKeyAppAndRoute.length - 1];
		  		    	
			  		    // Must start with "{appIdRef}_"
			  		    if (appAndRoute.indexOf(appIdRef + "_") == 0)
			  		    {
			  		    	portUriMatchMap[appAndRoute] = nodes[i].value;
			  		    }	
		  		    }
		        	
		        	etcd.get(routeKey, { recursive: true }, function (err, response) 
        		    {
        		        if (err && err.errorCode == 100) 
        		        {
        		        	return callback(new RouteError(404, "The route is not presently configured in the load balancer"));
        		        }
        		        else if (err)
        		        {
        		        	// Some other unexpected error
        		        	return callback(new RouteError(500, "ETCD get key error. " + err.message));
        		        }
        		        else
        		        {
        		        	// Find the backends that match the current route
        		        	var nodes = response.node.nodes;
        		  		    for (var i in nodes)
        		  		    {
        		  		    	var keyAppAndRoute = nodes[i].key.split("/");
        			  		    var appAndRoute = keyAppAndRoute[keyAppAndRoute.length - 1];
        		  		    	
        			  		    // Must start with "{appIdRef}_"
        			  		    if (appAndRoute.indexOf(appIdRef + "_") == 0)
        			  		    {
        			  		    	var backends = {};
                		        	var backendNodes = nodes[i].nodes;
                		  		    for (var j in backendNodes)
                		  		    {
                		  		    	var hostAndPort = backendNodes[j].value.split(":");
                		  		    	
                		  		    	backends[j] = {};
                		  		    	backends[j].host = hostAndPort[0];
                		  		    	backends[j].hostPort = hostAndPort[1];
                		  		    	backends[j].backup = hostAndPort[2];
                		  		    }
                		  		  backendsMap[appAndRoute] = backends;
        			  		    }	
        		  		    }     		        	
        		  		    
        		  		    // Now check if there are swarm entries for this route in etcd.
        		        	// There may not be, and this is normal behavior
    		  		    	etcd.get(swarmKey, { recursive: true }, function (err, response) 
	  	        		    {
	  	        		        if (err && err.errorCode == 100) 
	  	        		        {
	  	        		        	appLogger.info("No swarm information for route: " + routeName);
	  	        		        }
	  	        		        else if (err)
	  	        		        {
	  	        		        	// Some other unexpected error
	  	        		        	return callback(new RouteError(500, "ETCD get key error. " + err.message));
	  	        		        }
	  	        		        else
	  	        		        {
	  	        		        	// Find the swarms keys that match the current route
	  	        		        	var nodes = response.node.nodes;
	  	        		  		    for (var i in nodes)
	  	        		  		    {
	  	        		  		    	var keyAppAndRoute = nodes[i].key.split("/");
	  	        			  		    var appAndRoute = keyAppAndRoute[keyAppAndRoute.length - 1];
	  	        		  		    	
	  	        			  		    // Must start with "{appIdRef}_"
	  	        			  		    if (appAndRoute.indexOf(appIdRef + "_") == 0)
	  	        			  		    {
	  	        			  		    	var backends = backendsMap[appAndRoute];
	  	                		        	var backendNodes = nodes[i].nodes;
	  	                		        	
	  	                		        	for (var j in backends)
			  	        		  		    {
	  	                		        		for (var k in backendNodes)
				  	        		  		    {
	  	                		        			var swarmKeyIdAndPort = backendNodes[k].key.split("/");
	  	  	  	        		  		    		var hostAndPort = swarmKeyIdAndPort[swarmKeyIdAndPort.length - 1];
	  	                		        			
		  	                		        		if ((backends[j].host + ":" + backends[j].hostPort) == hostAndPort)
				  	        		  		    	{
					  	        		  		    	var idAndPort = backendNodes[k].value.split(":");		  	        		
						  	        		        	backends[j].containerId = idAndPort[0];
						  	        		        	backends[j].containerPort = idAndPort[1];
						  	        		        	backends[j].backup = idAndPort[2];
						  	        		        	break;
				  	        		  		    	}
				  	        		  		    }
			  	        		  		    }
	  	        			  		    }	
	  	        		  		    }
	  	        		        	
	  	        		        	// Now create the response object.
		  	        		  		var retrieveRouteList = {};
		  	        		  		retrieveRouteList.$schema = "/schemas/Route/v1.0";
		  	        		  		retrieveRouteList.RouteList = [];
		  	        		  		var i = 0;
	  	        		  		    
	  	        		  		    // Get the appId_routeName related information from the maps
	  	        		  		    for (var key in portUriMatchMap)
  	        		  		    	{
	  	        		  		    	var fePort = portUriMatchMap[key].split(":")[0];
	  	        		  		    	var uriMatch = portUriMatchMap[key].split(":")[1];
	  	        		  		    	// Change undefined to empty string. Do this so uriMatch appears in the route list.
	  	        		  		    	if (!uriMatch)
			  	      		        	{
	  	        		  		    		uriMatch = "";
			  	      		        	}
	  	        		  		    	var healthUri = healthUriMap[key];
	  	        		  		    	var backends = backendsMap[key];
	  	        		  		    	
	  	        		  		    	var routeName = key.substr(appIdRef.length + 1);
	  	        		  		    	retrieveRouteList.RouteList[i] = createRoute(routeName, fePort, uriMatch, healthUri, backends);	
	  	        		  		    	i++;
  	        		  		    	}
	  	        		  		    			  
	  	        		  		    return callback(null, retrieveRouteList);
	  	        		        }
	  	        		    });
        		        }
        		    });	
		        }
		    });
        }
    });
	
    appLogger.info("RouteManager.retrieveRouteList.exit");
  }
}
