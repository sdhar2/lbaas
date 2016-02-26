#!/bin/bash

cp /usr/local/bin/nginx_status_checker.sh /usr/local/sbin

#start status monitoring
/opt/status_monitor/sendStatus.sh &

#start performance monitoring
/opt/node-v0.10.35-linux-x64/bin/node /opt/perf_monitor/bin/www $LISTEN_PORT ${HOST_IP}  &

/bin/bash
