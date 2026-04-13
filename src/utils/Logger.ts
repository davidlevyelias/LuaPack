const LEVELS = {
	error: 0,
	warn: 1,
	info: 2,
	debug: 3,
} as const;

type LogLevelName = keyof typeof LEVELS;
type LogHandler = (...args: unknown[]) => void;

const LEVEL_NAMES = Object.keys(LEVELS) as LogLevelName[];

export class Logger {
	private level: number;
	private readonly handlers: Record<LogLevelName, LogHandler>;

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

	setLevel(levelName?: string): void {
		if (!levelName) {
			return;
		}

		const normalized = String(levelName).toLowerCase();
		if (Object.prototype.hasOwnProperty.call(LEVELS, normalized)) {
			this.level = LEVELS[normalized as LogLevelName];
		}
	}

	getLevel(): LogLevelName | undefined {
		return LEVEL_NAMES.find((name) => LEVELS[name] === this.level);
	}

	shouldLog(levelName: string): boolean {
		const normalized = String(levelName).toLowerCase();
		if (!Object.prototype.hasOwnProperty.call(LEVELS, normalized)) {
			return false;
		}

		return LEVELS[normalized as LogLevelName] <= this.level;
	}

	log(levelName: string, ...args: unknown[]): void {
		if (!this.shouldLog(levelName)) {
			return;
		}

		const normalized = String(levelName).toLowerCase();
		const handler = Object.prototype.hasOwnProperty.call(
			this.handlers,
			normalized
		)
			? this.handlers[normalized as LogLevelName]
			: console.log.bind(console);
		handler(...args);
	}

	error(...args: unknown[]): void {
		this.log('error', ...args);
	}

	warn(...args: unknown[]): void {
		this.log('warn', ...args);
	}

	info(...args: unknown[]): void {
		this.log('info', ...args);
	}

	debug(...args: unknown[]): void {
		this.log('debug', ...args);
	}
}

const logger = new Logger();

export default logger;

module.exports = logger;
module.exports.Logger = Logger;
