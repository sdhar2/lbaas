#!/bin/bash
####################################################################################
#Copyright 2014 ARRIS Enterprises, Inc. All rights reserved.
#This program is confidential and proprietary to ARRIS Enterprises, Inc. (ARRIS),
#and may not be copied, reproduced, modified, disclosed to others, published or used,
#in whole or in part, without the express prior written permission of ARRIS.
####################################################################################

DOCKER_VERSION=1.2.0.16
DOCKER_REPO="dockerrepo:5000"
DOCKER_IMAGE="arrs/arrs-cloud-base-nginx-app-monitor"
CONTAINER_NAME="arrs-app-monitor-nginx"
DOCKERRUN_LOGFILE=/var/log/run_docker.log
LISTEN_PORT=7504

timestamp() {
  date --rfc-3339=seconds
}

cleanContainer() {
  containerId=`docker ps | grep "$1" | awk '{ print $1}'`

  if [[ ! -z $containerId ]]; then
    echo "$(timestamp) - containerId for \"$1\"=$containerId is running, stopping and removing it" >> "$2"
    docker stop $containerId
    docker rm $containerId
  else
    containerId=`docker ps -a | grep "$1" | awk '{ print $1}'`

    if [[ ! -z $containerId ]]; then
      echo "$(timestamp) - containerId for \"$1\"=$containerId is not running but needs to be removed, removing it" >> "$2"
      docker rm $containerId
    fi
  fi
}

echo "$(timestamp) - Start nginx_app_monitor_run_docker.sh =================" >> $DOCKERRUN_LOGFILE

cleanContainer $DOCKER_IMAGE $DOCKERRUN_LOGFILE

# Pull the docker image
docker pull $DOCKER_REPO/$DOCKER_IMAGE:$DOCKER_VERSION

setFirewall=0
iptables -L INPUT -n | grep "tcp dpt:$LISTEN_PORT"
if [[ $? -ne 0 ]]; then
  iptables -I INPUT -p tcp --dport $LISTEN_PORT -j ACCEPT
  setFirewall=1
fi

if [[ $setFirewall -eq 1 ]]; then
  service iptables save >> /dev/null
  echo "$(timestamp) - Setting up firewall to open web service port $LISTEN_PORT" >> $DOCKERRUN_LOGFILE
fi

HOST_IP=$(ip -f inet add list dev eth0 | grep brd|cut -f1 -d"/" | awk '{print $2}' | head -1)
HOST_NAME=$(hostname)
echo "$(timestamp) - Retrieved Host IP: ${HOST_IP}" >> $DOCKERRUN_LOGFILE
echo "$(timestamp) - Retrieved Host name: ${HOST_NAME}" >> $DOCKERRUN_LOGFILE

#update mount permissions due to --selinux bug
mkdir /var/log/app_monitor/nginx >/dev/null 2>&1
chmod 777 /var/log/app_monitor/nginx >/dev/null 2>&1
chcon -Rt svirt_sandbox_file_t /var/log/app_monitor/nginx  > /dev/null 2>&1
mkdir /var/opt/app-monitor-nginx/perf_monitor/logs >/dev/null 2>&1
chmod 777 /var/opt/app-monitor-nginx/perf_monitor/logs >/dev/null 2>&1
chcon -Rt svirt_sandbox_file_t /var/opt/app-monitor-nginx/perf_monitor/logs  > /dev/null 2>&1
mkdir /var/opt/app-monitor-nginx/status_monitor/logs >/dev/null 2>&1
chmod 777 /var/opt/app-monitor-nginx/status_monitor/logs >/dev/null 2>&1
chcon -Rt svirt_sandbox_file_t /var/opt/app-monitor-nginx/status_monitor/logs  > /dev/null 2>&1


docker run -d --name $CONTAINER_NAME \
-p $LISTEN_PORT:$LISTEN_PORT \
-e LISTEN_PORT=$LISTEN_PORT \
-e APP_OBSERVER_PORT=8477 \
-e STATUS_INTERVAL=$STATUS_INTERVAL \
-e HOST_IP=${HOST_IP} \
-v /usr/sbin:/usr/local/sbin \
-v /var/opt/app-monitor-nginx/perf_monitor/logs:/opt/perf_monitor/logs \
-v /var/opt/app-monitor-nginx/status_monitor/logs:/opt/status_monitor/logs \
-v /var/log/app_monitor/nginx:/tmp \
-t $DOCKER_REPO/$DOCKER_IMAGE:$DOCKER_VERSION

echo "$(timestamp) - nginx_app_monitor in Docker container started." >> $DOCKERRUN_LOGFILE
sleep 10

/usr/sbin/nginx_status_checker.sh &
echo "$(timestamp) - nginx status checker started." >> $DOCKERRUN_LOGFILE
