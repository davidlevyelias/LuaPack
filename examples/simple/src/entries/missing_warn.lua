local greeter = require('lib.greeter')
local optional = require('missing.optional')

return {
	message = greeter.greet('warning-mode'),
	optional = optional,
}