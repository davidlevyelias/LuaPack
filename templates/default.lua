local modules = {}
local require_cache = {}
local original_require = require

local function resolve_module_name(module_name)
    if modules[module_name] then return module_name end
    if module_name:sub(-5) == ".init" then
        local parent = module_name:sub(1, -6)
        if parent ~= "" and modules[parent] then return parent end
        return nil
    end

    local with_init = module_name .. ".init"
    if modules[with_init] then return with_init end
    return nil
end

local require = function(module_name, ...)
    if require_cache[module_name] then return require_cache[module_name] end

    local resolved_name = resolve_module_name(module_name)
    if not resolved_name then
        if original_require then
            local result = original_require(module_name)
            require_cache[module_name] = result
            return result
        end
        error("Module '" .. module_name .. "' not found.")
    end

    if require_cache[resolved_name] then
        local cached = require_cache[resolved_name]
        require_cache[module_name] = cached
        return cached
    end

    local module_func = modules[resolved_name]
    local result = module_func(...)
    require_cache[module_name] = result
    if module_name ~= resolved_name then require_cache[resolved_name] = result end
    return result
end

-- __MODULE_DEFINITIONS__

return require("__ENTRY_MODULE__", ...)
