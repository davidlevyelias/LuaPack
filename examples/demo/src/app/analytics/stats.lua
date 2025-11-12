local mathUtils = require('util.math')

local Stats = {}

function Stats.describe(values)
	local count = mathUtils.count(values)
	local average = mathUtils.average(values)
	local checksum = mathUtils.checksum(values)

	return {
		count = count,
		average = average,
		checksum = checksum,
	}
end

return Stats
