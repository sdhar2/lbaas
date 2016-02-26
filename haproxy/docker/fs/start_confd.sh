#!/bin/bash

CONFD_LOGFILE="/var/log/haproxy/confd.log"

timestamp() {
  date --rfc-3339=seconds 
}

etcd_vip=`host etcdCluster | cut -d " " -f4`
echo "$(timestamp) - ETCD VIP is: $etcd_vip" >> $CONFD_LOGFILE
ETCD=$etcd_vip:4001

cp /etcd/config/*.json /opt/etcd/config/

echo "$(timestamp) - initiating one time update." >> $CONFD_LOGFILE
# Loop until confd has updated the config
until confd -onetime -node $ETCD -config-file /etc/confd/conf.d/haproxy.toml; do
    echo "$(timestamp) - one time update, waiting for confd to refresh haproxy.cfg." >> $CONFD_LOGFILE 
    sleep 5
done

echo "$(timestamp) - completed one time update." >> $CONFD_LOGFILE

# Run confd in the background to watch the back server nodes
confd -interval 10 -node $ETCD -config-file /etc/confd/conf.d/haproxy.toml >> $CONFD_LOGFILE

echo "$(timestamp) - confd is listening for changes on etcd..." >> $CONFD_LOGFILE
