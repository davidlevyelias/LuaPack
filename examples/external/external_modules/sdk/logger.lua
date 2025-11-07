local Logger = {}
Logger.__index = Logger

function Logger.info(message)
    print('[external-info] ' .. message)
end

function Logger.debug(message)
    if os.getenv('SDK_LOG_VERBOSE') == '1' then
        print('[external-debug] ' .. message)
    end
end

return Logger
