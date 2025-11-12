local Reporter = require('app.diagnostics.reporter')

local function run()
	print('Ignore Missing Scenario')

	local ok, result = pcall(require, 'app.optional.missing')
	if ok then
		print('Unexpected module found:', result)
		return
	end

	Reporter.logMissing('app.optional.missing', result)
end

run()

return run
