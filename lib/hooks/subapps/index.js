module.exports = function(sails) {

  var path = require('path');
  var async = require('async');
  var uuid = require('node-uuid');
  return {

    /**
     * Initialize is fired first thing when the hook is loaded
     *
     * @api public
     */

    initialize: function(cb) {

      var self = this;
      self.apps = {};
      self.mountMap = {};
      var eventsToWaitFor = [];
      if (sails.hooks.orm) {
        eventsToWaitFor.push('hook:orm:loaded');
      }
      sails.after(eventsToWaitFor, function() {
        sails.modules.loadSubapps(function modulesLoaded (err, modules) {
          if (err) return cb(err);
          // Loop through each subapp
          async.each(sails.util.keys(modules), function(identity, cb) {

            var module = modules[identity];

            // Get the app's package.json
            var packageJson = module['package.json'];

            // Get any user-level subapp config
            var config = (sails.config.subapps && sails.config.subapps[identity]) || {};

            // Expand out any connections that are string values
            config.connections = _.reduce(config.connections, function(memo, val, key) {
              if (typeof val == 'string') {
                memo[key] = sails.config.connections[val];
              } else {
                memo[key] = val;
              }
              return memo;
            }, {localDiskDb: false});

            // Load the app
            var app = new sails.constructor();

            app.load({
              appPath: path.resolve(sails.config.paths.subapps, identity),
              globals: false,
              hooks: {
                grunt: false
              },
              isSubApp: true,
              expose: {
                adapters: sails.adapters,
                models: _.reduce(config.models || {}, function(memo, modelIdentity, mapTo) {
                  if (sails.models[modelIdentity]) {
                    memo[mapTo] = sails.models[modelIdentity];
                    return memo;
                  }
                }, {})
              },
              connections: _.reduce(config.connections, function(memo, val, key) {
                // Create a unique ID for this connection to guarantee that it won't
                // collide with other, already-registered connections
                var connectionId = uuid.v4();
                if (typeof val == 'string') {
                  memo[connectionId] = _.cloneDeep(sails.config.connections[val]);
                } else {
                  memo[connectionId] = _.cloneDeep(val);
                }
                memo[connectionId].mappedFrom = key;
                return memo;
              }, {localDiskDb: false})
            }, function(err, loadedApp) {
              if (err) {
                return cb(err);
              }
              self.apps[identity] = loadedApp;
              var mountConfig = (packageJson.sails && packageJson.sails.mount) || '/' + appName;
              if (typeof mountConfig == 'string') {
                self.mountMap[mountConfig] = loadedApp;
              } else {
                // Allow more mounting options such as multiple mount points
                // and URL rewrites
              }
              return cb();
            });

          }, cb);
        });
      });

    }

  };

};
