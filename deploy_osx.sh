#!/bin/bash

sudo hb-service stop
npm install -g .
sudo hb-service start
tail -f ~/.homebridge/homebridge.log | grep -i rademacher
