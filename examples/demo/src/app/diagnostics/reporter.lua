local textUtils = require('util.text')
local versionInfo = require('vendor.version')

local Reporter = {}

function Reporter.buildSummary(title, stats)
	local lines = {
		('=== %s ==='):format(title),
		('Version: %s'):format(versionInfo.info()),
		('Modules Evaluated: %d'):format(stats.moduleCount or 0),
		('Average Metric: %.2f'):format(stats.average or 0),
		('Checksum: %d'):format(stats.checksum or 0),
	}
	return textUtils.join('\n', lines)
end

function Reporter.logMissing(moduleId, message)
	local reason = message or 'Module was not located.'
	print(('[missing] %s -> %s'):format(moduleId, reason))
end

return Reporter
