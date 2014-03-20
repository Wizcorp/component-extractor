component-extractor
===================

This tool will generate component.json files of your project.

Process will browse current directory to search all components folders.
Is considered a component folder, a folder containing an 'index.js' file.
Directories named 'node_modules' are skipped. Hidden directories (with name begining with '.') are also skipped.
You can exclude directories from search by adding them to the `excludePaths` array of the `config.json`.


The process will then generate component.json files for the commponents in directories specified in the 
`sourcePaths` parameter of the `config.json`. Dependencies are extracted by searching for `require`
statements in the `index.js` file in component's directory. 

If a require is not found, component-extractor will try to resolve dependency by searching in the 
`externalDependencies` parameter defined in `config.json`.
