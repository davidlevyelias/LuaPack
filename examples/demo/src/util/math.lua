local MathUtils = {}

function MathUtils.add(a, b)
	return a + b
end

function MathUtils.multiply(a, b)
	return a * b
end

function MathUtils.count(values)
	local total = 0
	for _ in ipairs(values) do
		total = total + 1
	end
	return total
end

function MathUtils.sum(values)
	local total = 0
	for _, value in ipairs(values) do
		total = total + value
	end
	return total
end

function MathUtils.average(values)
	if #values == 0 then
		return 0
	end
	return MathUtils.sum(values) / #values
end

function MathUtils.checksum(values)
	local checksum = 0
	for index, value in ipairs(values) do
		checksum = (checksum + value * index) % 997
	end
	return checksum
end

return MathUtils
