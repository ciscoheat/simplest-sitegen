import fs from 'fs-extra'
import debug from 'debug'
// @ts-ignore
import Templator from 'template-html'
import fg from 'fast-glob'
import path from 'upath'
import { parse } from 'node-html-parser'

interface ParsedElement {
  attributes: Record<string, string>
  setAttribute(name : string, value : string) : void
}

const d = debug('simplest')

const config = {
  input: "site",
  output: "build",
   template: "site/template.html"
}

try {
  //Object.assign(config, import('./simplest.config'))
} catch(e) {
  //console.log(e)
}

const {input, output, template} = config

const templateParser = new Templator({
  preserveTree: true,
  templateFile: template
})

/////////////////////////////////////////////////////////////////////

/**
 * Hash using djb2
 */
function hash(value : string | Buffer) {
	let hash = 5381;
	let i = value.length;

	if (typeof value === 'string') {
		while (i) hash = (hash * 33) ^ value.charCodeAt(--i);
	} else {
		while (i) hash = (hash * 33) ^ value[--i];
	}

	return (hash >>> 0).toString(36);
}

const outputFile = (file : string) => path.join(output, file.slice(input.length))

const isNewer = (src : string, dest : string) => Promise.all([fs.stat(src), fs.stat(dest)])
  .then(([src1, dest1]) => {
    const output = src1.mtimeMs > dest1.mtimeMs
    //d(`${path.basename(src)}: ${output ? 'newer than output' : 'NOT newer than output'}`)
    return output
  })
  .catch(e => { 
    //d(`${path.basename(src)}: output didn't exist`)
    return true
  })

///////////////////////////////////////////////////////////

// Cache-bust referenced files in template
const cacheBust = async () => {
  const root = parse(templateParser.template, {comment: true})

  const includeScript = (el : ParsedElement, attr : string) : boolean =>
    !!el.attributes[attr] &&
    !el.attributes[attr].includes('?') &&
    !el.attributes[attr].includes('//')

  const scripts  = (selector : string, attr : string) => root.querySelectorAll(selector)
    .filter((el : ParsedElement) => includeScript(el, attr))
    .map((el : ParsedElement) => ({
      el,
      attr,
      file: el.attributes[attr]
    })) as {el: ParsedElement, attr: string, file: string}[]

  const cssFiles = scripts('link', 'href')
  const jsFiles = scripts('script', 'src')

  const scriptFiles = jsFiles.concat(cssFiles)

  const filesChanged = await Promise.allSettled(scriptFiles
    .map(script => [
      path.join(input, script.file),
      outputFile(path.join(input, script.file))
    ])
    .map(([src, dest]) => isNewer(src, dest))
  )

  const anyFileChanged = filesChanged.map(f => f.status == 'fulfilled' && f.value == true).includes(true)

  const content = await Promise.allSettled(scriptFiles
    .map(script => path.join(input, script.file))
    .map(file => fs.readFile(file))
  )

  content.forEach((res, i) => {
    if(res.status != 'fulfilled') return
    const {el, attr, file} = scriptFiles[i]
    el.setAttribute(attr, file + '?' + hash(res.value))
  })

  templateParser.template = root.toString()

  const templateOutputFile = path.join(output, path.basename(template))
  const templateChanged = await isNewer(template, templateOutputFile)

  if(templateChanged) {
    d('Template file changed, updating')
    fs.outputFile(templateOutputFile, templateParser.template)
  }

  return anyFileChanged || templateChanged
}

// TODO: Ignore files

const htmlFiles = {
  extensions: ['html', 'htm'],
  parse: async (file : string) => {
    const content = await fs.readFile(file)

    return content.includes('<!-- build:content -->')
      ? templateParser.processContent(content.toString('utf8')) as string
      : content
  }
}

const pluginChain = [htmlFiles]

// Parse plugin chain backwards, filter out files

cacheBust().then(async templateChanged => {
  if(templateChanged) d('Template content changed, unconditional update.')

  const allFiles = await fg(path.join(input, `/**/*.*`))

  const parseFiles = async (exts : string[], parse : (file : string) => Promise<string | Buffer>) => {
    const files = allFiles.filter((f : string) => exts.some((ext : string) => f.endsWith('.' + ext)))

    let queue = files

    if(!templateChanged) {
      const newer = await Promise.all(files.map((file : string) => isNewer(file, outputFile(file))))
      queue = files.filter((file : string, i : number) => newer[i])
    }

    return queue.map((f : string) => ({
      file: f,
      content: parse(f)
    }))
  }

  const plugins = Array.from(pluginChain).reverse()
  
  for (const plugin of plugins) {
    const files = await parseFiles(plugin.extensions, plugin.parse)
    const results = await Promise.allSettled(files.map(f => f.content))
    
    for (const [i, result] of results.entries()) {
      if(result.status != 'fulfilled') {
        //d('Did not update ' + files[i].file)
        continue
      }
      //d('Updating ' + files[i].file)

      fs.outputFile(outputFile(files[i].file), result.value)
      allFiles.splice(allFiles.indexOf(files[i].file), 1)
    }
  }

  // Copy the remaining files
  for (const file of allFiles) {
    const output = outputFile(file)
    if(!await isNewer(file, output)) continue
    fs.outputFile(output, await fs.readFile(file))
  }
})
