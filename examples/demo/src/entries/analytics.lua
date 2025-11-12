local Stats = require('app.analytics.stats2')
local Reporter = require('app.diagnostics.reporter')
local sample = require('app.data.sample')
local message = require('app.analytics.message')

local function run()
	local values = sample.items
	local description = Stats.describe(values)

	print(message.build('LuaPack', 'Analytics Scenario'))
	print(Reporter.buildSummary('Analytics Scenario', description))
end

run()

return run
