var tools = require("./tools.js");
var RademacherAccessory = require("./RademacherAccessory.js");

function RademacherThermostatAccessory(log, debug, accessory, thermostat, session) {
    RademacherAccessory.call(this, log, debug, accessory, thermostat, session);
    var self = this;

    this.thermostat = thermostat;
    
    this.currentTemperature = tools.duofernTemp2HomekitTemp(this.thermostat.statusesMap.acttemperatur);
    this.lastTemperature = this.currentTemperature;
    this.targetTemperature = tools.duofernTemp2HomekitTemp(this.thermostat.statusesMap.Position);

    this.fixedState = global.Characteristic.CurrentHeatingCoolingState.HEAT;

    this.service = this.accessory.getService(global.Service.Thermostat);

    this.service.getCharacteristic(global.Characteristic.CurrentHeatingCoolingState)
        .setValue(this.fixedState)
        .setProps({
            minValue: this.fixedState,
            maxValue: this.fixedState,
            minStep: 1,
            validValues: [this.fixedState],
          })
        .on('get', this.getCurrentHeatingCoolingState.bind(this));

    this.service.getCharacteristic(global.Characteristic.TargetHeatingCoolingState)
        .setValue(this.fixedState)
        .setProps({
            minValue: this.fixedState,
            maxValue: this.fixedState,
            minStep: 1,
            validValues: [this.fixedState],
          })
        .on('get', this.getTargetHeatingCoolingState.bind(this))
        .on('set', this.setTargetHeatingCoolingState.bind(this));

    this.service.getCharacteristic(global.Characteristic.CurrentTemperature)
        .setValue(this.currentTemperature)
        .setProps({
            minValue: 4,
            maxValue: 28,
            minStep: 0.5
          })
        .on('get', this.getCurrentTemperature.bind(this));

    this.service.getCharacteristic(global.Characteristic.TargetTemperature)
        .setValue(this.targetTemperature)
        .setProps({
            minValue: 4,
            maxValue: 28,
            minStep: 0.5
          })
        .on('get', this.getTargetTemperature.bind(this))
        .on('set', this.setTargetTemperature.bind(this));

    this.service.getCharacteristic(global.Characteristic.TemperatureDisplayUnits)
        .setValue(global.Characteristic.TemperatureDisplayUnits.CELSIUS)
        .on('get', this.getTemperatureDisplayUnits.bind(this));

    this.service.getCharacteristic(global.Characteristic.CurrentRelativeHumidity)
        .setValue(50)

    // TODO configure interval
    setInterval(this.update.bind(this), 10000);
}

RademacherThermostatAccessory.prototype = Object.create(RademacherAccessory.prototype);

RademacherThermostatAccessory.prototype.getCurrentHeatingCoolingState = function(callback) {
    if (this.debug) this.log("%s [%s] - getCurrentHeatingCoolingState(): state=%s", this.accessory.displayName, this.thermostat.did, this.fixedState);
    callback(null, this.fixedState);
};

RademacherThermostatAccessory.prototype.getCurrentTemperature = function(callback) {
    if (this.debug) this.log("%s [%s] - getCurrentTemperature()", this.accessory.displayName, this.thermostat.did);
    callback(null,this.currentTemperature);
    var self = this;
    this.getDevice(function(err, data) {
        if(err) 
        {
            self.log("%s [%s] - getCurrentTemperature(): error=%s", self.accessory.displayName, self.thermostat.did,err);
            return;
        }
        self.currentTemperature = tools.duofernTemp2HomekitTemp(data.statusesMap.acttemperatur);
        if (self.debug) self.log("%s [%s] - getCurrentTemperature(): current temperature is %d", self.accessory.displayName, self.thermostat.did,self.currentTemperature);
        self.service.getCharacteristic(global.Characteristic.CurrentTemperature).updateValue(self.currentTemperature)
    });
};

RademacherThermostatAccessory.prototype.getTargetTemperature = function(callback) {
    if (this.debug) this.log("%s [%s] - getTargetTemperature()", this.accessory.displayName, this.thermostat.did);
    callback(null,this.targetTemperature);
    var self = this;
    this.getDevice(function(err, data) {
        if(err) 
        {
            self.log("%s [%s] - getTargetTemperature(): error=%s", self.accessory.displayName, self.thermostat.did,err);
            return;
        }
        self.targetTemperature=tools.duofernTemp2HomekitTemp(data.statusesMap.Position);
        if (self.debug) self.log("%s [%s] - getTargetTemperature(): target temperature is %d", self.accessory.displayName, self.thermostat.did, self.targetTemperature);
        self.service.getCharacteristic(global.Characteristic.TargetTemperature).updateValue(self.targetTemperature)
    });
};

RademacherThermostatAccessory.prototype.setTargetTemperature = function(temperature, callback, context) {
    if (this.debug) this.log("%s [%s] - setTargetTemperature(%d)", this.accessory.displayName, this.thermostat.did, temperature);
    callback(null);
    var self = this;
    var params = {name: "TARGET_TEMPERATURE_CFG", value: temperature};
    this.session.put("/devices/"+this.thermostat.did, params, 30000, function(err) {
        if(err) 
        {
            self.log("%s [%s] - setTargetTemperature(): error=%s", self.accessory.displayName, self.thermostat.did,err);
            return;
        }
        self.targetTemperature=temperature;
        self.service.getCharacteristic(global.Characteristic.TargetTemperature).updateValue(self.targetTemperature)
    });
};

RademacherThermostatAccessory.prototype.getTargetHeatingCoolingState = function(callback) {
    if (this.debug) this.log("%s [%s] - getTargetHeatingCoolingState()", this.accessory.displayName,this.thermostat.did);
    return callback(null, this.fixedState);
};

RademacherThermostatAccessory.prototype.setTargetHeatingCoolingState = function(state, callback, context) {
    if (this.debug) this.log("%s [%s] - setTargetHeatingCoolingState(%s) (ignored)", this.accessory.displayName,this.thermostat.did,state);
    return callback(null);
};

RademacherThermostatAccessory.prototype.update = function() {
    if (this.debug) this.log(`%s [%s] - update()`, this.accessory.displayName, this.thermostat.did);
    var self = this;

    // Thermostat
    this.getCurrentTemperature(function(err, temp) {
        if (err)
        {
            self.log(`%s [%s] - update().getCurrentTemperature(): error=%s`, this.accessory.displayName, this.thermostat.did, err);
        }
        else if(temp===null)
        {
            self.log(`%s [%s] - update().getCurrentTemperature(): got null temp`, this.accessory.displayName, this.thermostat.did);
        }
        else
        {
            if (self.debug) self.log(`%s [%s] - update().getCurrentTemperature(): temp=%s`, this.accessory.displayName, this.thermostat.did, temp);
        }
    }.bind(this));

    this.getTargetTemperature(function(err, temp) {
        if (err)
        {
            self.log(`%s [%s] - update().getTargetTemperature(): error=%s`, this.accessory.displayName, this.thermostat.did, err);
        }
        else if(temp===null)
        {
            self.log(`%s [%s] - pdate().getTargetTemperature(): got null target temp`, this.accessory.displayName, this.thermostat.did);
        }
        else
        {
            if (self.debug) self.log(`%s [%s] - update().getTargetTemperature(): temp=%s`, this.accessory.displayName, this.thermostat.did, temp);
        }
    }.bind(this));

};

RademacherThermostatAccessory.prototype.getTemperatureDisplayUnits = function(callback) {
    callback(null, global.Characteristic.TemperatureDisplayUnits.CELSIUS);
};

RademacherThermostatAccessory.prototype.getServices = function() {
    return [this.service];
};

module.exports = RademacherThermostatAccessory;
