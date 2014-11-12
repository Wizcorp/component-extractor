var commander = require('commander');
var path      = require('path');
var fs        = require('fs');
var extractor = require('../lib/component-extractor.js');

exports.execute = function (argv, cb) {
	commander.option('-c, --config <path>', 'path to the configuration file');
	commander.parse(argv);

	var configFile = commander.config;
	var config;

	if (fs.existsSync(path.join(__dirname, configFile))) {
		config = require(path.join(__dirname, configFile));
	} else if (fs.existsSync(path.resolve(configFile))) {
		config = require(path.resolve(configFile));
	} else {
		return cb('Could not load configuration file "' + configFile + '"');
	}

	extractor.execute(config, cb);
};
