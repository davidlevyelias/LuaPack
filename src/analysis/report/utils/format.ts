export function formatBytes(size: number): string {
	if (!Number.isFinite(size) || size <= 0) {
		return '0 B';
	}
	const units = ['B', 'KB', 'MB', 'GB'];
	let index = 0;
	let current = size;
	while (current >= 1024 && index < units.length - 1) {
		current /= 1024;
		index += 1;
	}
	const precision = index === 0 ? 0 : 2;
	return `${current.toFixed(precision)} ${units[index]}`;
}
