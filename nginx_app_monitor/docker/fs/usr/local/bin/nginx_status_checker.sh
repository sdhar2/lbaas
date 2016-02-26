#!/bin/bash  
####################################################################################
#Copyright 2015 ARRIS Enterprises, Inc. All rights reserved.
#This program is confidential and proprietary to ARRIS Enterprises, Inc. (ARRIS),
#and may not be copied, reproduced, modified, disclosed to others, published or used,
#in whole or in part, without the express prior written permission of ARRIS.
####################################################################################
VIP=`host lbaas | cut -d" " -f4`

while :
do
	if [ -d /var/log/app_monitor/nginx ]; then
	    rm -f /var/log/app_monitor/nginx/master.log
		rm -f /var/log/app_monitor/nginx/backup.log
		rm -f /var/log/app_monitor/nginx/appDown.log
		rm -f /var/log/app_monitor/nginx/confdDown.log
		rm -f /var/log/app_monitor/nginx/lsfDown.log	
		rm -f /var/log/app_monitor/nginx/portsNotSet.log		
		rm -f /var/log/app_monitor/nginx/ipsNotSet.log		
		rm -f /var/log/app_monitor/nginx/status.log
		
		ping -c1 lbaas 2>&1 >/dev/null
		status=$?
		if [ $status -eq 0 ]
		then		
			if [ `ip a | grep $VIP | wc -l` -gt 0 ]
			then
				echo "This nginx VM does control the VIP"  >> /var/log/app_monitor/nginx/status.log
				touch /var/log/app_monitor/nginx/master.log
				rm -f /var/log/app_monitor/nginx/backup.log
			else
				echo "This nginx VM does not control the VIP"  >> /var/log/app_monitor/nginx/status.log
				touch /var/log/app_monitor/nginx/backup.log
				rm -f /var/log/app_monitor/nginx/master.log
			fi
		else
			echo "Cannot reach the VIP" >> /var/log/app_monitor/nginx/status.log
			touch /var/log/app_monitor/nginx/backup.log
			rm -f /var/log/app_monitor/nginx/master.log		
		fi
	
		result=`docker ps | grep -v grep | grep nginxplus | wc -l`

		if [ "$result" -eq "0" ] ; then
		   	echo "This nginx application is not running" >> /var/log/app_monitor/nginx/status.log
			touch /var/log/app_monitor/nginx/appDown.log
		fi
		result=`ps -ef |grep confd | grep nginx | grep -v grep | wc -l`
		if [ "$result" -lt "2" ] ; then
		   	echo "This confd application is not running" >> /var/log/app_monitor/nginx/status.log
			touch /var/log/app_monitor/nginx/confdDown.log
		fi
		result=`ps -ef |grep lsf | grep -v grep | wc -l`
		if [ "$result" -eq "0" ] ; then
	 	  	echo "This logstash forwarder application is not running" >> /var/log/app_monitor/nginx/status.log
			touch /var/log/app_monitor/nginx/lsfDown.log
		fi	
		
		peer=`host etcdCluster | cut -d " " -f4`:4001
		PORTS_TO_ROUTE=`etcdctl --no-sync -peers  ${peer} ls --recursive /config/lbaas/ | cut -d "/" -f4 | cut -f2 -d:`
		if [ -n "$PORTS_TO_ROUTE" ]; then   
		   	for port in $PORTS_TO_ROUTE; do
		        running=`docker ps |grep 'cloud-base-nginxplus:' | grep $port | wc -l`
				if [ "${running}" == "0" ]
				then	
					echo "Failed to open port $port on nginx" >> /var/log/app_monitor/nginx/status.log
					touch /var/log/app_monitor/nginx/portsNotSet.log
				fi	
		 	done
		fi

		APPS=`etcdctl --no-sync -peers  ${peer} ls --recursive /lbaas/`
		if [ -n "$APPS" ]; then   
		   	for app in $APPS; do
		   		service=`echo $app | cut -d"/" -f3`
		   		if [ $service != "health" ] && [ $service != "ports" ]
		   		then
		   			etcdctl --no-sync -peers ${peer} get /lbaas/ports/$service >/dev/null 2>&1
    				status=$?
    				if [ $status != 0 ]
    				then
       					 echo "No external port is defined for the service $service" >> /var/log/app_monitor/nginx/status.log
		   			else
		        		value=`etcdctl --no-sync -peers  ${peer} get $app 2>&1 | grep -v "is a directory"`
		        		lineOut=`etcdctl --no-sync -peers  ${peer} get $app 2>&1 | grep -v "is a directory" | wc -l`
		        		if [ "${lineOut}" != "0" ]
		        		then
		        			lineOut=`sudo cat /var/log/nginx/app_services.log | grep $value | wc -l`
							if [ "${lineOut}" == "0" ]
							then	
								echo "Failed to find mapped ip address $value on nginx configuration file" >> /var/log/app_monitor/nginx/status.log
								touch /var/log/app_monitor/nginx/ipsNotSet.log
							fi
						fi	
					fi	
				fi
		 	done
		fi	
    fi
    sleep 60
done