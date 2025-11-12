local TextUtils = {}

function TextUtils.capitalize(value)
	if type(value) ~= 'string' or #value == 0 then
		return ''
	end
	return value:sub(1, 1):upper() .. value:sub(2)
end

function TextUtils.join(separator, values)
	return table.concat(values, separator)
end

return TextUtils
