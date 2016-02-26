#!/bin/bash
ETCD_HOST=$1
if [ -z "${ETCD_HOST}" ]
then
  ETCD_HOST=`host etcdCluster | cut -d " " -f4`:4001
fi

rm -f /tmp/nginxconfig.conf

echo "`date` [nginx-config] starting up confd" > /var/log/nginxconfd.log
# Loop until confd has updated the nginx config
until confd -onetime -node ${ETCD_HOST} -config-file /etc/confd/conf.d/nginxconfig.toml; do
  echo "`date` [nginx-config] waiting for confd to start" >> /var/log/nginxconfd.log
  sleep 5
done

# Run confd in the background to watch the /config/lbaas keys
confd -interval 10 -node ${ETCD_HOST} -config-file /etc/confd/conf.d/nginxconfig.toml  >> /var/log/nginxconfd.log &
echo "`date` [nginx-config] confd is listening for changes on etcd on /config/lbaas keys..." >> /var/log/nginxconfd.log

/bin/bash
