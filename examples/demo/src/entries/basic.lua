local Greeter = require('app.greeter')
local DemoClass = require('app.core.class')
local mathUtils = require('util.math')
local Reporter = require('app.diagnostics.reporter')
local message = require('app.analytics.message')
local logger = require('sdk.logger')
local json = require('dkjson')

local function run()
	local greeter = Greeter.new('LuaPack user')
	print(greeter:greet())

	local demoInstance = DemoClass.new('demo pipeline')
	print(demoInstance:greet())
	print(demoInstance:greet())

	local values = { 1, 2, 3, 4, 5 }
	local stats = {
		moduleCount = mathUtils.count(values),
		average = mathUtils.average(values),
		checksum = mathUtils.checksum(values),
	}

	print(message.build('LuaPack', 'Unified Example'))
	print(Reporter.buildSummary('Basic Scenario', stats))

	logger.info('This is a log message from the external SDK module.')
end

run()

return run
