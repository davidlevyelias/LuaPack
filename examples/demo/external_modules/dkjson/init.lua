local DKJSON = {}

function DKJSON.encode(value)
	if type(value) ~= 'table' then
		return 'null'
	end

	local items = value.items or {}
	local buffer = { '{"items":[' }

	for index, item in ipairs(items) do
		buffer[#buffer + 1] = tostring(item)
		if index < #items then
			buffer[#buffer + 1] = ','
		end
	end

	buffer[#buffer + 1] = ']}'
	return table.concat(buffer)
end

function DKJSON.decode(payload)
	local decoded = {
		items = {},
	}

	for number in payload:gmatch('%d+') do
		decoded.items[#decoded.items + 1] = tonumber(number)
	end

	return decoded
end

return DKJSON
