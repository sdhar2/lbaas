#!/bin/bash

sed -i "/^upstream /,/#end upstream/d" /etc/nginx/nginx.conf

#Returns list of services like cs/FM/SMS etc
services=`cat /tmp/nginx.conf | grep -oP '(?<=lbaas/).*?(?=/|$)' | cut -d" " -f1 | uniq`
rm -f /var/log/nginx/app_services.log.tmp
if [ -n "$services" ]
then
  sed -i '$d' /etc/nginx/nginx.conf   # remove final }, will put back after these changes
  for service in $services
  do
    if [ $service != "health" ] && [ $service != "ports" ]
    then
    # returns the value of service
    	app_services=`cat /tmp/nginx.conf | grep -oP '(?<=lbaas/'${service}'/).*?(?=}|$)' |cut -d" " -f2`
    	date=`date +"%Y-%m-%d %H:%M:%S %Z"`
    	echo "$date DEBUG: updateConfig: found configurations for $service"
		# Get the external server port and uri_prefix
        ext_server_info=`cat /tmp/nginx.conf | grep -oP '(?<=lbaas/ports/'${service}' ).*?(?=}|$)' |cut -d":" -f1`
        ext_server_port=`echo ${ext_server_info}":" | cut -d ":" -f1`
        ext_server_uri_prefix=`echo ${ext_server_info}":" | cut -d ":" -f2`

        if [ -n "$ext_server_port" ]
		then    	
	    	echo "upstream $service { "  >> /etc/nginx/nginx.conf
	    	echo "zone upstream_$service 64k;  " >> /etc/nginx/nginx.conf
	    	echo "keepalive 500; "  >> /etc/nginx/nginx.conf

            for app_service in $app_services
            do
                backend_server=`echo ${app_service} | cut -d ":" -f1,2`
                backend_backup=`echo ${app_service} | cut -d ":" -f3`
                if [ -n "$backend_backup" ]
                then
                       echo "server $backend_server $backend_backup; " >> /etc/nginx/nginx.conf
                else
                       echo "server $backend_server; " >> /etc/nginx/nginx.conf
                fi
				echo "$backend_server" >> /var/log/nginx/app_services.log.tmp
	    	done
	    	echo "    } " >> /etc/nginx/nginx.conf
	    	echo " " >> /etc/nginx/nginx.conf
	    	echo "    server {"  >> /etc/nginx/nginx.conf
	    	echo "    listen       $ext_server_port; "  >> /etc/nginx/nginx.conf
	    	echo "    server_name  server_$ext_server_port; " >> /etc/nginx/nginx.conf
	    	echo " " >> /etc/nginx/nginx.conf
	    	if [ -n "$ext_server_uri_prefix" ]
            then
            	echo "      location $ext_server_uri_prefix { " >> /etc/nginx/nginx.conf
            else
            	echo "      location / { " >> /etc/nginx/nginx.conf
            fi
	    	echo "      proxy_pass http://$service; "  >> /etc/nginx/nginx.conf
	    	echo "      proxy_http_version 1.1; " >> /etc/nginx/nginx.conf
	    	echo "      proxy_set_header Connection \"\";"  >> /etc/nginx/nginx.conf
	    	
	    	health_uri=`cat /tmp/nginx.conf | grep -oP '(?<=lbaas/health/'${service}' ).*?(?=}|$)' |cut -d":" -f1 | cut -f1 -d" "`
        	if [ -n "$health_uri" ]
			then
			    uri=`echo $health_uri  | sed 's/^[^\/]/\/&/'`
				echo "      health_check uri=$uri; " >> /etc/nginx/nginx.conf
			else
				echo "      health_check; " >> /etc/nginx/nginx.conf
			fi	
			
	    	echo "  } "  >> /etc/nginx/nginx.conf
	    	echo " } " >> /etc/nginx/nginx.conf
	    	echo "#end upstream $service" >>  /etc/nginx/nginx.conf
	    else
	    	echo "$date DEBUG: updateConfig: no external port found for $service"	
	    fi
	fi
  done
  echo "}" >> /etc/nginx/nginx.conf
  mv /var/log/nginx/app_services.log.tmp /var/log/nginx/app_services.log
else
  cat /dev/null > /var/log/nginx/app_services.log
fi

/usr/sbin/nginx -s reload > /var/log/nginx/reload.log 2>&1
./updatePorts.sh >> /tmp/confd.log
