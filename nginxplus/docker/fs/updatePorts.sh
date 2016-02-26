#!/bin/bash

# For the backoffice integration, this code tries to add the /config/lbaas entry for the port if it does not previously exist

export ETCD=`host etcdCluster | cut -d " " -f4`:4001
services=`cat /tmp/nginx.conf | grep -oP '(?<=lbaas/).*?(?=/|$)' | cut -d" " -f1 | uniq`

if [ -n "$services" ]
then
  for service in $services
  do
     if [ $service != "health" ] && [ $service != "ports" ]
     then
        ext_server_info=`cat /tmp/nginx.conf | grep -oP '(?<=lbaas/ports/'${service}' ).*?(?=}|$)' |cut -d":" -f1`
        ext_server_port=`echo ${ext_server_info}":" | cut -d ":" -f1`

    	date=`date +"%Y-%m-%d %H:%M:%S %Z"`
    	
    	if [ -n "$ext_server_port" ]
		then
    		echo "$date DEBUG: updatePorts: found external port $ext_server_port for service $service."

    		etcdctl --no-sync -peers ${ETCD} get /config/lbaas/ports/$ext_server_port
    		status=$?
    		if [ $status != 0 ]
    		then
    		 	etcdctl --no-sync -peers ${ETCD} set /config/lbaas/ports/$ext_server_port $ext_server_port
    		fi
    	else
    		echo "$date DEBUG: updatePorts: no external port can be set for /config/lbaas/ports/$ext_server_port."
    	fi	
    fi	
  done
fi

