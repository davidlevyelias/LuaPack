local message = require('lib.message')

local Greeter = {}

function Greeter.greet(name)
	return ('Hello, %s %s'):format(name, message.suffix())
end

return Greeter