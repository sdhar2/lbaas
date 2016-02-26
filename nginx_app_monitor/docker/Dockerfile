
# Dockerfile to create a docker image for nginx-app-monitor 
#

# Pull base image
FROM arrs/arrs-cloud-base-nodejs:2.0.0.1
MAINTAINER ARRIS

# Add local files
ADD fs /

# Move perf_monitor specific nodejs files to a temp location
WORKDIR /opt
RUN mv perf_monitor perf_monitor_tmp

# Link the webservice NPM modules and skeleton
RUN ln -s /opt/webservice/ perf_monitor

# Add perf_monitor specific nodejs files
RUN cp perf_monitor_tmp/routes/*.js perf_monitor/routes
RUN rm -rf perf_monitor_tmp

# Add logs directory
WORKDIR /
RUN mkdir /opt/status_monitor/logs

# Add start scripts run permission
RUN chmod +x /start_perf_monitor.sh; chmod +x /start_status_monitor.sh; chmod +x /start_all.sh; chmod +x /opt/status_monitor/sendStatus.sh; chmod 755 /usr/local/bin/*
 
# Expose web service port
EXPOSE 7500

# Container start command
CMD /start_all.sh

