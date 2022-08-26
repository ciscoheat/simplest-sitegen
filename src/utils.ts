import c from 'ansi-colors'

/**
 * Hash using djb2
 */
 export const hash = (value : string | Uint8Array) => {
	let hash = 5381;
	let i = value.length;

	if (typeof value === 'string') {
		while (i) hash = (hash * 33) ^ value.charCodeAt(--i)
	} else {
		while (i) hash = (hash * 33) ^ value[--i]
	}

	return (hash >>> 0).toString(36)
}

export const log = (value : string) => {
	value = `[${c.blueBright('simplest')}] ${value}`
	console.log(process.stdout.isTTY ? value : c.unstyle(value))
}
