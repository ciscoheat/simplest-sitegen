import fs from 'fs-extra'
import debug from 'debug'
// @ts-ignore
import Templator from 'template-html'
import fg from 'fast-glob'
import path from 'upath'

import { cacheBust, htmlFiles } from './plugins.js'
import { cwd } from 'process'

type TemplatePlugin = (context : Context, template : string) => Promise<string>

type FilesPlugin = {
  extensions: string[],
  parse: (context : Context, file : string) => Promise<string | Buffer>
}

type HtmlParser = {
  template: string
  processContent(content : string) : string
}

const config = {
  input: "src",
  output: "build",
  template: "src/template.html"
}

const context = {
  config,
  parser: null! // It will be set in start
} as {
  config: typeof config,
  parser: HtmlParser
}

export type Context = typeof context

/////////////////////////////////////////////////////////////////////

const d = debug('simplest')

const outputFile = (file : string) => path.join(config.output, file.slice(config.input.length))

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

const parseTemplate = async (plugins : TemplatePlugin[]) => {
  const {output, template} = config

  const templateOutputFile = path.join(output, path.basename(template))
  const templateChanged = await isNewer(template, templateOutputFile)

  let templateContent = context.parser.template
  for (const plugin of plugins) {
    templateContent = await plugin(context, templateContent)
  }
  context.parser.template = templateContent

  if(templateChanged) {
    fs.outputFile(templateOutputFile, templateContent)
    return true
  }

  const currentTemplate = await fs.readFile(templateOutputFile, {encoding: 'utf8'})

  if(currentTemplate != templateContent) {
    fs.outputFile(templateOutputFile, templateContent)
    return true
  }

  return false
}

const parseFiles = (async (plugins : FilesPlugin[], templateChanged : boolean) => {
  if(templateChanged) d('Template content changed, unconditional update.')

  const allFiles = await fg(path.join(config.input, `/**/*.*`))

  const parseFiles = async (exts : string[], parse : FilesPlugin['parse']) => {
    const files = allFiles.filter((f : string) => exts.some((ext : string) => f.endsWith('.' + ext)))

    let queue = files

    if(!templateChanged) {
      const newer = await Promise.all(files.map((file : string) => isNewer(file, outputFile(file))))
      queue = files.filter((file : string, i : number) => newer[i])
    }

    return queue.map((f : string) => ({
      file: f,
      content: parse(context, f)
    }))
  }

  for (const plugin of plugins) {
    const files = await parseFiles(plugin.extensions, plugin.parse)
    const results = await Promise.allSettled(files.map(f => f.content))
    
    for (const [i, result] of results.entries()) {
      if(result.status != 'fulfilled') continue

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

/////////////////////////////////////////////////////////////////////

const start = async () => {
  try {
    const userConfig = await import('file:///' + path.join(cwd(), 'simplest.config.js'))
    Object.assign(config, userConfig.default)
  } catch (e) {}

  try {
    // Sanity checks
    await fs.access(config.template)
  } catch(e) {
    throw new Error(`Template file ${config.template} not found!`)
  }

  const parser = new Templator({
    preserveTree: true,
    templateFile: config.template
  }) as HtmlParser

  Object.assign(context, {
    config,
    parser
  })
  
  parseTemplate([cacheBust]).then(templateChanged => parseFiles([htmlFiles], templateChanged))
}

start()
