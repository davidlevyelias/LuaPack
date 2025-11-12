local sub_logger = require('sub_logger')

local Logger = {}
Logger.__index = Logger

function Logger.info(message)
	print("SubLogger value: " .. sub_logger.value)
	print('[external-info] ' .. message)
end

function Logger.debug(message)
	if os.getenv('SDK_LOG_VERBOSE') == '1' then
		print('[external-debug] ' .. message)
	end
end

return Logger
