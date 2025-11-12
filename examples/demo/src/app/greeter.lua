local textUtils = require('util.text')

local Greeter = {}
Greeter.__index = Greeter

function Greeter.new(name)
	local self = setmetatable({}, Greeter)
	self.name = textUtils.capitalize(name or 'guest')
	return self
end

function Greeter:greet()
	return ('Hello from %s!'):format(self.name)
end

return Greeter
