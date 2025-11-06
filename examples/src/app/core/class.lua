local MyClass = {}
MyClass.__index = MyClass

function MyClass.new(name)
    local self = setmetatable({}, MyClass)
    self.name = name
    return self
end

function MyClass:greet()
    return "Hello from " .. self.name
end

return MyClass
