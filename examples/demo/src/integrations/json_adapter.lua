local json = require('dkjson')
local sample = require('app.data.sample')

local JsonAdapter = {}

function JsonAdapter.encode()
	return json.encode(sample)
end

function JsonAdapter.decode(payload)
	return json.decode(payload)
end

return JsonAdapter
