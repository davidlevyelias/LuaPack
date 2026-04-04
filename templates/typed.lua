---@alias __lp_ModuleLoader fun(...): any

-- __TYPE_DECLARATIONS__

---@type table<string, __lp_ModuleLoader>
local modules = {}
---@type table<string, any>
local require_cache = {}
---@type table<string, boolean>
local require_loaded = {}
local original_require = require
---@type table<string, boolean>
local external_modules = {
-- __EXTERNAL_MODULES__
}

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

local function can_fallback(module_name)
-- __FALLBACK_LOGIC__
end

---@param module_name string
local function __lp_require(module_name, ...)
    if require_loaded[module_name] then return require_cache[module_name] end

    local resolved_name = resolve_module_name(module_name)
    if not resolved_name then
        if can_fallback(module_name) and original_require then
            local result = original_require(module_name)
            require_cache[module_name] = result
            require_loaded[module_name] = true
            return result
        end
        error("Module '" .. module_name .. "' not found.")
    end

    if require_loaded[resolved_name] then
        local cached = require_cache[resolved_name]
        require_cache[module_name] = cached
        require_loaded[module_name] = true
        return cached
    end

    local module_func = modules[resolved_name]
    local result = module_func(...)
    require_cache[resolved_name] = result
    require_loaded[resolved_name] = true
    require_cache[module_name] = result
    require_loaded[module_name] = true
    return result
end

local require = __lp_require

-- __MODULE_DEFINITIONS__

return __lp_require("__ENTRY_MODULE__", ...)