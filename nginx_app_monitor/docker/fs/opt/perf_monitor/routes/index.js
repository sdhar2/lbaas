/**
 * Main body of Express to handle routes
 */

var express = require('express');
var router = express.Router();
var app_logger = require('../utils/app_logger');
var http = require('http');

//define parameters for HTTP request to Nginx status API
var options =
{
  host: process.argv[3],
  path: '/status',
  port: '9500',
  method: 'GET'
};

/* globals for cache results */
var request_current_time = 0;
var upstream_current_time = 0;
var total_requests_cache = 0;
var upstream_data_cache = {};
var is_request_data_first_poll = true;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/* app-observer performance poll REST APIs */
/* named queries */
router.get('/observer-app/named_query/ConnectionData',
  function(req, res, next)
  {
    app_logger.info("Performance monitor received named_query request: ConnectionData. Request details: source IP=%s, web server hostname=%s, protocol=%s", req.ip, req.hostname, req.protocol);

    //send HTTP request to Nginx status API, with callback function
    var request = http.request(options, 
      function(response)
      {
        var nginx_json_response_str = '';

        //continue to retrieve date until done 
        response.on('data', 
          function(chunk) 
          {
            nginx_json_response_str += chunk;
          }
        );

        //the whole response has been recieved, process the result
        response.on('end', 
          function () 
          {
            app_logger.info("Received Nginx API response: %s", nginx_json_response_str);

            //convert the response to JSON object
            var nginx_json_response = JSON.parse(nginx_json_response_str);
  
            //create and assign values to the JSON object to respond to app-observer 
            var monitor_json_response = {};
            monitor_json_response.ConnectionData = [];

            var connection_data = { name : "", value: null };
            var conn_value = { ConnectionsActive: 0 };

            connection_data.name = "ConnectionStatistics";
            conn_value.ConnectionsActive = nginx_json_response.connections.active;
            connection_data.value = conn_value; 

            monitor_json_response.ConnectionData.push(connection_data);

            app_logger.info("Sending JSON response to app-observer: %s", JSON.stringify(monitor_json_response)); 

            res.set('Content-Type', 'application/json');
            res.send(JSON.stringify(monitor_json_response));
          }
        );
      } //end HTTP request callback function def
    ); //end send HTTP request

    //request error handling
    request.on('error', 
      function(e) 
      {
        app_logger.error("Error when sending HTTP request to Nginx status API. " + e.message);
        res.status(500).send('Server Internal Error - Nginx status API is down');
      }
    );

    request.end();
  } //end router middleware function 
);

router.get('/observer-app/named_query/RequestData',
  function(req, res, next)
  {
    var new_current_time = new Date().getTime();
    var time_diff = (new_current_time - request_current_time ) / 1000;

    app_logger.info("Performance monitor received named_query request: RequestData. Request details: source IP=%s, web server hostname=%s, protocol=%s", req.ip, req.hostname, req.protocol);

    //send HTTP request to Nginx status API, with callback function
    var request = http.request(options, 
      function(response)
      {
        var nginx_json_response_str = '';

        //continue to retrieve date until done 
        response.on('data', 
          function(chunk) 
          {
            nginx_json_response_str += chunk;
          }
        );

        //the whole response has been recieved, process the result
        response.on('end', 
          function () 
          {
            app_logger.info("Received Nginx API response: %s", nginx_json_response_str);

            //convert the response to JSON object
            var nginx_json_response = JSON.parse(nginx_json_response_str);
  
            //create and assign values to the JSON object to respond to app-observer 
            var monitor_json_response = {};
            monitor_json_response.RequestData = [];

            var request_data = { name : "", value: null };
            var request_value = { RequestsPerSecond : 0.00 };

            request_data.name = "RequestStatistics";

            if (is_request_data_first_poll)
            {
              is_request_data_first_poll = false;
              request_data.value = request_value;
            }
            else
            {
              //derive the request rate based on cached data
              var requests_per_intval = nginx_json_response.requests.total - total_requests_cache;
              request_value.RequestsPerSecond = Number((requests_per_intval / time_diff).toFixed(2));
              request_data.value = request_value; 
            }

            monitor_json_response.RequestData.push(request_data);

            app_logger.info("Sending JSON response to app-observer: %s", JSON.stringify(monitor_json_response)); 

            res.set('Content-Type', 'application/json');
            res.send(JSON.stringify(monitor_json_response));

            //reset cache
            total_requests_cache = nginx_json_response.requests.total;
            request_current_time = new_current_time;
          }
        );
      } //end HTTP request callback function def
    ); //end send HTTP request

    //request error handling
    request.on('error', 
      function(e) 
      {
        app_logger.error("Error when sending HTTP request to Nginx status API. " + e.message);
        res.status(500).send('Server Internal Error - Nginx status API is down');
      }
    );

    request.end();
  } //end router middleware function 
);

router.get('/observer-app/named_query/UpstreamData',
  function(req, res, next)
  {
    var new_current_time = new Date().getTime();
    var time_diff = (new_current_time - upstream_current_time ) / 1000;

    app_logger.info("Performance monitor received named_query request: UpstreamData. Request details: source IP=%s, web server hostname=%s, protocol=%s", req.ip, req.hostname, req.protocol);

    //send HTTP request to Nginx status API, with callback function
    var request = http.request(options, 
      function(response)
      {
        var nginx_json_response_str = '';

        //continue to retrieve date until done 
        response.on('data', 
          function(chunk) 
          {
            nginx_json_response_str += chunk;
          }
        );

        //the whole response has been recieved, process the result
        response.on('end', 
          function () 
          {
            app_logger.info("Received Nginx API response: %s", nginx_json_response_str);

            //convert the response to JSON object
            var nginx_json_response = JSON.parse(nginx_json_response_str);
  
            //create and assign values to the JSON object to respond to app-observer 
            var monitor_json_response = {};
            monitor_json_response.UpstreamData = [];

            for (var nginx_key in nginx_json_response.upstreams)
            {
               if (nginx_json_response.upstreams.hasOwnProperty(nginx_key))
               {
                  var upstream_data = { Type: nginx_key, UpstreamServerData: [] };

                  var nginx_upstream_value = nginx_json_response.upstreams[nginx_key];
                  
                  for (var i = 0; i < nginx_upstream_value.length; i ++)
                  {
                    var upstream_server_data = { Server : "",
                                           RequestsPerSecond : 0.00,
                                           Responses1xxPerSecond : 0.00,
                                           Responses2xxPerSecond : 0.00,
                                           Responses3xxPerSecond : 0.00,
                                           Responses4xxPerSecond : 0.00,
                                           Responses5xxPerSecond : 0.00,
                                           FailCount : 0,
                                           UnavailableCount : 0 
                                         };

                    upstream_server_data.Server = nginx_upstream_value[i].server;

                    //if the stats have been cached for the upstream and server
                    if ((nginx_key + "," + nginx_upstream_value[i].server) in upstream_data_cache)
                    {
                      //derive the rates and counts based on cached data
                      //first find the cache entry based on upstream type and server as the key
                      var upstream_value_cache = upstream_data_cache[ nginx_key + "," + nginx_upstream_value[i].server ];

                      if (!upstream_value_cache) 
                      {
                        continue;
                      }
                      
                      //next derive the rate and interval amount
                      var upstream_requests_per_intval = nginx_upstream_value[i].requests - upstream_value_cache.upstream_requests;
                      upstream_server_data.RequestsPerSecond = Number((upstream_requests_per_intval / time_diff).toFixed(2)); 

                      var upstream_1xxresponse_per_intval = nginx_upstream_value[i].responses["1xx"] - upstream_value_cache.upstream_1xxResponses;
                      upstream_server_data.Responses1xxPerSecond = Number((upstream_1xxresponse_per_intval / time_diff).toFixed(2));

                      var upstream_2xxresponse_per_intval = nginx_upstream_value[i].responses["2xx"] - upstream_value_cache.upstream_2xxResponses;
                      upstream_server_data.Responses2xxPerSecond = Number((upstream_2xxresponse_per_intval / time_diff).toFixed(2));

                      var upstream_3xxresponse_per_intval = nginx_upstream_value[i].responses["3xx"] - upstream_value_cache.upstream_3xxResponses;
                      upstream_server_data.Responses3xxPerSecond = Number((upstream_3xxresponse_per_intval / time_diff).toFixed(2));

                      var upstream_4xxresponse_per_intval = nginx_upstream_value[i].responses["4xx"] - upstream_value_cache.upstream_4xxResponses;
                      upstream_server_data.Responses4xxPerSecond = Number((upstream_4xxresponse_per_intval / time_diff).toFixed(2));

                      var upstream_5xxresponse_per_intval = nginx_upstream_value[i].responses["5xx"] - upstream_value_cache.upstream_5xxResponses;
                      upstream_server_data.Responses5xxPerSecond = Number((upstream_5xxresponse_per_intval / time_diff).toFixed(2));
                      upstream_server_data.FailCount = nginx_upstream_value[i].fails - upstream_value_cache.upstream_fail;
                      upstream_server_data.UnavailableCount = nginx_upstream_value[i].unavail - upstream_value_cache.upstream_unavailable;

                      //reset cache
                      upstream_value_cache.upstream_requests = nginx_upstream_value[i].requests;
                      upstream_value_cache.upstream_1xxResponses = nginx_upstream_value[i].responses["1xx"];
                      upstream_value_cache.upstream_2xxResponses = nginx_upstream_value[i].responses["2xx"];
                      upstream_value_cache.upstream_3xxResponses = nginx_upstream_value[i].responses["3xx"];
                      upstream_value_cache.upstream_4xxResponses = nginx_upstream_value[i].responses["4xx"];
                      upstream_value_cache.upstream_5xxResponses = nginx_upstream_value[i].responses["5xx"];
                      upstream_value_cache.upstream_fail = nginx_upstream_value[i].fails;
                      upstream_value_cache.upstream_unavailable = nginx_upstream_value[i].unavail;
                    } //end of cache exists
                    else 
                    { 
                      //cache does not exist, use default values as result, and allocate cache to store the stats 
                      //assign dynamic cache to store stats, using a hashmap
                      var upstream_value_cache = { upstream_requests : nginx_upstream_value[i].requests,
                                                   upstream_1xxResponses : nginx_upstream_value[i].responses["1xx"],
                                                   upstream_2xxResponses : nginx_upstream_value[i].responses["2xx"],
                                                   upstream_3xxResponses : nginx_upstream_value[i].responses["3xx"],
                                                   upstream_4xxResponses : nginx_upstream_value[i].responses["4xx"],
                                                   upstream_5xxResponses : nginx_upstream_value[i].responses["5xx"],
                                                   upstream_fail : nginx_upstream_value[i].fails,
                                                   upstream_unavailable : nginx_upstream_value[i].unavail
                                                 };
     
                      upstream_data_cache[ nginx_key + "," + nginx_upstream_value[i].server ] = upstream_value_cache;
                    }  

                    upstream_data.UpstreamServerData.push(upstream_server_data); 

                  } //end for each server

                  monitor_json_response.UpstreamData.push(upstream_data);

               } //end checking if key exists
            } //end for each upstream

            app_logger.info("Sending JSON response to app-observer: %s", JSON.stringify(monitor_json_response)); 

            res.set('Content-Type', 'application/json');
            res.send(JSON.stringify(monitor_json_response));

            upstream_current_time = new_current_time;
          }
        );
      } //end HTTP request callback function def
    ); //end send HTTP request

    //request error handling
    request.on('error', 
      function(e) 
      {
        app_logger.error("Error when sending HTTP request to Nginx status API. " + e.message);
        res.status(500).send('Server Internal Error - Nginx status API is down');
      }
    );

    request.end();
  } //end router middleware function 
);

/* detailed report */
router.get('/observer-app/detailed_report',
  function(req, res, next)
  {
    app_logger.info("Performance monitor received detailed_report request. Request details: source IP=%s, web server hostname=%s, protocol=%s", req.ip, req.hostname, req.protocol);

    res.json(
    {
      "DetailedReport":
      [
        {
          "name": "ConnectionStatistics",
          "value":
          {
            "ConnectionsPerSecond": 7.3333,
            "ConnectionsAccepted": 500000
          }
        }
      ]
    });

  }
);

/* synchronize */
router.post('/observer-app/synchronize',
  function(req, res, next)
  {
    app_logger.info("Performance monitor received synchronize request. Request details: source IP=%s, web server hostname=%s, protocol=%s", req.ip, req.hostname, req.protocol);

    res.json(
    {
      "Object1":
      [
        {
          "name": "Metrics1",
          "value": { /* hierarchical JSON data for the metrics */ }
        },
        {
          "name": "Metrics2",
          "value": { /* hierarchical JSON data for the metrics */ }
        }
      ],
      "Object2": [
        {
          "name": "Metrics1",
          "value": { /* hierarchical JSON data for the metrics */ }
        },
        {
          "name": "Metrics2",
          "value": { /* hierarchical JSON data for the metrics */ }
        }
      ]
    });

  }
);

module.exports = router;
