import type { LoggerLike } from '../../modelUtils';

type LoggerMethod = 'info' | 'warn' | 'error';

export function emitLoggerLines(
	logger: LoggerLike,
	method: LoggerMethod,
	lines: string[],
	{ leadingBlank = false }: { leadingBlank?: boolean } = {}
): void {
	if (lines.length === 0) {
		return;
	}

	const write = logger[method];
	if (!write) {
		return;
	}

	if (leadingBlank) {
		write('');
	}

	lines.forEach((line) => write(line));
}
