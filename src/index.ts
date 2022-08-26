import fs from 'fs-extra'
import debug from 'debug'
// @ts-ignore
import Templator from 'template-html'
import fg from 'fast-glob'
import path from 'upath'
import c from 'ansi-colors'

import { cacheBust, compileSass, htmlFiles } from './plugins.js'
import { cwd } from 'process'
import { Stats } from 'fs'
import { Options } from 'browser-sync'
import sane from 'sane'

type TemplatePlugin = (context : Context, template : string) => Promise<string>

interface Rename {
  file: string
  content : string | Buffer  
}

interface Remove {
  file: 'remove'
}

interface Keep {
  file: 'keep'
}

type FilesPlugin = {
  extensions: string[],
  parse: (context : Context, file : string) => Promise<string | Buffer | Rename | Remove | Keep>
}

type HtmlParser = {
  template: string
  processContent(content : string) : string
}

const defaultConfig = {
  input: "src" as string,
  output: "build" as string,
  template: "src/template.html" as string,
  ignoreExtensions: [".sass", ".scss"] as string[],
  devServerOptions: { ui: false, notify: false } as Options,
  templatePlugins: [] as TemplatePlugin[],
  filesPlugins: [] as FilesPlugin[]
}

export type Config = typeof defaultConfig

export type Context = {
  config: Config,
  parser: HtmlParser
}

/////////////////////////////////////////////////////////////////////

const d = debug('simplest')

/////////////////////////////////////////////////////////////////////

const start = async (config2? : Partial<Config>) => {
  const config = Object.assign({}, defaultConfig, config2)

  try {
    const userConfig = await import('file:///' + path.join(cwd(), 'simplest.config.js'))
    Object.assign(config, userConfig.default)
  } catch (e) {}

  if(config2)
    Object.assign(config, config2)

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

  const originalTemplate = parser.template

  const context = {
    config,
    parser
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  const outputFile = (file : string) => path.join(config.output, file.slice(config.input.length))

  const isNewer = (src : string, dest : string) => Promise.all([fs.stat(src), fs.stat(dest)])
    .then(([src1, dest1]) => {
      const output : boolean = src1.mtimeMs > dest1.mtimeMs
      //d(`${path.basename(src)}: ${output ? 'newer than output' : 'NOT newer than output'}`)
      return output
    })
    .catch(e => { 
      //d(`${path.basename(src)}: output didn't exist`)
      return true
    })

  const hasExtension = (exts : string[]) => (input : string) => exts.some(ext => input.endsWith(`${ext}`))
  const hasntExtension = (exts : string[]) => (input : string) => !exts.some(ext => input.endsWith(`${ext}`))

  ///////////////////////////////////////////////////////////

  const parseTemplate = async (plugins : TemplatePlugin[]) => {
    const {output, template} = config

    const templateOutputFile = path.join(output, path.basename(template))
    const templateChanged = await isNewer(template, templateOutputFile)

    let templateContent = originalTemplate
    for (const plugin of plugins) {
      templateContent = await plugin(context, templateContent)
    }
    context.parser.template = templateContent

    if(templateChanged) {
      await fs.outputFile(templateOutputFile, templateContent)
      return true
    }

    let currentTemplate = null
    try {
      currentTemplate = await fs.readFile(templateOutputFile, {encoding: 'utf8'})
    } catch(e) {}

    if(currentTemplate != templateContent) {
      await fs.outputFile(templateOutputFile, templateContent)
      return true
    }

    return false
  }

  const parseFiles = (async (plugins : FilesPlugin[], templateChanged : boolean) => {
    const allFiles = new Set(await fg(path.join(config.input, `/**/*.*`)))
    // Prevent template from being parsed, since it has already been parsed in its own plugins.
    // This also makes it cacheable, because otherwise it would be overwritten here.
    allFiles.delete(config.template)

    const parseFiles = async (exts : string[], parse : FilesPlugin['parse']) => {
      const files = Array.from(allFiles).filter(hasExtension(exts))

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

      for (const parsed of files) {
        const content = await parsed.content
        const removeFile = () => allFiles.delete(parsed.file)

        if(typeof content === 'string' || Buffer.isBuffer(content)) {
          fs.outputFile(outputFile(parsed.file), content)
          removeFile()
        } else if(content.file == 'remove') {
          removeFile()
        } else if(content.file == 'keep') {
          // Pass through
        } else {
          const c = content as Rename
          fs.outputFile(outputFile(c.file), c.content)
          removeFile()
        }
      }
    }

    // Copy the remaining files
    for (const file of [...allFiles].filter(hasntExtension(config.ignoreExtensions))) {
      const output = outputFile(file)
      if(!await isNewer(file, output)) continue
      fs.outputFile(output, await fs.readFile(file))
    }
  })
  
  ///// Starting up /////////////////////////////////////////////////

  const run = () => parseTemplate(config.templatePlugins.concat([compileSass, cacheBust]))
    .then(templateChanged => parseFiles(config.filesPlugins.concat([htmlFiles]), templateChanged))

  return {context, run}
}

export const simplestBuild = async (config? : Config) => {
  const run = await start(config)
  const config2 = run.context.config

  await fs.remove(config2.output)
  return run.run()
}

export const simplestWatch = async (config? : Config) => {
  const run = await start(config)
  const config2 = run.context.config

  const runWatch = (file : string, root : string, stat : Stats) => {
    console.log('Updated: ' + file)
    run.run()
  }

  console.log(c.yellow('Watching for file changes in ') + c.blue(config2.input))

  const sane = (await import('sane')).default
  const watcher = sane(config2.input)

  watcher.on('change', runWatch)
  watcher.on('add', runWatch)
  watcher.on('delete', (file) => {
    console.log('Deleted: ' + file)
    fs.remove(path.join(config2.output, file))
  })

  await run.run()
  return watcher as any
}

export const simplestDev = async (config? : Config) => {
  const run = await start(config)
  const config2 = run.context.config

  await fs.ensureDir(config2.output)
  await simplestWatch(config)
      
  const options = Object.assign({
    server: config2.output,
    files: config2.output
  }, config2.devServerOptions)

  const bs = (await import('browser-sync')).default.create()
  return bs.init(options)
}
