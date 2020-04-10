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
            axios.get(this.url, {
                params: {
                    devices: 1
                }
            })
                .then((response) => {
                    let body = JSON.parse(response.data);
                    body.devices.forEach(function (data) {
                        if (data.productName.includes("RolloTron") || data.productName.includes("Troll Comfort")) {
                            let uuid = UUIDGen.generate(data.serial);
                            let accessory = self.accessories[uuid];

                            if (accessory === undefined) {
                                self.addAccessory(data);
                            } else {
                                self.log("Online: %s [%s]", accessory.displayName, data.serial);
                                self.accessories[uuid] = new RademacherBlindsAccessory(self.log, (accessory instanceof RademacherBlindsAccessory ? accessory.accessory : accessory), data, self.url, self.inverted);
                            }
                        }
                    });
                })
                .catch((error) => {
                    return new Error("Request failed: " + error);
                });
        }.bind(this));
    }
}

RademacherBlinds.prototype.configureAccessory = function (accessory) {
    this.accessories[accessory.UUID] = accessory;
};

RademacherBlinds.prototype.addAccessory = function (blind) {
    this.log("Found: %s - %s [%s]", blind.name, blind.description, blind.serial);

    let name = null;
    if (!blind.description.trim()) {
        name = blind.name;
    } else {
        name = blind.description;
    }

    let accessory = new Accessory(name, UUIDGen.generate(blind.serial));
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

function RademacherBlindsAccessory(log, accessory, blind, url, inverted) {
    let self = this;

    let info = accessory.getService(Service.AccessoryInformation);

    accessory.context.manufacturer = "Rademacher";
    info.setCharacteristic(Characteristic.Manufacturer, accessory.context.manufacturer.toString());

    accessory.context.model = blind.productName;
    info.setCharacteristic(Characteristic.Model, accessory.context.model.toString());

    accessory.context.serial = blind.serial;
    info.setCharacteristic(Characteristic.SerialNumber, accessory.context.serial.toString());

    this.inverted = inverted;
    this.accessory = accessory;
    this.blind = blind;
    this.log = log;
    this.url = url;
    this.lastPosition = this.inverted ? reversePercentage(this.blind.position) : this.blind.position;
    this.currentPositionState = 2;
    this.currentTargetPosition = 100;

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

    accessory.updateReachability(true);
}

RademacherBlindsAccessory.prototype.setTargetPosition = function (value, callback) {
    this.log("%s - Setting target position: %s", this.accessory.displayName, value);

    let self = this;
    this.currentTargetPosition = value;
    let moveUp = (this.currentTargetPosition >= this.lastPosition);
    this.service.setCharacteristic(Characteristic.PositionState, (moveUp ? 1 : 0));
    let target = self.inverted ? reversePercentage(value) : value;

    axios.post(this.url, {
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        params: {
            cid: 9,
            did: this.blind.did,
            command: 1,
            goto: target
        }
    })
        .then((request) => {
            if (request.status === 200) {
                self.service.setCharacteristic(Characteristic.CurrentPosition, self.currentTargetPosition);
                self.service.setCharacteristic(Characteristic.PositionState, 2);
                self.lastPosition = self.currentTargetPosition;
                callback(null, self.currentTargetPosition);
            }
        })
        .catch((error) => {
            return callback(new Error("Request failed: " + error), false);
        });
};

RademacherBlindsAccessory.prototype.getTargetPosition = function (callback) {
    this.log("%s - Getting target position", this.accessory.displayName);

    let self = this;
    let serial = this.blind.serial;

    axios.get(this.url, {
        params: {
            devices: 1
        }
    })
        .then((request) => {
            let body = JSON.parse(request.data);
            body.devices.forEach(function (data) {
                if (data.serial === serial) {
                    let pos = self.inverted ? reversePercentage(data.position) : data.position;
                    self.currentTargetPosition = pos;
                    callback(null, pos);
                }
            });
        })
        .catch((error) => {
            return callback(new Error("Request failed: " + error), false);
        });
};

RademacherBlindsAccessory.prototype.getCurrentPosition = function (callback) {
    this.log("%s - Getting current position", this.accessory.displayName);

    let self = this;
    let serial = this.blind.serial;

    axios.get(this.url, {
        params: {
            devices: 1
        }
    })
        .then((request) => {
            let body = JSON.parse(request.data);
            body.devices.forEach(function (data) {
                if (data.serial === serial) {
                    let pos = self.inverted ? reversePercentage(data.position) : data.position;
                    callback(null, pos);
                }
            });
        })
        .catch((error) => {
            return callback(new Error("Request failed: " + error), false);
        });
};

RademacherBlindsAccessory.prototype.getPositionState = function (callback) {
    callback(null, this.currentPositionState);
};

function reversePercentage(p) {
    let min = 0;
    let max = 100;
    return (min + max) - p;
}