"use strict";

let registered = false;

function ensureTsNode() {
	if (registered) {
		return;
	}
	try {
		require('ts-node/register/transpile-only');
		registered = true;
	} catch (error) {
		throw new Error(
			"Unable to load TypeScript runtime. Install 'ts-node' to execute ModuleCollectionBuilder.ts."
		);
	}
}

ensureTsNode();

const moduleExports = require('./ModuleCollectionBuilder.ts');

module.exports = moduleExports;
