local Greeter = require('app.greeter')
local mathUtils = require('util.math')
local version = require('vendor.version')
local MyClass = require('app.core.class')

local greeterInstance = Greeter.new('LuaPack User')
print(greeterInstance:greet())

local myClassInstance = MyClass.new('MyClass Instance')
print(myClassInstance:greet())

local sum = mathUtils.add(2, 3)
print(('2 + 3 = %d'):format(sum))

print(('Current example version: %s'):format(version.info()))
