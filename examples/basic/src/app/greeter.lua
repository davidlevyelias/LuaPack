local Greeter = {}
Greeter.__index = Greeter

function Greeter.new(name)
    local self = setmetatable({}, Greeter)
    self.name = name or 'Guest'
    return self
end

function Greeter:greet()
    return ('Hello from %s!'):format(self.name)
end

return Greeter
