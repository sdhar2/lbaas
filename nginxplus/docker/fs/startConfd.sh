#!/bin/bash

logfile=/tmp/startConfd.log
export ETCD=`host etcdCluster | cut -d " " -f4`:4001

/usr/sbin/nginx &
sleep 5

etcdctl -no-sync -peers ${ETCD} mkdir /lbaas  2>&1 >> $logfile 
etcdctl -no-sync -peers ${ETCD} mkdir /config/lbaas 2>&1 >> $logfile 
etcdctl -no-sync -peers ${ETCD} mkdir /productGroups/lbaas 2>&1 >> $logfile 

cp /etcd/config/*.json /opt/etcd/config/

#first time through, just read everything using etcdctl
echo "`date` DEBUG: startConfd: reading all keys using etcdctl" >> $logfile 
/etc/confd/getAll.sh > /tmp/confd.log

# Loop until confd has updated the config
echo "`date` DEBUG: startConfd: going to issue confd onetime" >> $logfile 
until confd -onetime -node $ETCD -config-file /etc/confd/conf.d/nginx.toml; do
  status=$?
  echo "`date` DEBUG: startConfd: waiting for confd to refresh ngnix.conf on onetime, status = $status" >> $logfile 
  sleep 5
done
echo "`date` DEBUG: startConfd: after confd onetime" >> /tmp/nginx.log

# Run confd in the background to watch the nginx node
confd -interval 10 -node $ETCD -config-file /etc/confd/conf.d/nginx.toml  >> $logfile 
status=$?
echo "`date` DEBUG: startConfd: confd is listening for changes on etcd, status = $status..." >> $logfile 

