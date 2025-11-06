const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const SCHEMA_PATH = path.resolve(__dirname, '..', '..', 'config.schema.json');

let validator;

function getValidator() {
    if (!validator) {
        const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
        const ajv = new Ajv({ allErrors: true, useDefaults: true, strict: false });
        validator = ajv.compile(schema);
    }
    return validator;
}

function formatErrors(errors) {
    return errors.map(err => {
        const dataPath = err.instancePath || err.dataPath || '';
        const location = dataPath ? `property '${dataPath.replace(/^\./, '')}'` : 'configuration root';
        return `- ${location}: ${err.message}`;
    }).join('\n');
}

function readConfigFile(configPath) {
    const resolvedPath = path.resolve(configPath);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Config file not found at ${resolvedPath}`);
    }

    let parsed;
    try {
        const raw = fs.readFileSync(resolvedPath, 'utf-8');
        parsed = JSON.parse(raw);
    } catch (error) {
        throw new Error(`Failed to read config file '${resolvedPath}': ${error.message}`);
    }

    return { config: parsed, baseDir: path.dirname(resolvedPath) };
}

function mergeConfig(baseConfig, cliOptions) {
    const merged = { ...baseConfig };

    if (cliOptions.entry) {
        merged.entry = cliOptions.entry;
    }

    if (cliOptions.output) {
        merged.output = cliOptions.output;
    }

    if (cliOptions.sourceroot) {
        merged.sourceRoot = cliOptions.sourceroot;
    }

    if (cliOptions.obfuscation) {
        merged.obfuscation = {
            ...(merged.obfuscation || {}),
            tool: cliOptions.obfuscation,
        };
    }

    return merged;
}

function normalizePaths(config, cliOptions, fileBaseDir) {
    const finalConfig = { ...config };
    const cwd = process.cwd();
    const baseDir = fileBaseDir || cwd;

    if (finalConfig.entry) {
        const origin = cliOptions.entry ? cwd : baseDir;
        finalConfig.entry = path.resolve(origin, finalConfig.entry);
    }

    if (finalConfig.output) {
        const origin = cliOptions.output ? cwd : baseDir;
        finalConfig.output = path.resolve(origin, finalConfig.output);
    }

    if (finalConfig.sourceRoot) {
        const origin = cliOptions.sourceroot ? cwd : baseDir;
        finalConfig.sourceRoot = path.resolve(origin, finalConfig.sourceRoot);
    }

    if (finalConfig.modules && finalConfig.modules.external && Array.isArray(finalConfig.modules.external.paths)) {
        const origin = baseDir;
        finalConfig.modules.external.paths = finalConfig.modules.external.paths.map(p => path.isAbsolute(p) ? p : path.resolve(origin, p));
    }

    return finalConfig;
}

function loadConfig(cliOptions = {}) {
    const validatorInstance = getValidator();

    let fileConfig = {};
    let baseDir;

    if (cliOptions.config) {
        const result = readConfigFile(cliOptions.config);
        fileConfig = result.config;
        baseDir = result.baseDir;
    }

    const merged = mergeConfig(fileConfig, cliOptions);

    const configCopy = JSON.parse(JSON.stringify(merged));
    const valid = validatorInstance(configCopy);
    if (!valid) {
        const details = formatErrors(validatorInstance.errors || []);
        throw new Error(`Invalid configuration:\n${details}`);
    }

    if (!configCopy.entry) {
        throw new Error('Configuration must specify an entry file.');
    }

    return normalizePaths(configCopy, cliOptions, baseDir);
}

module.exports = {
    loadConfig,
};
