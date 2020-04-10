const axios = require('axios').default;
let Accessory, Service, Characteristic, UUIDGen;

module.exports = (homebridge) => {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform("homebridge-rademacher-blinds", "RademacherBlinds", RademacherBlinds, true);
};

function RademacherBlinds(log, config, api) {
    // global vars
    this.log = log;

    let self = this;

    // configuration vars
    this.url = config["url"];
    this.accessories = [];
    this.inverted = config["inverted"];

    if (api) {
        this.api = api;

        this.api.on('didFinishLaunching', function () {
            let url = `${this.url}/v4/devices?devtype=Actuator`;
            axios.get(url)
                .then((response) => {
                    let body = response.data;
                    if (!body.devices) {
                        return new Error("No devices returned from Homepilot");
                    }

                    body.devices.forEach((data) => {
                        if (["27601565", "35000864", "14234511", "35000662", "36500172", "36500572_A", "16234511_A", "16234511_S", "45059071", "31500162", "23602075"].includes(data.deviceNumber)) {
                            let uuid = UUIDGen.generate(`${data.did}`);
                            let accessory = self.accessories[uuid];

                            if (accessory === undefined) {
                                self.addAccessory(data);
                            } else {
                                self.log("Online: %s [%s]", accessory.displayName, data.did);
                                self.accessories[uuid] = new RademacherBlindsAccessory(self.log, (accessory instanceof RademacherBlindsAccessory ? accessory.accessory : accessory), data, self.url, self.inverted);
                            }
                        }
                    });
                })
                .catch((error) => {
                    self.log('error' + error);
                    return new Error("Request failed: " + error);
                });
        }.bind(this));
    }
}

RademacherBlinds.prototype.configureAccessory = function (accessory) {
    this.accessories[accessory.UUID] = accessory;
};

RademacherBlinds.prototype.addAccessory = function (blind) {
    this.log("Found: %s - %s [%s]", blind.name, blind.description, blind.did);

    let name;
    if (!blind.description.trim()) {
        name = blind.name;
    } else {
        name = blind.description;
    }

    let accessory = new Accessory(name, UUIDGen.generate(`${blind.did}`));
    accessory.addService(Service.WindowCovering, name);

    this.accessories[accessory.UUID] = new RademacherBlindsAccessory(this.log, accessory, blind, this.url, this.inverted);

    this.api.registerPlatformAccessories("homebridge-rademacher-blinds", "RademacherBlinds", [accessory]);
};

RademacherBlinds.prototype.removeAccessory = function (accessory) {
    if (accessory) {
        this.log("[" + accessory.description + "] Removed from HomeBridge.");
        if (this.accessories[accessory.UUID]) {
            delete this.accessories[accessory.UUID];
        }
        this.api.unregisterPlatformAccessories("homebridge-rademacher-blinds", "RademacherBlinds", [accessory]);
    }
};

// accessory

function RademacherBlindsAccessory(log, accessory, blind, url, inverted) {
    let self = this;

    let info = accessory.getService(Service.AccessoryInformation);

    accessory.context.manufacturer = "Rademacher";
    info.setCharacteristic(Characteristic.Manufacturer, accessory.context.manufacturer.toString());

    accessory.context.model = blind.deviceNumber;
    info.setCharacteristic(Characteristic.Model, accessory.context.model.toString());

    accessory.context.serial = blind.did;
    info.setCharacteristic(Characteristic.SerialNumber, accessory.context.serial.toString());

    this.inverted = inverted;
    this.accessory = accessory;
    this.blind = blind;
    this.log = log;
    this.url = url;

    let position = this.blind.statusesMap.position ? this.blind.statusesMap.position : 0;
    this.lastPosition = this.inverted ? reversePercentage(position) : position;
    this.currentPositionState = Characteristic.PositionState.STOPPED;
    this.currentTargetPosition = this.lastPosition;

    this.service = accessory.getService(Service.WindowCovering);

    this.service
        .getCharacteristic(Characteristic.CurrentPosition)
        .setValue(self.inverted ? reversePercentage(self.blind.position) : self.blind.position)
        .on('get', this.getCurrentPosition.bind(this));

    this.service
        .getCharacteristic(Characteristic.TargetPosition)
        .setValue(self.inverted ? reversePercentage(self.blind.position) : self.blind.position)
        .on('get', this.getTargetPosition.bind(this))
        .on('set', this.setTargetPosition.bind(this));

    this.service.getCharacteristic(Characteristic.PositionState)
        .setValue(this.currentPositionState)
        .on('get', this.getPositionState.bind(this));

    this.service.getCharacteristic(Characteristic.ObstructionDetected)
        .setValue(this.blind.hasErrors)
        .on('get', this.getObstructionDetected.bind(this));

    accessory.updateReachability(true);
}

RademacherBlindsAccessory.prototype.setTargetPosition = function (value, callback) {
    this.log("%s - Setting target position: %s", this.accessory.displayName, value);

    let self = this;
    this.currentTargetPosition = value;
    let moveUp = (this.currentTargetPosition >= this.lastPosition);
    this.service.setCharacteristic(Characteristic.PositionState,
        (moveUp ? Characteristic.PositionState.INCREASING : Characteristic.PositionState.DECREASING)
    );
    let target = self.inverted ? reversePercentage(value) : value;

    let data = {
        name: 'GOTO_POS_CMD',
        value: target
    };

    let url = `${this.url}/devices/${this.blind.did}`;
    axios.put(url, data, {
        headers: {'Content-Type': 'application/json'}
    })
        .then(() => {
            self.service.setCharacteristic(Characteristic.CurrentPosition, self.currentTargetPosition);
            self.service.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);
            self.lastPosition = self.currentTargetPosition;
            callback(null, self.currentTargetPosition);
        })
        .catch((error) => {
            return callback(new Error("Request failed: " + error), false);
        });
};

RademacherBlindsAccessory.prototype.getTargetPosition = function (callback) {
    this.log("%s - Getting target position", this.accessory.displayName);

    let self = this;

    let url = `${this.url}/v4/devices/${this.blind.did}`;
    axios.get(url)
        .then((request) => {
            let body = request.data;
            let position = body.device.statusesMap ? body.device.statusesMap.Position : null;

            if (position === null) {
                return callback(new Error("Failed parsing position in device output"), false);
            }

            let positionNormalized = self.inverted ? reversePercentage(position) : position;
            self.currentTargetPosition = positionNormalized;
            callback(null, positionNormalized);
        })
        .catch((error) => {
            return callback(new Error("Request failed: " + error), false);
        });
};

RademacherBlindsAccessory.prototype.getCurrentPosition = function (callback) {
    this.log("%s - Getting current position", this.accessory.displayName);

    let self = this;

    let url = `${this.url}/v4/devices/${this.blind.did}`;
    axios.get(url)
        .then((request) => {
            let body = request.data;
            let position = body.device.statusesMap ? body.device.statusesMap.Position : null;

            if (position === null) {
                return callback(new Error("Failed parsing position in device output"), false);
            }

            let positionNormalized = self.inverted ? reversePercentage(position) : position;
            self.currentTargetPosition = positionNormalized;
            self.lastPosition = positionNormalized;
            callback(null, positionNormalized);
        })
        .catch((error) => {
            return callback(new Error("Request failed: " + error), false);
        });
};

RademacherBlindsAccessory.prototype.getPositionState = function (callback) {
    callback(null, this.currentPositionState);
};

RademacherBlindsAccessory.prototype.getObstructionDetected = function (callback) {
    this.log("%s - Checking for ObstructionDetected", this.accessory.displayName);

    let url = `${this.url}/v4/devices/${this.blind.did}`;
    axios.get(url)
        .then((request) => {
            let body = request.data;

            let hasErrors = body.device.hasErrors !== 0;

            callback(null, hasErrors);
        })
        .catch((error) => {
            return callback(new Error("Request failed: " + error), false);
        });
};

function reversePercentage(p) {
    let min = 0;
    let max = 100;
    return (min + max) - p;
}