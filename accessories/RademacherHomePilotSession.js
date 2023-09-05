const crypto = require('crypto');
const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');

function sha256hex(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}
function RademacherHomePilotSession(log, debug, url, password, password_hashed) {
    this.log = log;
    this.debug = debug;
    this.url = url;
    this.password_hashed ? (String(password_hashed).toLowerCase() == "true") : false;
    this.password = password ? (password_hashed?password:sha256hex(password)) : null;
}

RademacherHomePilotSession.prototype.login = function(callback) {
    if (!this.password) {
        this.log("Warning. No password has been configured. Consider protecting access to your HomePilot.");
        callback(null);
        return;
    }
    var self = this; 
    axiosCookieJarSupport(axios);
    this.cookieJar = new tough.CookieJar();
    axios.post(this.url + "/authentication/password_salt",         
        "",
        { 
            timeout: 30000, 
            headers: {'content-type' : 'application/json'},
            withCredentials: true,
            jar: self.cookieJar,
        })
      .then((response) => {
        const salt = response.data.password_salt;
        axios.post(this.url + "/authentication/login",         
            { password: sha256hex(salt + self.password), password_salt: salt },
            { 
                timeout: 30000, 
                headers: {'content-type' : 'application/json'},
                withCredentials: true,
                jar: self.cookieJar,
            })
        .then((response) => {
            self.log("Successfully logged into HomePilot.");
            callback(null);
        })  
        .catch((error) => {
            self.log("Error response: "+JSON.stringify(error.response.data))
            if (error.response && error.response.status && error.response.status == 500) {
                // 500 here when the salt endpoint worked means wrong password.
                error = new Error("Wrong password. Make sure the configured HomePilot's password is correct.")
            }
            self.log("Login error: " + error);
            callback(error);
            return;
        });
      })  
      .catch((error) => {
        if (error.response && error.response.status && error.response.status == 500) {
            // Salt endpoint fails with 500 when password is disabled.
            self.log("Warning. Password has been configured but does not appear to be enabled on HomePilot.");
            callback(null);
            return;
        }
        self.log("Login salt error: " + error);
        callback(error);
        return;
    });
};

RademacherHomePilotSession.prototype.logout = function(callback) {
    if (!this.password) {
        callback(null);
        return;
    }
    var self = this;
    axios.post(this.url + "/authentication/logout",         
        "",
        { 
            timeout: 30000, 
            headers: {'content-type' : 'application/json'},
            withCredentials: true,
            jar: self.cookieJar,
        })
      .then((response) => {
        callback(null);
      })  
      .catch((error) => {
        self.log("Logout error for path %s/authentication/logout: %s",self.url,error);
        callback(error);
    });
};

RademacherHomePilotSession.prototype.get = function(path, timeout, callback) {
    var self = this;
    axios.get(this.url + path, 
        { 
            timeout: timeout,
            withCredentials: true, 
            jar: self.cookieJar,
        })
      .then((response) => {
        callback(null,response.data);
      })  
      .catch((error) => {
        self.log("GET error for path %s%s: %s",self.url,path,error);
        callback(error, null);
    });
};

RademacherHomePilotSession.prototype.put = function(path, params, timeout, callback) {
    var self = this;
    axios.put(this.url + path, 
        params,
        { 
            timeout: timeout, 
            headers: {'content-type' : 'application/json'},
            withCredentials: true,
            jar: self.cookieJar,
        })
      .then((response) => {
        callback(null);
      })  
      .catch((error) => {
        self.log("PUT error for path %s%s: %s",self.url,path,error);
        callback(error, null);
    });
};

RademacherHomePilotSession.prototype.post = function(path, params, timeout, callback) {
    var self = this;
    axios.post(this.url + path,         
        params,
        { 
            timeout: timeout, 
            headers: {'content-type' : 'application/json'},
            withCredentials: true,
            jar: self.cookieJar,
        })
    .then((response) => {
        callback(null);
    })  
    .catch((error) => {
        self.log("POST error for path %s%s: %s",self.url,path,error);
        callback(error);
    });
};

module.exports = RademacherHomePilotSession;
