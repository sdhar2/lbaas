#!/bin/bash
# Copyright ARRIS INC  March - 2015
# This needs to be run on the node where the key/value data is to be persisted from.

# Note:
#/usr/sbin/etcdctl -v

peer=`host etcdCluster | cut -d " " -f4`:4001

keys=$(etcdctl --no-sync -peers  ${peer} ls --recursive /config/lbaas/ports )

# always open port 9500.  If port 9500 isn't open in the firewall, open it.

portStuff="${newLine}  - \"9500:9500\" "
if [ `/sbin/iptables-save | grep INPUT | grep "dport 9500 -j" | wc -l` -eq 0 ]; then
  iptables -I INPUT -p tcp --dport 9500 -j ACCEPT
fi
newLine="\n"

# for each key found, save the port in the compose file and open the outbound port in the firewall 
# if it's not already open

for key in ${keys// / };
do
  port=$(etcdctl --no-sync -peers  ${peer} get ${key})
  portStuff=${portStuff}"${newLine}  - \"${port}:${port}\" "
  if [ `/sbin/iptables-save | grep INPUT | grep "dport ${port} -j" | wc -l` -eq 0 ]; then
    iptables -I INPUT -p tcp --dport ${port} -j ACCEPT
  fi
done
service iptables save > /dev/null 2>/dev/null
configDir="/arris/compose/"
configTmpl="nginx-compose.yml.template"
configTmp="nginx-compose.yml.tmp"
config="nginx-compose.yml"

docker-compose -f ${configDir}${config} stop
cat ${configDir}${configTmpl} | sed s/"PORT_MACRO"/"${portStuff}"/ >> ${configDir}${configTmp}
mv ${configDir}${configTmp} ${configDir}${config}
docker-compose -f ${configDir}${config} up -d

