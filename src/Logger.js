const LEVELS = {
	error: 0,
	warn: 1,
	info: 2,
	debug: 3,
};

const LEVEL_NAMES = Object.keys(LEVELS);

class Logger {
	constructor() {
		this.level = LEVELS.info;
		this.handlers = {
			error: console.error.bind(console),
			warn: console.warn.bind(console),
			info: console.log.bind(console),
			debug: console.debug
				? console.debug.bind(console)
				: console.log.bind(console),
		};
	}

	setLevel(levelName) {
		if (!levelName) {
			return;
		}
		const normalized = String(levelName).toLowerCase();
		if (LEVELS.hasOwnProperty(normalized)) {
			this.level = LEVELS[normalized];
		}
	}

	getLevel() {
		return LEVEL_NAMES.find((name) => LEVELS[name] === this.level);
	}

	shouldLog(levelName) {
		const normalized = String(levelName).toLowerCase();
		const value = LEVELS[normalized];
		return typeof value === 'number' && value <= this.level;
	}

	log(levelName, ...args) {
		if (!this.shouldLog(levelName)) {
			return;
		}
		const handler = this.handlers[levelName] || console.log.bind(console);
		handler(...args);
	}

	error(...args) {
		this.log('error', ...args);
	}

	warn(...args) {
		this.log('warn', ...args);
	}

	info(...args) {
		this.log('info', ...args);
	}

	debug(...args) {
		this.log('debug', ...args);
	}
}

const logger = new Logger();

module.exports = logger;
module.exports.Logger = Logger;
