local textUtils = require('util.text')

local DemoClass = {}
DemoClass.__index = DemoClass

function DemoClass.new(name)
	local self = setmetatable({}, DemoClass)
	self.name = textUtils.capitalize(name or 'anonymous')
	self.invocations = 0
	return self
end

function DemoClass:greet()
	self.invocations = self.invocations + 1
	return ('[%d] Hello from %s'):format(self.invocations, self.name)
end

return DemoClass
