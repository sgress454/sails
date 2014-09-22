module.exports = function(sails) {

  var path = require('path');
  var async = require('async');
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

            // Load the app
            var app = new sails.constructor();

            app.load({
              appPath: path.resolve(sails.config.paths.subapps, identity),
              globals: false,
              hooks: {
                grunt: false
              },
              connections: _.reduce(sails.config.connections, function (m, connectionOptions, connectionIdentity) {
                m[identity + "_" + connectionIdentity] = _.cloneDeep(connectionOptions);
                return m;
              }, {})
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
