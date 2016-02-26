# Pull base image
FROM arrs/arrs-cloud-base-centos6-6:2.0.0.1
MAINTAINER ARRIS

# Install HAProxy
RUN yum -y install haproxy

# Install rsyslog - used for HAProxy logging
RUN yum -y install rsyslog

# Add binaries, configuration files and scripts
ADD fs /
WORKDIR /

RUN chmod +x /usr/local/sbin/*; chmod +x /etc/confd/update_config.sh; chmod +x /start_confd.sh
# Expose amqp, management, rsyslog, kibana, kopf, ELK and stats ports
EXPOSE 514 5672 15672 443 444 9000 9500

# Container start command
CMD /start_confd.sh
