var path = require('path');
var fs   = require('fs');

/**▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 * Extract require and generate component.json files of a project.
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
 * Browse a directory to search for components folders.
 * Is considered a component folder, a folder containing an 'index.js' file.
 * Directories named 'node_modules' are skipped. Hidden directories (begin with '.') are also skipped
 * We also extract component path we need to extract component.json file
 *
 * @param {string} directoryPath - path to the directory, relative to where app was launch
 * @param {string} directoryName - name of directory (therefore, the name of the component
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

	if (directoryName && fs.existsSync(path.join(directoryPath, 'index.js'))) {
		// add directoryName in the list of components
		var componentPath = directoryPath.split('/');
		componentPath.pop();
		componentPath = componentPath.join('/');

		if (componentList[directoryName]) {
			console.warn('possible component name conflict: ' + directoryName + '  ' + componentList[directoryName]);
			console.warn('possible component name conflict: ' + directoryName + '  ' + componentPath);
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
				scriptList: ['index.js'], // we consider index.js to be the main file
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
 * Get relative path to dependencyPath, from componentPath location
 *
 * @param {string} componentPath  - path to component
 * @param {string} dependencyPath - path to component's dependency
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
 * Create the component.json file of one component.
 *
 * @param {string}   componentName - component name
 * @param {string}   dir           - path to component
 * @param {string}   fileName      - file name of component source
 * @param {string[]} scriptList    - list of script file of this component (*.js in directory)
 * @param {string[]} stylesList    - list of styles file of this component (*.css, *.less in directory)
 */
function createComponentJson(componentName, dir, fileName, scriptList, stylesList) {
	if (excludePaths.indexOf(path.join(rootDir, dir)) !== -1) return;

	var filePath = path.join(rootDir, dir, fileName);
	var jsonPath = path.join(rootDir, dir, 'component.json');

	if (!fs.existsSync(filePath)) return;

	// skip any existing component if it is versioned or coming from a repo
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
	var parents = [''];
	var addedFiles = {};


	function addFile(fileName) {
		var filePath = path.join(rootDir, dir, fileName);

		// don't add file if it has been added previously
		if (addedFiles[filePath]) return false;

		addedFiles[filePath] = true;

		if (!fs.existsSync(filePath)) {
			throw new Error('Dependency file not found: "' + filePath + '"');
		}

		// Parse javascript to find require
		var fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
		var fileRequires = fileContent.split(/(require\('[A-Za-z0-9\_\-\.\/\$]*'\))/).filter(function (str) {
			return str.substr(0, 9) === 'require(\'';
		});
		requires.push(fileRequires);
		return true;
	}

	addFile(fileName);

	while (requires.length) {
		var required = requires.pop();
		var parentPath = parents.pop();
		var dependencyPath, relativePath;

		for (var i = 0; i < required.length; i++) {
			// Get the dependency name out of the "require('[...]')"
			var dependencyName = required[i];
			dependencyName = dependencyName.substring(9, dependencyName.length - 2);

			if (dependencyName.indexOf('/') !== -1) {
				if (dependencyName.substr(0, 2) === './') {
					dependencyName = dependencyName.substr(2);
				}

				// Get requirements of path
				dependencyPath = dependencyName.split('/');

				// Get the file name out of the path
				var depFileName = dependencyPath.pop();

				// Add '.js' extension if none is provided
				// TODO: allow filename with '.' in the filename
				if (depFileName.search(/\./) === -1) depFileName += '.js';

				// Reconstruct the path
				dependencyPath = dependencyPath.join('/') || '';

				// Get the relative path based on the root of the component
				relativePath = path.join(parentPath, dependencyPath, depFileName);

				// Can't require a file outside of the component root
				if (relativePath.substr(0, 3) === '../') {
					throw new Error('File scripts outside of the root not allowed: ' + relativePath);
				}

				// Skip if the file has not been added
				if (!addFile(relativePath)) continue;

				// Add the file to the list of scripts
				if (scriptList.indexOf(relativePath) === -1) {
					scriptList.push(relativePath);
				}

				// Set the parent for the next batch of files
				parents.push(path.join(parentPath, dependencyPath));

				if (dependencyPath) {
					// Exclude the sub-folder to avoid parsing it as a component
					excludePaths.push(path.join(rootDir, dir, dependencyPath));
				}
			} else {
				dependencyPath = componentList[dependencyName];
				if (dependencyPath) {
					// local dependencies
					relativePath = getRelativePath(dir, dependencyPath);
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
 * Generate component.json files from a list of component
 *
 * @param {Object[]} componentsToParse - a list of components to parse
 *
 * @param {string}   componentsToParse[*].name       - component name
 * @param {string}   componentsToParse[*].dir        - component path
 * @param {string}   componentsToParse[*].fileName   - component script file names
 * @param {string[]} componentsToParse[*].scriptList - list of component script file names
 * @param {string[]} componentsToParse[*].stylesList - list of component style file names
 */
function extractComponentJson(componentsToParse) {
	for (var i = 0, len = componentsToParse.length; i < len; i++) {
		var current = componentsToParse[i];
		createComponentJson(current.name, current.dir, current.fileName, current.scriptList, current.stylesList);
	}
}


/**▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 * Executes extraction with provided parameters
 * 
 * @param {Object} params                      - parameter object
 *
 * @param {Object} params.sourcePaths          - list of directories where component.json files have to be generated
 * @param {Object} params.excludePaths         - list of directories to exclude from scanning
 * @param {Object} params.externalDependencies - list of external dependecies with their path and version
 */
exports.execute = function (params, cb) {
	componentList     = {};
	componentsToParse = [];
	rootDir = process.cwd();
	
	sourcePaths          = params.sourcePaths;
	excludePaths         = params.excludePaths;
	externalDependencies = params.externalDependencies;
	sourcePathsLength    = sourcePaths.length;

	try {
		// Scan project directories, getting component list
		getComponentList('', '');
		// Extracting component.json files
		extractComponentJson(componentsToParse);
	} catch (error) {
		return cb(error);
	}

	return cb();
};