////////////////////////////////////////////////////////////
// Temporary fix to deal with permission issues 
// on asset-rack in NPM
////////////////////////////////////////////////////////////

// assets.js
// --------------------
//
// Manage bundling/inclusion/compilation of assets
// Includes support for CSS, LESS, js, & CoffeeScript

var _ = require('underscore');
_.str = require('underscore.string');
var async = require('async');
var rigging = require('rigging')();
var express = require('express');

var assets = {

	// Generated prefix for linking directly to CSS and JS assets
	prefix: '/assets',

	// Cache templates in production
	templateCache: '',

	// View partials to share with views/layout
	partials: {

		development: {

			/**
			 * Recompile all LESS and SASS assets, then generate link tags for CSS files
			 * Either one minified file (in production), or a link to each individual file (in development)
			 */
			css: function() {
				var html = '';

				// In development mode, lookup css files on the rigging path on the fly
				var cssFiles = rigging.ls(sails.config.assets.sequence, /\.css$/, true);


				// Add LESS and SASS files (these were compiled in res.view)
				cssFiles.push("rigging.less.css");
				// cssFiles.push("rigging.sass.css");

				_.each(cssFiles, function(path) {
					html += '<link rel="stylesheet" type="text/css" media="all" href="' + assets.prefix + '/' + path + '"/>';
				});

				return html;
			},

			/**
			 * Recompile all coffeescript assets, then generate script tags for js files
			 * Either one minified file (in production), or a link to each individual file (in development)
			 */
			js: function() {
				var html = '';

				// In development mode, lookup css files in the rigging dir(s) on the fly
				var jsFiles = rigging.ls(sails.config.assets.sequence, /\.js$/, true);

				// Add CoffeeScript file (this was compiled in res.view)
				jsFiles.push("rigging.coffee.js");

				_.each(jsFiles, function(path) {
					html += '<script type="text/javascript" src="' + assets.prefix + '/' + path + '"></script>';
				});

				return html;
			},


			/**
			 * Write templates to the template library div.
			 * TODO: In lieu of a true cache, store the compiled templates in memory in production mode.
			 * (Because templates are dumped directly into the layout, we cannot use standard HTTP or file
			 * caching methods.)
			 */
			templateLibrary: function() {
				var html = '<div style="display:none;" id="rigging-template-library">\n';

				// Get all template files in rigging sequence
				var templateFiles = rigging.ls(sails.config.assets.sequence, new RegExp('\\.' + sails.config.viewEngine));
				_.each(templateFiles, function(filepath) {
					html += require('fs').readFileSync(filepath, 'utf8') + "\n";
				});

				html += "</div>";
				return html;
			}
		},

		// View partials to share with views/layout in production
		production: {

			/**
			 * Recompile all LESS and SASS assets, then generate link tags for CSS files
			 * Either one minified file (in production), or a link to each individual file (in development)
			 */
			css: function() {
				return '<link rel="stylesheet" type="text/css" media="all" href="' + assets.prefix + '/rigging.min.css"/>';
			},

			/**
			 * Recompile all coffeescript assets, then generate script tags for js files
			 * Either one minified file (in production), or a link to each individual file (in development)
			 */
			js: function() {
				// In production mode, use minified version built ahead of time
				return '<script type="text/javascript" src="' + assets.prefix + '/rigging.min.js"></script>';
			},


			/**
			 * Write templates to the template library div.
			 * TODO: In lieu of a true cache, store the compiled templates in memory in production mode.
			 * (Because templates are dumped directly into the layout, we cannot use standard HTTP or file
			 * caching methods.)
			 */
			templateLibrary: function() {
				var html = '<div style="display:none;" id="rigging-template-library">\n';
				html += assets.templateCache;
				html += "</div>";
				return html;
			}
		}
	},



	// Configure asset middleware
	middleware: {

		development: function(cb) {

			// Compile LESS files before each request
			sails.express.app.use(function(req, res, next) {

				// TODO: only compile assets for requests which utilize the layout
				rigging.compile(sails.config.assets.sequence, {
					environment: sails.config.environment,
					outputPath: sails.config.assets.outputPath
				}, function(err) {
					if (err) return res.send(err, 500);

					sails.log.verbose("Recompiled assets for request! ", req.url);

					// Allow rendering of <link>, <script>, and template library view partials
					sails.express.app.locals({
						assets: assets.partials.development
					});

					next();
				});
			});

			// Allow access to static dirs
			sails.express.app.use(express['static'](sails.config.paths['public']));

			// Allow access to compiled and uncompiled rigging directories
			sails.express.app.use(assets.prefix, express['static'](sails.config.assets.outputPath));
			_.each(sails.config.assets.sequence, function(item) {
				sails.express.app.use(assets.prefix, express['static'](item));
			});

			// Trigger callback
			cb();

		},

		production: function(cb) {

			async.auto({
				compile: function(cb) {

					// Compile LESS files at server launch
					sails.log.verbose("Compiling assets on server launch... ");
					rigging.compile(sails.config.assets.sequence, {
						environment: 'production',
						outputPath: sails.config.assets.outputPath
					}, cb);
				},
				templates: function(cb) {

					// Build template cache
					// Get all template files in rigging sequence
					var templateFiles = rigging.ls(sails.config.assets.sequence, new RegExp('\\.' + sails.config.viewEngine));
					async.forEach(templateFiles, function(filepath, cb) {
						require('fs').readFile(filepath, 'utf8', function(err, contents) {
							assets.templateCache += contents + "\n";
							return cb(err);
						});
					}, cb);
				}
			}, function(err) {

				// Allow access to compiled rigging directories
				sails.express.app.use(assets.prefix, express['static'](sails.config.assets.outputPath));

				// Configure access to public dir w/ a cache maxAge
				sails.express.app.use(express['static'](sails.config.paths['public'], {
					maxAge: sails.config.cache.maxAge
				}));

				// Allow rendering of <link>, <script>, and template library view partials
				sails.express.app.locals({
					assets: assets.partials.production
				});

				return cb(err);
			});

		}

	}
};

// Export module
module.exports = assets;

////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////

// //	assets.js
// // --------------------
// //
// // Manage bundling/inclusion/compilation of assets
// // Includes support for CSS, LESS, js, & CoffeeScript

// var _ = require('underscore');
// _.str = require('underscore.string');
// var async = require('async');
// var rack = require('asset-rack');
// var pathutil = require('path');
// var wrench = require('wrench');
// var fs = require('fs');
// var cleancss = require('clean-css');
// var async = require('async');
// var uglify = require('uglify-js');
// var isProduction = sails.config.environment === 'production';

// var JavascriptAsset = rack.Asset.extend({
// 	mimetype: 'text/javascript',
// 	create: function() {
// 		var self = this;
// 		self.paths = search(sails.config.assets.sequence, /(\.js|\.coffee|\.ts)$/);
// 		self.assets = [];
// 		async.forEachSeries(self.paths, function(path, next) {
// 			var asset;
// 			if (path.indexOf('.coffee') !== -1) {
// 				var coffee = require('coffee-script');
// 				asset = new rack.Asset({
// 					mimetype: 'text/javascript',
// 					url: '/' + pathutil.relative(sails.config.appPath, path).replace('.coffee', '.js').replace(/\\/g, '/'),
// 					contents: coffee.compile(fs.readFileSync(path, 'utf8'))
// 				});
// 			} else if (path.indexOf('.ts') !== -1) {
// 				var tsc = require('node-typescript');
// 				var jscode = null;
// 				try {
// 					jscode = tsc.compile(path, fs.readFileSync(path, 'utf8'));
// 				} catch (e) {
// 					jscode = '';
// 				}
// 				asset = new rack.Asset({
// 					mimetype: 'text/javascript',
// 					url: '/' + pathutil.relative(sails.config.appPath, path).replace('.ts', '.js').replace(/\\/g, '/'),
// 					contents: jscode
// 				});
// 			} else {
// 				asset = new rack.Asset({
// 					mimetype: 'text/javascript',
// 					url: '/' + pathutil.relative(sails.config.appPath, path).replace(/\\/g, '/'),
// 					contents: fs.readFileSync(path, 'utf8')
// 				});
// 			}
// 			asset.isDev = true;
// 			self.assets.push(asset);
// 			asset.on('complete', next);
// 		}, function(error) {
// 			if (error) self.emit('error', error);
// 			self.contents = '';
// 			if (isProduction) {
// 				_.each(self.assets, function(asset) {
// 					self.contents += asset.contents + '\n';
// 				});
// 				self.contents = uglify.minify(self.contents, {
// 					fromString: true
// 				}).code;
// 			}
// 			self.isDev = false;
// 			self.emit('created');
// 		});
// 	}
// });

// var CssAsset = rack.Asset.extend({
// 	create: function() {
// 		var self = this;
// 		self.regex = /(\.css|\.less)$/;
// 		self.paths = search(sails.config.assets.sequence, self.regex);
// 		self.assets = [];

// 		// Build collection 
// 		async.forEachSeries(self.paths, function(path, next) {
// 			var asset,
// 			url = '/' + pathutil.relative(sails.config.appPath, path).replace(/\\/g, '/')
// 				.replace('.less', '.css');
// 			if (pathutil.extname(path) === '.less') asset = new rack.LessAsset({
// 				url: url,
// 				filename: path
// 			})
// 			else asset = new rack.Asset({
// 				url: url,
// 				contents: fs.readFileSync(path, 'utf8')
// 			});
// 			asset.isDev = true;
// 			self.assets.push(asset);
// 			asset.on('complete', next);
// 		}, function(error) {
// 			if (error) self.emit('error', error);
// 			self.isDev = false;
// 			self.emit('created');
// 		});
// 	}
// });

// var TemplateAsset = rack.Asset.extend({
// 	create: function() {
// 		var self = this;
// 		self.regex = /\.ejs|\.html|\.tmpl$/;
// 		self.paths = search(sails.config.assets.sequence, self.regex);
// 		self.contents = '<div style="display:none;" id="rigging-template-library">\n';
// 		_.each(self.paths, function(path) {
// 			var fileContents = fs.readFileSync(path, 'utf8');
// 			self.contents += fileContents;
// 		});
// 		self.contents += '</div>';
// 		self.emit('created');
// 	}
// });

// var Rack = rack.Rack.extend({
// 	js: function() {
// 		var out = '';
// 		_.each(this.assets, function(asset) {
// 			isJs = asset.mimetype == 'text/javascript';
// 			if (sails.config.environment == 'production') {
// 				if (isJs && !asset.isDev) out += asset.tag() + '\n';
// 			} else {
// 				if (isJs && asset.isDev) out += asset.tag() + '\n';
// 			}
// 		});
// 		return out;
// 	},
// 	css: function() {
// 		var out = '';
// 		_.each(this.assets, function(asset) {
// 			isCss = asset.mimetype == 'text/css';
// 			if (sails.config.environment == 'production') {
// 				if (isCss && !asset.isDev) out += asset.tag() + '\n';
// 			} else {
// 				if (isCss && asset.isDev) out += asset.tag() + '\n';
// 			}
// 		});
// 		return out;
// 	},
// 	templateLibrary: function() {
// 		var out = '';
// 		_.each(this.assets, function(asset) {
// 			if (asset.mimetype === 'text/html') {
// 				out += asset.contents;
// 			}
// 		});
// 		return out;
// 	}
// });

// /**
//  * given a list directories with relative paths to `sails.config.appPath`
//  * and a regex, return all the files in the directories that match
//  * the given regex
//  */
// var search = function(dirnames, regex) {
// 	var paths = [];
// 	_.each(dirnames, function(dirname) {
// 		var abspath = pathutil.join(sails.config.appPath, dirname);
// 		var filenames = wrench.readdirSyncRecursive(abspath);
// 		_.each(filenames, function(filename) {
// 			var filepath = pathutil.join(abspath, filename);
// 			if (!fs.statSync(filepath).isFile() || !regex.test(filepath)) return;
// 			paths.push(filepath);
// 		});
// 	});
// 	return paths;
// };

// exports.createAssets = function() {
// 	return new Rack([
// 	new JavascriptAsset({
// 		url: '/app.js'
// 	}), new CssAsset({
// 		url: '/style.css'
// 	}), new TemplateAsset({
// 		url: '/templates.html'
// 	})]);
// };