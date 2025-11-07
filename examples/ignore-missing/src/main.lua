local reporter = require('app.present')

print('Ignore Missing Demo')
print('Loaded reporter:', reporter.name)

local ok, missingModule = pcall(require, 'app.missing')
if ok then
    print('Unexpected module found:', missingModule)
else
    print('Module app.missing not found (as expected when ignoreMissing is enabled).')
end
