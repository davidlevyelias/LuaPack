local Message = {}

function Message.build(product, label)
    return ('%s :: %s ready to bundle!'):format(product, label)
end

return Message
