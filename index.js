var path    = require('path');
var fs      = require('fs');

/**▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 * @module componentExtractor
 * @desc   Extract require and generate component.json files of a project.
 *
 * @author Cedric Stoquer
 */


// load config.json
var config = fs.readFileSync(path.join(__dirname, 'config.json'), { encoding: 'utf8' });
if (!config) return console.warn('[ERROR] No config.json file.');
config = JSON.parse(config);

var sourcePaths = config.sourcePaths;
var excludePaths = config.excludePaths;
var externalDependencies = config.externalDependencies;

var sourcePathsLength = sourcePaths.length;
var componentList = {};
var componentsToParse = [];

var rootDir = process.cwd();

/**▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 * @function module:componentExtractor.getComponentList
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
		var stats = fs.statSync(path.join(rootDir, filePath));
		var isNotExcluded = (excludePaths.indexOf(filePath) === -1);
		return isNotExcluded && stats.isDirectory();
	});

	// get javascript files
	var indexJsList = directoryContent.filter(function (fileName) {
		var isIndexJs = (fileName === 'index.js');
		return isIndexJs;
	});

	if (directoryName && indexJsList.length > 0) {
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
			if (directoryPath.substring(0, sourcePaths[i].length) === sourcePaths[i]) {
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
 * @function module:componentExtractor.getRelativePath
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
 * @function module:componentExtractor.createComponentJson
 *
 * @desc     Create the component.json file in component directory
 *
 * @param {String}   componentName - component name
 * @param {String}   dir           - path to component
 * @param {String}   fileName      - file name of component source
 * @arams {String[]} stylesList    - list of styles file of this component (*.css, *.less in directory)
 */
function createComponentJson(componentName, dir, fileName, stylesList) {
	var filePath = path.join(rootDir, dir, fileName);

	if (!fs.existsSync(filePath)) return;

	var localObj = {};
	var pathsObj = {};
	var local = [];
	var paths = [];

	var componentJson = {
		name: componentName,
		dependencies: {}
	};

	// adding styles
	if (stylesList.length > 0) componentJson.styles = stylesList;

	// parse javascript to find require
	var fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
	var splited = fileContent.split(/(require\('[A-Za-z0-9\_\-\.\$]*'\))/);
	for (var i = 0, len = splited.length; i < len; i++) {
		var s = splited[i];
		if (s.substring(0,9) === 'require(\'') {
			// keep only the component name out of "require('name')"
			var dependencyName = s.substring(9, s.length - 2);
			var dependencyPath = componentList[dependencyName];
			if (dependencyPath) {
				// local dependencies
				var relativePath = getRelativePath(dir, dependencyPath);
				pathsObj[relativePath] = true;
				localObj[dependencyName] = true;
			} else {
				// check in external dependencies
				var externalDependency = externalDependencies[dependencyName];
				if (!externalDependency) console.warn('[ERROR] not found dependency: ' + dependencyName);
				componentJson.dependencies[externalDependency.path] = externalDependency.components;
			}
		}
	}

	// converting to array
	var k;
	for (k in localObj) local.push(k);
	for (k in pathsObj) paths.push(k);

	if (local.length > 0) componentJson.local = local;
	if (paths.length > 0) componentJson.paths = paths;

	componentJson.scripts = [fileName];

	// write component.json file in directory
	var jsonPath = path.join(rootDir, dir, 'component.json');
	// console.log("writting : " + jsonPath);
	fs.writeFileSync(jsonPath, JSON.stringify(componentJson, null, '\t'), { encoding: 'utf8' });
}


/**▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 * @function module:componentExtractor.extractComponentJson
 *
 * @desc     generate component.json files for a list of component
 *
 * @param {Object[]} componentsToParse - a list of components to parse
 * @param {String}   componentsToParse[*].name       - component name
 * @param {String}   componentsToParse[*].dir        - component path
 * @param {String}   componentsToParse[*].fileName   - component script file names
 * @param {String[]} componentsToParse[*].stylesList - list of component style file names
 */
function extractComponentJson(componentsToParse) {
	for (var i = 0, len = componentsToParse.length; i < len; i++) {
		var current = componentsToParse[i];
		createComponentJson(current.name, current.dir, current.fileName, current.stylesList);
	}
}


console.log('Getting component list...');
getComponentList('', '');
console.log('Extracting component.json files...');
extractComponentJson(componentsToParse);
console.log('Done.');

