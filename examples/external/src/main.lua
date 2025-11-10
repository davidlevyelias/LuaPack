local logger = require('sdk.logger')
local json = require('dkjson')
local missing = require('src.missing')  -- This module does not exist

logger.info('External module resolution working!')
logger.debug('This message only shows in verbose mode.')
