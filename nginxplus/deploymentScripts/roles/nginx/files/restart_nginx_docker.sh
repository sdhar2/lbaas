#!/bin/bash
####################################################################################
#Copyright 2015 ARRIS Enterprises, Inc. All rights reserved.
#This program is confidential and proprietary to ARRIS Enterprises, Inc. (ARRIS),
#and may not be copied, reproduced, modified, disclosed to others, published or used,
#in whole or in part, without the express prior written permission of ARRIS.
####################################################################################

CHECK_ETCDCTL_KEY_WATCH_LOG_FILE="/var/log/check_etcd_keywatch.log"
prefix=`date +"%G-%m-%d %H:%M:%S etcd status"`
VIP=`host lbaas | cut -d" " -f4`
HOST_NAME=`uname -n`
status_port="9500"

peer=`host etcdCluster | cut -d " " -f4`:4001
PEER_HOST=`etcdctl --no-sync -peers  ${peer} ls --recursive /config/advisor/ | cut -d "/" -f4 | grep -i LOADBALANCER | grep -i -v ${HOST_NAME}`

if [ `ip a | grep $VIP | wc -l` -gt 0 ]
then
        echo ${prefix} "My host $HOST_NAME is controlling the VIP, restart now">> $CHECK_ETCDCTL_KEY_WATCH_LOG_FILE
        /usr/sbin/nginxConfig.sh
else
        sleep 3
        while [ `wget -v -t1 -T5 -O /dev/null "http://${PEER_HOST}:${status_port}" 2>&1 | grep "200 OK" | wc -l`  -gt 0 ]
        do
        	sleep 3
            echo ${prefix} "My host $HOST_NAME is not controlling the VIP, peer host ${PEER_HOST} is not up yet">> $CHECK_ETCDCTL_KEY_WATCH_LOG_FILE
            timeout 120
        done

        echo ${prefix} "My host $HOST_NAME is not controlling the VIP, peer host ${PEER_HOST} is up now, restart">> $CHECK_ETCDCTL_KEY_WATCH_LOG_FILE
        /usr/sbin/nginxConfig.sh
fi
