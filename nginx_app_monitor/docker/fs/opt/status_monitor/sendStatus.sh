#!/bin/bash  
####################################################################################
#Copyright 2015 ARRIS Enterprises, Inc. All rights reserved.
#This program is confidential and proprietary to ARRIS Enterprises, Inc. (ARRIS),
#and may not be copied, reproduced, modified, disclosed to others, published or used,
#in whole or in part, without the express prior written permission of ARRIS.
####################################################################################
LOGFILE=/opt/status_monitor/logs/status.log
LOGFILE_OLD=/opt/status_monitor/logs/status.log.backup

mv $LOGFILE $LOGFILE_OLD

peer=`host etcdCluster | cut -d " " -f4`:4001

if [ -z "$STATUS_INTERVAL" ]
then
STATUS_INTERVAL=60
fi

while :
do
    if [ -f "/tmp/master.log" ]; then
		statusNameString="Active Load Balancer"
    fi
    if [ -f "/tmp/backup.log" ]; then
		statusNameString="Standby Load Balancer"
    fi
    
    prefix=`date +"%G-%m-%d %H:%M:%S app monitor status"`
    echo ${prefix} "$statusNameString" >> $LOGFILE

	appStatusString="The nginx application is up and running"
	appSeverityString="INFORMATIONAL"
	
	if [ -f "/tmp/appDown.log" ]; then
		appStatusString="The nginx docker container is down"
		appSeverityString="ERROR"
    elif [ -f "/tmp/confdDown.log" ]; then
		appStatusString="The confd utility is down"
		appSeverityString="ERROR"
    elif [ -f "/tmp/lsfDown.log" ]; then
		appStatusString="The logstash forwarder utility is down"
		appSeverityString="WARNING"
    fi	    	
	echo ${prefix} "$appStatusString" >> $LOGFILE
	
	VIP=`host lbaas | cut -d" " -f4`
	ping -c1 lbaas 2>&1 >/dev/null
	vipStatus=$?
	if [ $vipStatus -eq 0 ]
	then
		viplbaasStatusString="VIP named lbaas at $VIP is reachable"
		viplbaasSeverityString="INFORMATIONAL"
	else
		viplbaasStatusString="VIP named lbaas at $VIP is not reachable"
		viplbaasSeverityString="ERROR"
	fi
	echo ${prefix} "$viplbaasStatusString" >> $LOGFILE
		
	VIP=`host lbaas-ext | cut -d" " -f4`
	ping -c1 lbaas-ext 2>&1 >/dev/null
	vipStatus=$?
	if [ $vipStatus -eq 0 ]
	then
		viplbaasextStatusString="VIP lbaas-ext at $VIP is reachable"
		viplbaasextSeverityString="INFORMATIONAL"
	else
		viplbaasextStatusString="VIP lbaas-ext at $VIP is not reachable"
		viplbaasextSeverityString="ERROR"
	fi
	echo ${prefix} "$vipelkextStatusString" >> $LOGFILE
	
	VIP=`host lbaas-client | cut -d" " -f4`
	ping -c1 lbaas-client 2>&1 >/dev/null
	vipStatus=$?
	if [ $vipStatus -eq 0 ]
	then
		viplbaasclientStatusString="VIP lbaas-client at $VIP is reachable"
		viplbaasclientSeverityString="INFORMATIONAL"
	else
		viplbaasclientStatusString="VIP lbaas-client at $VIP is not reachable"
		viplbaasclientSeverityString="ERROR"
	fi
	echo ${prefix} "$viplbaasclientStatusString" >> $LOGFILE				
	
	PEER_HOSTS=`/usr/local/bin/etcdctl --no-sync -peers  ${peer} ls --recursive /config/advisor/ | cut -d "/" -f4 | grep -i LOADBALANCER | grep -i -v ${HOST_NAME}`

	peerScalarItems=""
	memberNotReachable=0
	if [ -n "$PEER_HOSTS" ]; then   
	   	# open up the new port 
	   	for PEER_HOST_NAME in $PEER_HOSTS; do
	        PEER_IP=`/usr/local/bin/etcdctl --no-sync -peers  ${peer} get /config/advisor/$PEER_HOST_NAME | cut -d":" -f1`

			ping -c1 $PEER_IP 2>&1 >/dev/null
			status=$?
			if [ $status -eq 0 ]
			then
				echo ${prefix} "Can reach $PEER_HOST_NAME $PEER_IP"  >> $LOGFILE
				peerStatusString="$PEER_HOST_NAME at $PEER_IP is reachable"
				peerSeverityString="INFORMATIONAL"		
			else
				echo ${prefix} "Cannot reach $PEER_HOST_NAME $PEER_IP" >> $LOGFILE
				peerStatusString="$PEER_HOST_NAME at $PEER_IP is not reachable"
				peerSeverityString="WARNING"		
				memberNotReachable=$((memberNotReachable+1))
			fi
			echo ${prefix} "$peerStatusString" >> $LOGFILE

	        scalarItem="<scalarItem id=\"$HOST_NAME.Connectivity.PeerStatus.$PEER_HOST_NAME\" summary=\"$PEER_HOST_NAME\" detail=\"$peerStatusString\" severity=\"$peerSeverityString\"/>"
			peerScalarItems="$peerScalarItems $scalarItem"	
	 	done
	fi
	
	if [ "$viplbaasSeverityString" != "INFORMATIONAL" ]; then
		clusterStatusString=$viplbaasStatusString
    	clusterSeverityString=$viplbaasSeverityString
    elif [ "$viplbaasextSeverityString" != "INFORMATIONAL" ]; then
		clusterStatusString=$viplbaasextStatusString
    	clusterSeverityString=$viplbaasextSeverityString   	
    elif [ "$viplbaasclientSeverityString" != "INFORMATIONAL" ]; then
		clusterStatusString=$viplbaasclientStatusString
    	clusterSeverityString=$viplbaasclientSeverityString  
    elif [ -f "/tmp/portNotFound.log" ]; then
		clusterStatusString="Failed to set ports in loadbalancer cluster."
		clusterSeverityString="ERROR"	
    elif [ -f "/tmp/ipsNotSet.log" ]; then
		clusterStatusString="nginx.conf file has not reloaded all the registered IP addresses."
		clusterSeverityString="ERROR"	
	elif [ $memberNotReachable -ne 0 ]; then
		clusterStatusString="Expected nginx loadbalancer backups are impaired or unavailable."
    	clusterSeverityString="WARNING"
    else
		clusterStatusString="The nginx loadbalancer cluster is formed and running properly."
		clusterSeverityString="INFORMATIONAL"
	fi

	echo ${prefix} "$clusterStatusString" >> $LOGFILE		    
	
	curl -k -i -v  -X PUT -d "<statusItems>   
	<scalarItems>
	  <scalarItem id=\"$HOST_NAME.Cluster\" summary=\"Cluster Health\" detail=\"$clusterStatusString\" severity=\"$clusterSeverityString\"/>
	  <scalarItem id=\"$HOST_NAME.HostStatus.AppStatus\" summary=\"Application\" detail=\"$appStatusString\" severity=\"$appSeverityString\"/>
	  <scalarItem id=\"$HOST_NAME.Connectivity.VipStatus.VipLbaas\" summary=\"lbaas\" detail=\"$viplbaasStatusString\" severity=\"$viplbaasSeverityString\"/>
	  <scalarItem id=\"$HOST_NAME.Connectivity.VipStatus.VipLbaasExt\" summary=\"lbaas-ext\" detail=\"$viplbaasextStatusString\" severity=\"$viplbaasextSeverityString\"/>
	  <scalarItem id=\"$HOST_NAME.Connectivity.VipStatus.VipLbaasClient\" summary=\"lbaas-client\" detail=\"$viplbaasclientStatusString\" severity=\"$viplbaasclientSeverityString\"/>
	  $peerScalarItems
	</scalarItems>
	<compositeItems>
	  <compositeItem id=\"$HOST_NAME.HostStatus\" summary=\"$statusNameString\"/>
	  <compositeItem id=\"$HOST_NAME.Connectivity\" summary=\"Communication\"/>  
	  <compositeItem id=\"$HOST_NAME.Connectivity.VipStatus\" summary=\"VIP\"/>   
	  <compositeItem id=\"$HOST_NAME.Connectivity.PeerStatus\" summary=\"Peer\"/>
	</compositeItems>
	</statusItems>" http://${HOST_IP}:$APP_OBSERVER_PORT/app-observer/status_items

	echo ${prefix} "sleeping $STATUS_INTERVAL" >> $LOGFILE
	sleep $STATUS_INTERVAL;
done