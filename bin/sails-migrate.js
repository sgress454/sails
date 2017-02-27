/**
 * Module dependencies
 */

var path = require('path');
var chalk = require('chalk');
var _ = require('@sailshq/lodash');
var sailsgen = require('sails-generate');
var CaptainsLog = require('captains-log');
var package = require('../package.json');
var rconf = require('../lib/app/configuration/rc')();


/**
 * `sails new`
 *
 * Generate a new Sails app.
 *
 * ```
 * # In the current directory:
 * sails new
 * ```
 *
 * ```
 * # As a new directory or within an existing directory:
 * sails new foo
 * ```
 *
 * @stability 3
 * @see http://sailsjs.com/documentation/reference/command-line-interface/sails-new
 * ------------------------------------------------------------------------
 * This command builds `scope` for the generator by scooping up any available
 * configuration using `rc` (merging config from env vars, CLI opts, and
 * relevant `.sailsrc` files).  Then it runs the `sails-generate-new`
 * generator (https://github.com/balderdashy/sails-generate-new).
 */

module.exports = function () {

  // Require the `package.json` of the local app, in case it hasn't been required already.
  // This ensures that the package.json is in the cache, which will give us access to
  // the local `require` module for the app.
  var pathToLocalPackageJson = path.resolve(process.cwd(), 'package.json');
  var localPackageJson = require(pathToLocalPackageJson);

  // Attempt to require the migrator
  var migrator = (function() {
    try {
      return require.cache[pathToLocalPackageJson].require('@sailshq/migrate');
    } catch (e) {
      console.log(chalk.bold('Could not find the @sailhq/migrate package in your local app folder.'));
      console.log('Please run `npm install @sailshq/migrate` and try again.');
      console.log();
      console.log('Note: migration tool beta is currently available only to Flagship customers.');
      process.exit(1);
    }
  })();

  // Build initial scope
  var scope = {
    rootPath: process.cwd(),
    modules: {
      'migrate': migrator
    },
    sailsRoot: path.resolve(__dirname, '..')
  };

  // Mix-in rconf
  _.merge(scope, rconf.generators);

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // FUTURE: Verify that we can just do a top-level merge here,
  // and then reference `scope.generators.modules` as needed
  // (would be simpler- but would be a breaking change, though
  // unlikely to affect most people.  The same issue exists in
  // other places where we read rconf and then call out to
  // sails-generate)
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  _.merge(scope, rconf);

  // Get a temporary logger just for use in `sails new`.
  // > This is so that logging levels are configurable, even when a
  // > Sails app hasn't been loaded yet.
  var log = CaptainsLog(rconf.log);

  // Pass the original CLI arguments down to the generator
  // (but first, remove commander's extra argument)
  var cliArguments = Array.prototype.slice.call(arguments);
  cliArguments.pop();
  scope.args = cliArguments;

  scope.generatorType = 'migrate';

  return sailsgen(scope, {
    // Handle unexpected errors.
    error: function (err) {

      log.error(err);
      return process.exit(1);

    },//</on error :: sailsGen()>

    // Attend to invalid usage.
    invalid: function (err) {

      // If this is an Error, don't bother logging the stack, just log the `.message`.
      // (This is purely for readability.)
      if (_.isError(err)) {
        log.error(err.message);
      }
      else {
        log.error(err);
      }

      return process.exit(1);

    },//</on invalid :: sailsGen()>
    success: function() {
      // Good to go.
    }
  });
};
