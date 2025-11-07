local message = require('feature.message')
local stats = require('feature.internal.stats')

local text = message.build('LuaPack', 'Obfuscation Demo')
print(text)

local numbers = { 1, 2, 3, 4, 5 }
print(('Average: %.2f'):format(stats.average(numbers)))
print(('Checksum: %d'):format(stats.checksum(numbers)))
