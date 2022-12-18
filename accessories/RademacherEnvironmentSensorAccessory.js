var tools = require("./tools.js");
var RademacherAccessory = require("./RademacherAccessory.js");

function RademacherEnvironmentSensorAccessory(log, debug, accessory, sensor, session, inverted) {
	RademacherAccessory.call(this, log, debug, accessory, sensor, session, inverted);
    this.sensor = sensor;
    this.services = [this.service];
    // temperature sensor
    this.currentTemperature=sensor.readings.temperature_primary;
    var temperatureService = this.accessory.getService(global.Service.TemperatureSensor);
    temperatureService.getCharacteristic(global.Characteristic.CurrentTemperature)
		.setProps({minValue: -30.0, maxValue: 80.0})
        .setValue(this.currentTemperature)
		.on('get', this.getCurrentTemperature.bind(this));
    this.services.push(temperatureService);    
    // light sensor
    this.currentAmbientLightLevel=sensor.readings.sun_brightness;
    var lightService = this.accessory.getService(global.Service.LightSensor);
    lightService.getCharacteristic(global.Characteristic.CurrentAmbientLightLevel)
		.setProps({minValue: 0, maxValue: 150000})
        .setValue(this.currentAmbientLightLevel)
		.on('get', this.getCurrentAmbientLightLevel.bind(this));
    this.services.push(lightService);
     // Rain sensor
    this.currentRainState=this.sensor.readings.rain_detected;
    var rainsensorService = this.accessory.getService(global.Service.LeakSensor);
    rainsensorService.getCharacteristic(global.Characteristic.LeakDetected)
        .setValue(this.currentRainState)
        .on('get', this.getCurrentRainState.bind(this));
    this.services.push(rainsensorService);
    

    // TODO configure interval
    setInterval(this.update.bind(this), 10000);
}

RademacherEnvironmentSensorAccessory.prototype = Object.create(RademacherAccessory.prototype);

RademacherEnvironmentSensorAccessory.prototype.getCurrentTemperature = function (callback) {
    if (this.debug) this.log("%s [%s] - getCurrentTemperature()", this.accessory.displayName, this.sensor.did);
    callback(null, this.currentTemperature);
    var self = this;
    this.session.get("/v4/devices?devtype=Sensor", 30000, function(err, body) {
        if(err) 
        {
            self.log("%s [%s] - getCurrentTemperature(): error=%s", self.accessory.displayName, self.sensor.did,err);
            return;
        }
        body.meters.forEach(function(data) {
            if(data.did == self.sensor.did)
            {
                self.currentTemperature=data.readings.temperature_primary;
                if (self.debug) self.log("%s [%s] - getCurrentTemperature(): temperature=%s", self.accessory.displayName, self.sensor.did, self.currentTemperature);
                var temperatureService = self.accessory.getService(global.Service.TemperatureSensor);
                temperatureService.getCharacteristic(global.Characteristic.CurrentTemperature).updateValue(self.currentTemperature)
            }
        });
    });
};

RademacherEnvironmentSensorAccessory.prototype.getCurrentRainState = function (callback) {
    if (this.debug) this.log("%s [%s] - getCurrentRainState()", this.accessory.displayName, this.sensor.did);
    callback(null, this.currentRainState);
    var self = this;
    this.session.get("/v4/devices?devtype=Sensor", 30000, function(err, body) {
        if(err) 
        {
            self.log("%s [%s] - getCurrentRainState(): error=%s", self.accessory.displayName, self.sensor.did,err);
            return;
        }
        body.meters.forEach(function(data) {
            if(data.did == self.sensor.did)
            {
                self.currentRainState=data.readings.rain_detected
                if (self.debug) self.log("%s [%s] - getCurrentRainState(): rain_detected=%s", self.accessory.displayName, self.sensor.did, self.currentRainState);
                var rainsensorService = self.accessory.getService(global.Service.LeakSensor);
                rainsensorService.getCharacteristic(global.Characteristic.LeakDetected).updateValue(self.currentRainState);
            
            }
        });
    });
};


RademacherEnvironmentSensorAccessory.prototype.getCurrentAmbientLightLevel = function (callback) {
    if (this.debug) this.log("%s [%s] - getCurrentAmbientLightLevel()", this.accessory.displayName, this.sensor.did);
    callback(null,this.currentAmbientLightLevel);
    var self = this;
    this.session.get("/v4/devices?devtype=Sensor", 30000, function(err, body) {
        if(err) 
        {
            self.log("%s [%s] - getCurrentAmbientLightLevel(): error=%s", self.accessory.displayName, self.sensor.did,err);
            return;
        }
        body.meters.forEach(function(data) {
            if(data.did == self.sensor.did)
            {
                self.currentAmbientLightLevel=data.readings.sun_brightness;
                if (self.debug) self.log("%s [%s] - getCurrentAmbientLightLevel(): sun_brightness=%s", self.accessory.displayName, self.sensor.did, self.currentAmbientLightLevel);
                var lightService = self.accessory.getService(global.Service.LightSensor);
                lightService.getCharacteristic(global.Characteristic.CurrentAmbientLightLevel).updateValue(self.currentAmbientLightLevel);                        }
        });
    });
};

RademacherEnvironmentSensorAccessory.prototype.getServices = function () {
    return this.services;
};

RademacherEnvironmentSensorAccessory.prototype.update = function() {
    if (this.debug) this.log(`%s [%s] - update()`, this.accessory.displayName, this.sensor.did);
    var self = this;

    this.getCurrentTemperature(function(err, temperature) {
        if (err)
        {
            self.log(`%s [%s] - update().getCurrentTemperature(): error=%s`, self.accessory.displayName, self.sensor.did, err);
        }
        else if (temperature===null)
        {
            self.log(`%s [%s] - update().getCurrentTemperature(): got null temperature`, self.accessory.displayName, self.sensor.did);
        }
        else
        {
            if (self.debug) self.log(`%s [%s] - update().getCurrentTemperature(): temperature=%s`, self.accessory.displayName, self.sensor.did, temperature);
        }
    }.bind(this));

    this.getCurrentAmbientLightLevel(function(err, level) {
        if (err)
        {
            self.log(`%s [%s] - update().getCurrentAmbientLightLevel(): error=%s`, self.accessory.displayName, self.sensor.did, err);
        }
        else if (level===null)
        {
            self.log(`%s [%s] - update().getCurrentAmbientLightLevel(): got null level`, self.accessory.displayName, self.sensor.did);
        }
        else
        {
            if (self.debug) self.log(`%s [%s] - update().getCurrentAmbientLightLevel(): level=%s`, self.accessory.displayName, self.sensor.did, level);
        }
    }.bind(this));
    
    this.getCurrentRainState(function(err, rain_detected) {
        if (err)
        {
            self.log(`%s [%s] - update().getCurrentRainState(): error=%s`, self.accessory.displayName, self.sensor.did, err);
        }
        else if (rain_detected===null)
        {
            self.log(`%s [%s] - update().getCurrentRainState(): got null state`, self.accessory.displayName, self.sensor.did);
        }
        else
        {
            if (self.debug) self.log(`%s [%s] - update().getCurrentRainState(): state=%s`, self.accessory.displayName, self.sensor.did, rain_detected);
        }
    }.bind(this));
    

};

module.exports = RademacherEnvironmentSensorAccessory;