#!/bin/bash

service homebridge stop
npm install -g .
service homebridge start
tail -f /var/log/syslog | grep homebridge
