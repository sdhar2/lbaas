####################################################################################
#Copyright 2014 ARRIS Enterprises, Inc. All rights reserved.
#This program is confidential and proprietary to ARRIS Enterprises, Inc. (ARRIS),
#and may not be copied, reproduced, modified, disclosed to others, published or used,
#in whole or in part, without the express prior written permission of ARRIS.
####################################################################################

# A docker image that includes
#
# - confd
# - etcdctl
# - nginx+

# Use base cmcentos
FROM arrs/arrs-cloud-base-centos6-6:2.0.0.1
MAINTAINER ARRIS

# Install Nginx-plus
RUN yum install -y nginx-plus

# Add binaries, configuration files and scripts
ADD fs /
WORKDIR /
RUN chmod +x /usr/local/bin/*; chmod +x /etc/confd/*.sh; chmod +x /startConfd.sh; chmod +x /updateJsonFile.sh; chmod +x /usr/sbin/checkHealth.sh; chmod +x /updatePorts.sh;

# ADD SSL support for nginx
ADD ssl.zip /tmp/
RUN unzip /tmp/ssl.zip; mv /ssl/ /etc/nginx/; rm /tmp/ssl.zip

CMD /startConfd.sh
