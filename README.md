# component-extractor

This tool will generate `component.json` files of your project.

## Install

`npm install component-extractor`

## Use

`component-extractor -c <path to config file>`

### Operation

The process will first scan the project to search components directories.
Is considered a component folder, a folder containing an 'index.js' file.
The name of the component is the name of its directory.
The process will output a warning message if name collision is detected.
Once the list of components is done, the process will search inside javascript file for `require` statements
and use this to generate a `component.json` file for each components.

You define in the configuration file which directories are scanned and wich directories are extracted.

### Configuration file

In the configuration file, you should define 3 lists:
* `sourcePaths` a list of directories where `component.json` files have to be generated.
* `excludePaths` a list of directories to exclude from scanning.
* `externalDependencies` a list of external dependecies with their path and version.


## TODO

* exclude `require` that are commented out in javascript code

