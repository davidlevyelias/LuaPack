local sdkLogger = require('integrations.sdk_logger')
local JsonAdapter = require('integrations.json_adapter')

local function run()
	sdkLogger.info('External scenario running')

	local encoded = JsonAdapter.encode()
	sdkLogger.debug(('Encoded payload length: %d'):format(#encoded))

	local decoded = JsonAdapter.decode(encoded)
	sdkLogger.info(('Decoded items: %d'):format(#decoded.items))
end

run()

return run
