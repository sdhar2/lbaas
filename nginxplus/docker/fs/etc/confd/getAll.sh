#!/bin/bash

export ETCD=`host etcdcluster | cut -d" " -f4`:4001

date=`date +"%Y-%m-%d %H:%M:%S"`
logFile="/tmp/confd.log"
echo "$date DEBUG: getAll.sh: getting all values for lbaas from key-value store with etcdctl" >> $logFile
rm -f /tmp/nginx.conf
rm -f /var/log/nginx/app_services.log
rm -f /tmp/etcdctlList

etcdctl --no-sync -peers $ETCD ls /lbaas --recursive > /tmp/etcdctlList
IFS=" "
while read line
do
	stat=`etcdctl --no-sync -peers $ETCD get $line`
	if [ ${#stat} -gt 0 ]
	then
		echo "lbaas=[{$line $stat false }]" >> /tmp/nginx.conf
	fi
done < /tmp/etcdctlList

echo "$date DEBUG: getAll.sh: invoke updateConfig to update nginx.conf file" >> $logFile
sh /etc/confd/updateConfig.sh >> $logFile
