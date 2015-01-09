# Release history

## 0.1.2 Script sub-folder
Allowing scripts of a component to live in sub-folders.
It will throw if a script is required outside the roo.


## 0.1.1 Node API
Component-extractor can be launch from JavaScript with a `config` object.
```javascript
var extractor = require('component-extractor');
var config = {
	sourcePaths: ['www'],
	excludePaths: ['bin', 'lib'],
	externalDependencies: {
		async:  { path: 'caolan/async', components: '0.9.0' },
		inherit: { path: 'component/inherit', components: '*' }
	}
};
extractor.execute(config, function (error) {
	if (error) return error;
});
```

## 0.0.0 initial release
