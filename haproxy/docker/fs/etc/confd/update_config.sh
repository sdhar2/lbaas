#!/bin/bash

# consts
HAPROXY_EXEC="/usr/sbin/haproxy"
HAPROXY_PIDFILE="/var/run/haproxy.pid"
HAPROXY_CONFIGFILE="/etc/haproxy/haproxy.cfg"

RSYSLOGD_EXEC="/sbin/rsyslogd"

CONFD_LOGFILE="/var/log/haproxy/confd.log"

SERVER_DEF_PATTERN="server"
SERVER_CHECK_PATTERN="check inter 5000 rise 2 fall 3"
BACKEND_SERVERS_PATTERN="BACKEND_SERVERS"

MAAS_LOG_ID="maas"
LAAS_LOG_ID="laas"

CONF_FILE="haproxy.cfg"
COMMON_CONF_FILE="haproxy_tmpl_common.cfg"
MAAS_CONF_FILE="haproxy_tmpl_maas.cfg"
LAAS_CONF_FILE="haproxy_tmpl_laas.cfg"

#functions
timestamp() {
  date --rfc-3339=seconds
}

createBackendConfig() {

  backendServers=("${!2}")
  backendPorts=`grep "$BACKEND_SERVERS_PATTERN" haproxy.cfg | sed "s/$BACKEND_SERVERS_PATTERN://"`

  serverLine=""
  serverNum=1

  for server in ${backendServers[@]}; do

     echo "$(timestamp) - HAProxy \"$1\" backend server: ${server} detected" >> $CONFD_LOGFILE

     for port in $backendPorts; do

        serverLine="$SERVER_DEF_PATTERN $server $server:$port $SERVER_CHECK_PATTERN"

        echo "$(timestamp) - serveline=$serverLine" >> $CONFD_LOGFILE

        sed -i "/$BACKEND_SERVERS_PATTERN:$port/i\    $serverLine" haproxy.cfg

     done
     serverNum=$((serverNum+1))
  done

  sed -i "/$BACKEND_SERVERS_PATTERN/d" haproxy.cfg
}

echo "$(timestamp) - confd detected configuration changes in etcd, performing updates for HAProxy." >> $CONFD_LOGFILE 
maasBackendServersDetected="false"
laasBackendServersDetected="false"

# Redo the haproxy.cfg common section first
cd /etc/haproxy/

if [[ -f $CONF_FILE ]]; then
  rm -rf $CONF_FILE
fi

cp $COMMON_CONF_FILE $CONF_FILE

# Get maas backend servers from confd destination file /etc/confd/haproxy.conf
maasBackendServers=`cat /etc/confd/haproxy.conf | grep -oP '(?<=maas/rabbitmq/).*?(?=}|$)' | cut -d" " -f2`

if [[ -n "$maasBackendServers" ]]; then
  echo " " >> $CONF_FILE
  cat $MAAS_CONF_FILE >> $CONF_FILE 
  createBackendConfig $MAAS_LOG_ID maasBackendServers[@] 
  maasBackendServerDetected="true"
fi

laasBackendServers=`cat /etc/confd/haproxy.conf | grep -oP '(?<=laas/elk/elk).*?(?=}|$)' | cut -d" " -f2`

if [[ -n "$laasBackendServers" ]]; then
  echo " " >> $CONF_FILE
  cat $LAAS_CONF_FILE >> $CONF_FILE
  createBackendConfig $LAAS_LOG_ID laasBackendServers[@]
  laasBackendServerDetected="true"
fi

if [[ $maasBackendServerDetected = "true" ]] || [[ $laasBackendServerDetected = "true" ]]; then

# Reload haproxy
  echo "$(timestamp) - HAProxy configuration file updated, reloading HAProxy" >> $CONFD_LOGFILE 

  if [[ -f $HAPROXY_PIDFILE ]]; then
    $HAPROXY_EXEC -f $HAPROXY_CONFIGFILE -p $HAPROXY_PIDFILE -sf $(cat $HAPROXY_PIDFILE)
  else 
    $HAPROXY_EXEC -f $HAPROXY_CONFIGFILE -p $HAPROXY_PIDFILE
  fi

  if [[ $? -eq 0 ]]; then
    echo "$(timestamp) - HAProxy reloading completed successfully" >> $CONFD_LOGFILE 
  else
    echo "$(timestamp) - HAProxy reloading failed" >> $CONFD_LOGFILE 
  fi

# Run rsyslogd if not running
  ps -ef | grep rsyslogd | grep -v grep

  if [[ $? -ne 0 ]]; then
    echo "$(timestamp) - rsyslogd not running yet, start it" >> $CONFD_LOGFILE
    $RSYSLOGD_EXEC -c5 

    if [[ $? -eq 0 ]]; then
      echo "$(timestamp) - rsyslogd started successfully" >> $CONFD_LOGFILE 
    else
      echo "$(timestamp) - rsyslogd start failed" >> $CONFD_LOGFILE
    fi
  fi

else

  echo "$(timestamp) - No HAProxy backend servers detected" >> $CONFD_LOGFILE 

  if [[ -f $HAPROXY_PIDFILE ]]; then
    echo "$(timestamp) - HAProxy is running, shutting down" >> $CONFD_LOGFILE 
  
    . /etc/rc.d/init.d/functions

    procName=$(basename $HAPROXY_EXEC)
    killproc $procName  

    if [[ $? -eq 0 ]]; then
      echo "$(timestamp) - HAProxy shutdown successfully" >> $CONFD_LOGFILE 
    else
      echo "$(timestamp) - HAProxy shutdown failed" >> $CONFD_LOGFILE 
    fi
  else
   echo "$(timestamp) - HAProxy is not running, no change made" >> $CONFD_LOGFILE
  fi 

fi
