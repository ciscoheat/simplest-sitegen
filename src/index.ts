import fs from 'fs-extra'
import debug from 'debug'
// @ts-ignore
import Templator from 'template-html'
import fg from 'fast-glob'
import path from 'upath'
import c from 'ansi-colors'
import { cwd } from 'process'
import { Stats } from 'fs'
import { Options } from 'browser-sync'

import { log } from './utils.js'
import { cacheBust, compileSass, htmlFiles } from './plugins.js'

interface Rename {
  file: string
  content : string | Uint8Array  
}

interface Remove {
  file: 'remove'
}

interface Keep {
  file: 'keep'
}

type ParsedFile = string | Rename | Remove | Keep

type FileParser = (context : Context, file : string, content : string) => Promise<ParsedFile>

type FilesPlugin = {
  extensions: string[],
  parse: FileParser
}

type HtmlParser = {
  template: string
  processContent(content : string) : string
}

const defaultConfig = {
  input: "src" as string,
  output: "build" as string,
  template: "template.html" as string,
  ignoreExtensions: [".sass", ".scss"] as string[],
  devServerOptions: { ui: false, notify: false } as Options,
  sassOptions : {},
  plugins: [] as FilesPlugin[]
}

export type Config = typeof defaultConfig

export type Context = {
  config: Config,
  parser: HtmlParser
}

/////////////////////////////////////////////////////////////////////

const d = debug('simplest')

const start = async (config2? : Partial<Config>) => {
  const config = Object.assign({}, defaultConfig, config2)

  try {
    const userConfig = await import('file:///' + path.join(cwd(), 'simplest.config.js'))
    Object.assign(config, userConfig.default)
  } catch (e) {}

  if(config2)
    Object.assign(config, config2)

  const baseTemplate = path.join(config.input, config.template)

  try {
    // Sanity checks
    await fs.access(baseTemplate)
  } catch(e) {
    throw new Error(`Template file ${baseTemplate} not found!`)
  }

  const parser = new Templator({
    preserveTree: true,
    templateFile: baseTemplate
  }) as HtmlParser

  const context = {
    config,
    parser
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

  ///////////////////////////////////////////////////////////

  const parseAllFiles = (async (plugins : FilesPlugin[]) => {
    const NOT_PARSED = ''

    const fileList = await fg(path.join(config.input, `/**/*.*`))
    const allFiles = new Map<string, string>(fileList.map(f => [f, NOT_PARSED]))
    const plugins2 = [...plugins]

    // Prevent template from being parsed, since it has already been parsed in its own plugins.
    // This also makes it cacheable, because otherwise it would be overwritten here.
    allFiles.delete(config.template)

    const outputFile = (file : string) => path.join(config.output, file.slice(config.input.length))
    const writeFile = (file : string, content : string | Uint8Array) => fs.outputFile(outputFile(file), content)

    const usePlugin = new Map(plugins2.map(p => [p, hasExtension(p.extensions)]))
    const templateMap = new Map<string, string>()

    // Generate template map (dir => template)
    for (const file of allFiles.keys()) {
      const templatePath = path.dirname(file)
      const fileName = path.basename(file)

      if(fileName != config.template) continue

      const templateOutputFile = outputFile(file)
      const templateChanged = await isNewer(file, outputFile(file))

      let templateContent = await fs.readFile(file, {encoding: 'utf8'})

      for (const plugin of plugins) {
        const parsed = await plugin.parse(context, config.template, templateContent)
        if(typeof parsed !== 'string') continue
        templateContent = parsed
      }


      templateMap.set(templatePath, templateContent)
              
      let currentTemplate = null
      if(!templateChanged) {
        try {
          currentTemplate = await fs.readFile(templateOutputFile, {encoding: 'utf8'})
        } catch(e) {}
      }
  
      if(currentTemplate != templateContent) {
        fs.outputFile(templateOutputFile, templateContent)
      }

      // Remove the parsed template(s) from the list so it won't be parsed again
      allFiles.delete(file)
    }

    const parseFile = async (file : string) => {
      let content : string = allFiles.get(file) || NOT_PARSED

      const templateFor = (file : string) => {
        let fileName = file
        while(file && file != '.') {
          file = path.dirname(file)
          if(templateMap.has(file)) return templateMap.get(file)!
        }
        throw new Error('Template not found for ' + fileName)
      }
      
      context.parser.template = templateFor(file)
  
      for (const plugin of plugins2) {
        if(!usePlugin.get(plugin)!(file)) continue

        content = allFiles.get(file) || await fs.readFile(file, {encoding: 'utf8'})

        const parsed = await plugin.parse(context, file, content)

        if(typeof parsed === 'string') {
          content = parsed
        } else if(parsed.file == 'remove') {
          allFiles.delete(file)
          return
        } else if(parsed.file == 'keep') {
          // Pass through unmodified to the next plugin, or just copy at the end
        } else {
          // TODO: Make sure the renamed file is iterated!
          const c = parsed as Rename
          allFiles.set(c.file, c.content.toString())
          allFiles.delete(file)
          return
        }  
      }
      
      allFiles.set(file, content)
    }

    for (const file of allFiles.keys()) {
      // TODO: Check if file or template is newer
      await parseFile(file)
    }
    
    // Copy the parsed and remaining files
    const ignoreFile = hasExtension(config.ignoreExtensions)
    for (const [file, content] of allFiles) {
      if(content) {
        writeFile(file, content)
      } else if(!ignoreFile(file)) {
        const output = outputFile(file)
        
        if(await isNewer(file, output)) {
          await fs.ensureDir(path.dirname(output))
          fs.copy(file, output)
        }
      }
    }
  })
  
  ///// Starting up /////////////////////////////////////////////////

  const run = () => parseAllFiles(config.plugins.concat([compileSass, cacheBust, htmlFiles]))

  return {context, run}
}

export const simplestBuild = async (config? : Partial<Config>) => {
  const build = await start(config)
  const config2 = build.context.config

  await fs.remove(config2.output)
  return build.run()
}

export const simplestWatch = async (config? : Partial<Config>) => {
  const build = await start(config)
  const config2 = build.context.config

  const runWatch = (file : string, root : string, stat : Stats) => {
    log('Updated: ' + file)
    build.run()
  }

  log(c.yellow('Watching for file changes in ') + c.blue(config2.input))

  const sane = (await import('sane')).default
  const watcher = sane(config2.input)

  watcher.on('change', runWatch)
  watcher.on('add', runWatch)
  watcher.on('delete', (file) => {
    log('Deleted: ' + file)
    fs.remove(path.join(config2.output, file))
  })

  await build.run()
  return watcher as any
}

export const simplestDev = async (config? : Partial<Config>) => {
  const build = await start(config)
  const config2 = build.context.config

  await fs.ensureDir(config2.output)
  await simplestWatch(config)
      
  const options = Object.assign({
    server: config2.output,
    files: config2.output
  }, config2.devServerOptions)

  const bs = (await import('browser-sync')).default.create()
  return bs.init(options)
}
