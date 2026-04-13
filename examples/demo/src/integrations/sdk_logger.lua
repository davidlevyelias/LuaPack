local sdkLogger = require('sdk.src.logger')

local Logger = {}

function Logger.info(message)
	sdkLogger.info('[demo] ' .. message)
end

function Logger.debug(message)
	sdkLogger.debug('[demo] ' .. message)
end

return Logger
