var path      = require('path');
var fs        = require('fs');
var commander = require('commander');


/**▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 * @module componentExtractor
 * @desc   Extract require and generate component.json files of a project.
 *
 * @author Cedric Stoquer
 */

var sourcePaths;
var sourcePathsLength;
var excludePaths;
var externalDependencies;
var componentList;
var componentsToParse;
var rootDir;


/**▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 * @method   module:componentExtractor.getComponentList
 *
 * @desc     Browse a directory to search for components folders.
 *           Is considered a component folder, a folder containing an 'index.js' file.
 *           Directories named 'node_modules' are skipped. Hidden directories (begin with '.') are also skipped
 *           We also extract component path we need to extract component.json file
 *
 * @param {String} directoryPath - path to the directory, relative to where app was launch
 * @param {String} directoryName - name of directory (therefore, the name of the component 
 *                                 if it is a component folder)
 */
function getComponentList(directoryPath, directoryName) {
	var i, len;
	// skip 'node_modules' directories
	if (directoryName === 'node_modules') return;
	// skip hidden directories
	if (directoryName && directoryName[0] === '.') return;

	var directoryContent = fs.readdirSync(path.join(rootDir, directoryPath));

	// get sub-directories list
	var subdirectoriesList = directoryContent.filter(function (fileName) {
		var filePath = path.join(directoryPath, fileName);
		try {
			var stats = fs.statSync(path.join(rootDir, filePath));
			var isExcluded = (excludePaths.indexOf(filePath) !== -1);
			return !isExcluded && stats.isDirectory();
		} catch (ex) {
			// skip broken links (at least we need it for Aeris Vagrantfile)
			if (fs.lstatSync(path.join(rootDir, filePath)).isSymbolicLink()) {
				return false;
			}
			throw ex;
		}
	});

	// get javascript files
	var scriptList = directoryContent.filter(function (fileName) {
		var isJs = fileName.search(/\.js$/) !== -1;
		return isJs;
	});

	if (directoryName && scriptList.indexOf('index.js') !== -1) {
		// add directoryName in the list of components
		var componentPath = directoryPath.split('/');
		componentPath.pop();
		componentPath = componentPath.join('/');

		if (componentList[directoryName]) {
			console.log('[WARN] possible component name conflict: ' + directoryName + '  ' + componentList[directoryName]);
			console.log('[WARN] possible component name conflict: ' + directoryName + '  ' + componentPath);
		}

		componentList[directoryName] = componentPath;

		// if component is the subdir to parse, add it to a list of component to generate
		var isInListToExtract = false;
		for (i = 0; i < sourcePathsLength; i++) {
			if (directoryPath.substr(0, sourcePaths[i].length) === sourcePaths[i]) {
				isInListToExtract = true;
				break;
			}
		}

		if (isInListToExtract) {
			// get style files
			var stylesList = directoryContent.filter(function (fileName) {
				var isCss  = fileName.search(/\.css$/)  !== -1;
				var isLess = fileName.search(/\.less$/) !== -1;
				return isCss || isLess;
			});

			componentsToParse.push({
				name: directoryName,
				dir: directoryPath,
				fileName: 'index.js',
				scriptList: scriptList,
				stylesList: stylesList
			});
		}
	}
	
	// recurse on subdirectories
	for (i = 0, len = subdirectoriesList.length; i < len; i++) {
		var id = subdirectoriesList[i];
		getComponentList(path.join(directoryPath, id), id);
	}
}

/**▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 * @method   module:componentExtractor.getRelativePath
 *
 * @desc     Get relative path to dependencyPath, from componentPath location
 *
 * @param {String} componentPath  - path to component
 * @param {String} dependencyPath - path to component's dependency
 */
function getRelativePath(componentPath, dependencyPath) {
	componentPath  = componentPath.split('/');
	dependencyPath = dependencyPath.split('/');
	while (true) {
		if (componentPath.length === 0 || dependencyPath.length === 0) break;
		if (componentPath[0] !== dependencyPath[0]) break;
		componentPath.shift();
		dependencyPath.shift();
	}
	for (var i = 0, len = componentPath.length; i < len; i++) {
		componentPath[i] = '..';
	}
	if (componentPath.length === 0) componentPath.push('.');
	var relativePath = componentPath.concat(dependencyPath).join('/');
	return relativePath;
}


/**▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 * @method   module:componentExtractor.createComponentJson
 *
 * @desc     Create the component.json file of one component.
 *
 * @param {String}   componentName - component name
 * @param {String}   dir           - path to component
 * @param {String}   fileName      - file name of component source
 * @param {String[]} scriptList    - list of script file of this component (*.js in directory)
 * @param {String[]} stylesList    - list of styles file of this component (*.css, *.less in directory)
 */
function createComponentJson(componentName, dir, fileName, scriptList, stylesList) {
	/* jshint maxstatements: 38 */
	var filePath = path.join(rootDir, dir, fileName);
	var jsonPath = path.join(rootDir, dir, 'component.json');

	if (!fs.existsSync(filePath)) return;

	// skip any existing component if it is versioned or comming from a repo
	if (fs.existsSync(jsonPath)) {
		var compo = require(jsonPath);
		if (compo && (compo.version || compo.repo)) {
			console.warn('Skipping versioned/downloaded component "' + compo.name + '", version ' + compo.version);
			console.warn('To remove this warning, exclude any parent directory of ' + dir);
			return;
		}
	}

	var localObj = {};
	var pathsObj = {};

	var componentJson = {
		name: componentName,
		dependencies: {}
	};

	// adding styles
	if (stylesList.length > 0) componentJson.styles = stylesList;

	var requires = [];
	var addedFiles = {};

	function addFile(filePath) {
		// don't add file if it has been added previously
		if (addedFiles[filePath]) return;
		addedFiles[filePath] = true;

		if (!fs.existsSync(filePath)) {
			throw new Error('Dependency file not found: "' + filePath + '"');
		}
		// parse javascript to find require
		var fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
		requires = requires.concat(fileContent.split(/(require\('[A-Za-z0-9\_\-\.\/\$]*'\))/).filter(function (str) {
			return str.substr(0, 9) === 'require(\'';
		}));
	}
	addFile(filePath);

	for (var i = 0; i < requires.length; i++) {
		// get the dependency name out of the "require('...')"
		var dependencyName = requires[i];
		dependencyName = dependencyName.substring(9, dependencyName.length - 2);

		if (dependencyName.substr(0, 2) === './') {
			// get requirements of subpath
			dependencyName = dependencyName.substring(2, dependencyName.length);
			// add '.js' extension if no extention is provided
			if (fileName.search(/\./) === -1) dependencyName += '.js';
			addFile(path.join(rootDir, dir, dependencyName));
		} else {
			var dependencyPath = componentList[dependencyName];
			if (dependencyPath) {
				// local dependencies
				var relativePath = getRelativePath(dir, dependencyPath);
				pathsObj[relativePath] = true;
				localObj[dependencyName] = true;
			} else {
				// check in external dependencies
				var externalDependency = externalDependencies[dependencyName];
				if (!externalDependency) {
					throw new Error('Not found dependency: "' + dependencyName + '"');
				}
				componentJson.dependencies[externalDependency.path] = externalDependency.components;
			}
		}
	}

	// converting to array
	var local = Object.keys(localObj);
	var paths = Object.keys(pathsObj);

	if (local.length > 0) componentJson.local = local;
	if (paths.length > 0) componentJson.paths = paths;

	componentJson.scripts = scriptList;

	// write component.json file in directory
	fs.writeFileSync(jsonPath, JSON.stringify(componentJson, null, '\t'), { encoding: 'utf8' });
}


/**▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 * @method   module:componentExtractor.extractComponentJson
 *
 * @desc     generate component.json files for a list of component
 *
 * @param {Object[]} componentsToParse - a list of components to parse
 *
 * @param {String}   componentsToParse[*].name       - component name
 * @param {String}   componentsToParse[*].dir        - component path
 * @param {String}   componentsToParse[*].fileName   - component script file names
 * @param {String[]} componentsToParse[*].stylesList - list of component style file names
 */
function extractComponentJson(componentsToParse) {
	for (var i = 0, len = componentsToParse.length; i < len; i++) {
		var current = componentsToParse[i];
		createComponentJson(current.name, current.dir, current.fileName, current.scriptList, current.stylesList);
	}
}


/**▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 * executes extractor on the current process argv
 * 
 * @param {String[]} argv
 */
exports.execute = function (argv, cb) {
	componentList     = {};
	componentsToParse = [];
	rootDir = process.cwd();

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

	sourcePaths          = config.sourcePaths;
	excludePaths         = config.excludePaths;
	externalDependencies = config.externalDependencies;
	sourcePathsLength    = sourcePaths.length;

	try {
		console.log('Getting component list...');
		getComponentList('', '');
		console.log('Extracting component.json files...');
		extractComponentJson(componentsToParse);
		console.log('Done.');
	} catch (error) {
		return cb(error);
	}

	return cb();
};

