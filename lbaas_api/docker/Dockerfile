####################################################################################
#Copyright 2015 ARRIS Enterprises, Inc. All rights reserved.
#This program is confidential and proprietary to ARRIS Enterprises, Inc. (ARRIS),
#and may not be copied, reproduced, modified, disclosed to others, published or used,
#in whole or in part, without the express prior written permission of ARRIS.
####################################################################################

# Docker build specification for lbaas_api 

# Pull base image
FROM arrs/arrs-cloud-base-nodejs7-1:1.0.0.1
MAINTAINER ARRIS

# Install nodejs modules
WORKDIR /opt/webservice/
RUN npm install async 
RUN npm install node-etcd

#Install exec-sync and pg modules which cannot be installed via npm due to lack of g++
RUN wget -q -P /opt/webservice/node_modules http://areopagus/binaries/npm-exec-sync-0.1.6.tar.gz && cd /opt/webservice/node_modules && tar zxf npm-exec-sync-0.1.6.tar.gz && rm -rf npm-exec-sync-0.1.6.tar.gz

# Add local files
ADD fs /

# Move lbaas_api specific nodejs files to a temp location
WORKDIR /opt
RUN mv main main_tmp
RUN mv modules modules_tmp

# Link the webservice NPM modules and skeleton
RUN ln -s /opt/webservice/ lbaas_api 

# Add lbaas_api specific nodejs files
RUN cp main_tmp/*.js lbaas_api/routes
RUN rm -rf main_tmp
RUN mkdir -p lbaas_api/modules
RUN cp modules_tmp/*.js lbaas_api/modules
RUN rm -rf modules_tmp 

# Add start scripts run permission
RUN chmod +x /start_lbaas_api.sh; 

# Run start lbaas_api
CMD /start_lbaas_api.sh
