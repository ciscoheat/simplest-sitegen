import c from 'ansi-colors'
import fs, { Stats } from 'fs-extra'

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

export const isNewer = async (src : string, dest : string) => {
  let dest1 : Stats
  try {
    dest1 = await fs.stat(dest)
  } catch(e) {
    return true
  }

  const src1 = await fs.stat(src)
  return src1.mtimeMs > dest1.mtimeMs
}
