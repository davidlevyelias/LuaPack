local Stats = {}

function Stats.average(values)
    local total = 0
    for _, value in ipairs(values) do
        total = total + value
    end
    return total / #values
end

function Stats.checksum(values)
    local checksum = 0
    for index, value in ipairs(values) do
        checksum = (checksum + value * index) % 997
    end
    return checksum
end

return Stats
