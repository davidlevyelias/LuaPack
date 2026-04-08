local modules = {}
local require_cache = {}
local require_loaded = {}
local original_require = require
local external_modules = {
-- __EXTERNAL_MODULES__
}
local package_prefixes = {
-- __PACKAGE_PREFIXES__
}

local function find_declared_package(module_name)
    for _, prefix in ipairs(package_prefixes) do
        if module_name == prefix then
            return prefix
        end

        local candidate = prefix .. "."
        if module_name:sub(1, #candidate) == candidate then
            return prefix
        end
    end

    return nil
end

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

local function resolve_scoped_name(package_name, module_name)
    local declared_package = find_declared_package(module_name)
    if declared_package then
        return module_name
    end

    if package_name and package_name ~= "default" then
        return package_name .. "." .. module_name
    end

    return module_name
end

local function __lp_require_absolute(module_name, ...)
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

local function __lp_require_scoped(package_name)
    return function(module_name, ...)
        local scoped_name = resolve_scoped_name(package_name, module_name)
        return __lp_require_absolute(scoped_name, ...)
    end
end

local function __lp_require(module_name, ...)
    local scoped_name = resolve_scoped_name("__ENTRY_PACKAGE__", module_name)
    return __lp_require_absolute(scoped_name, ...)
end

local require = __lp_require_scoped("__ENTRY_PACKAGE__")

-- __MODULE_DEFINITIONS__

return __lp_require("__ENTRY_MODULE__", ...)