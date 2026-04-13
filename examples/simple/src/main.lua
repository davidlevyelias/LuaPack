local greeter = require('lib.greeter')

return {
	message = greeter.greet('LuaPack'),
	version = 'simple-basic',
}