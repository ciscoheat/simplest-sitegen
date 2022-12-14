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
import { pathToFileURL } from 'url'
import { debounce } from 'throttle-debounce'

import { log, isNewer } from './utils.js'
import { cacheBust, compileSass, htmlFiles, markdown, compilePug, compileSvelte } from './plugins.js'

interface Rename {
  file: string
  content : string | Uint8Array
}

interface Remove {
  file: string
  action: 'remove'
}

type ParsedFile = string | Rename | Remove | (string | Rename | Remove)[]

type FileParseFunction = (context : Context, file : string, content : string) => Promise<ParsedFile>

type FilesParser = {
  parse: FileParseFunction
}

type FilesPlugin = FilesParser & {
  extensions: string[]
}

type HtmlParser = {
  template: string
  processContent(content : string) : string
}

const defaultConfig = {
  input: "src" as string,
  output: "build" as string,
  template: "template.html" as string,
  htmlExtensions: [".html", ".htm"],
  sourceExtensions: [".sass", ".scss", ".pug", ".svelte"] as string[],
  passThrough: [],
  devServerOptions: { ui: false, notify: false } as Options,
  sassOptions: {style: "compressed"},
  markdownOptions: {},
  pugOptions: {} as import('pug').Options,
  plugins: [] as (FilesPlugin | FilesParser)[],
  verbose: false as boolean
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

  {
  try {
    const userConfigFile = path.join(cwd(), 'simplest.config.js')
    await fs.access(userConfigFile)

    try {
      const userConfig = await import(pathToFileURL(userConfigFile).toString())
      Object.assign(config, userConfig.default)
    } catch (e) {
      log('Could not import simplest.config.js. Did you add "type": "module" to package.json?')
    }
  } catch(e) {
    // File doesn't exist, keep going
  }

  if(config2)
    Object.assign(config, config2)

  }
      
  const baseTemplate = path.join(config.input, config.template)

    // Sanity checks
  try {
    await fs.access(baseTemplate)
  } catch(e) {
    throw new Error(`Template file ${baseTemplate} not found!`)
  }

  const parser = new Templator({
    preserveTree: true,
    templateFile: baseTemplate
  }) as HtmlParser

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  const hasExtension = (exts : string[]) => (input : string) => exts.some(ext => input.endsWith(`${ext}`))

  ///////////////////////////////////////////////////////////

  const parseAllFiles = async (plugins : FilesPlugin[]) => {
    const context = {
      config,
      parser
    }
      
    const NOT_PARSED = ''

    const fileList = await fg(path.join(config.input, `/**/*.*`))    
    const passThroughFiles = new Set(await fg(config.passThrough.map(glob => path.join(config.input, glob))))
    const allFiles = new Map<string, string>(fileList.map(f => [f, NOT_PARSED]))

    const plugins2 = [...plugins]

    const outputFileName = (file : string) => path.join(config.output, file.slice(config.input.length))
    const writeFile = async (file : string, content : string | Uint8Array) => fs.outputFile(outputFileName(file), content)

    const allPluginExtensions = new Set(plugins.flatMap(p => p.extensions))
    const willUsePlugin = hasExtension(Array.from(allPluginExtensions))

    const usePluginMap = new Map(plugins2.map(p => [p, hasExtension(p.extensions)]))
    const usePlugin = (plugin : FilesPlugin, file : string) => usePluginMap.get(plugin)!(file)
    
    const templateMap = new Map<string, string>()

    /////////////////////////////////////////////////////////////////

    // Issue a warning if files only differ by extension
    {      
      const duplicate = new Map()
      for (const file of allFiles.keys()) {
        if(passThroughFiles.has(file)) continue
        if(!willUsePlugin(file)) continue
        
        const name = path.trimExt(file)
        if(duplicate.has(name))
          log(c.red('Warning:') + ` ${c.magenta(file)} and ${c.magenta(duplicate.get(name))} exists in the same directory and could overwrite each other`)
        else {
          duplicate.set(name, file)
        }
      }
    }
    
    const parsePlugin = async (plugin : FilesPlugin, file : string, content : string) => {
      if(!usePlugin(plugin, file)) return content

      let actions = await plugin.parse(context, file, content)
      if(!Array.isArray(actions)) actions = [actions]

      let parsedContent = content

      for (const parsed of actions) {
        if(typeof parsed === 'string') {
          parsedContent = parsed
        } else if('content' in parsed) {
          allFiles.set(parsed.file, parsed.content.toString())
          allFiles.delete(file)
        } else if(parsed.action == 'remove') {
          allFiles.delete(parsed.file)
        } else {
          throw new Error('Unknown parsed value for ' + file + ': ' + parsed)
        }  
      }

      return parsedContent
    }  

    // Generate template map (dir => template)
    for (const file of allFiles.keys()) {
      const templatePath = path.dirname(file)
      const fileName = path.basename(file)

      if(fileName != config.template) continue

      const templateOutputFile = outputFileName(file)
      const templateChanged = await isNewer(file, templateOutputFile)

      let templateContent = await fs.readFile(file, {encoding: 'utf8'})

      for (const plugin of plugins) {
        templateContent = await parsePlugin(plugin, file, templateContent)
      }

      templateMap.set(templatePath, templateContent)
      
      // Check if template output differs, if so update its output file
      let currentTemplate = null
      if(!templateChanged) {
        try {
          currentTemplate = await fs.readFile(templateOutputFile, {encoding: 'utf8'})
        } catch(e) {
          // Couldn't read file, so it probably doesn't exist
        }
      }
  
      if(currentTemplate != templateContent) {
        fs.outputFile(templateOutputFile, templateContent)
      }

      // Remove the parsed template(s) from the list so it won't be parsed again
      allFiles.delete(file)
    }
        
    const parseFile = async (file : string) => {

      const templateFor = (file : string) => {
        let fileName = file
        while(file && file != '.') {
          file = path.dirname(file)
          if(templateMap.has(file)) return templateMap.get(file)!
        }
        throw new Error('Template not found for ' + fileName)
      }
      
      context.parser.template = templateFor(file)

      let content = allFiles.get(file) || await fs.readFile(file, {encoding: 'utf8'})

      // Run file content through plugins
      for (const plugin of plugins2) {
        content = await parsePlugin(plugin, file, content)
      }

      if(allFiles.has(file)) {
        allFiles.set(file, content)
      }
    }

    
    for (const file of allFiles.keys()) {
      if(passThroughFiles.has(file) || !willUsePlugin(file)) continue
      await parseFile(file)
    }
    
    // Copy the parsed and remaining files
    const ignoreFile = hasExtension(config.sourceExtensions)

    for (const [file, content] of allFiles) {
      if(content) {
        if(config.verbose) log('Parsed and copied: ' + file)
        await writeFile(file, content)
      } else if(!ignoreFile(file)) {
        if(config.verbose) log('Copied: ' + file)
        const output = outputFileName(file)
        
        if(await isNewer(file, output)) {
          await fs.ensureDir(path.dirname(output))
          await fs.copy(file, output)
        }
      }
    }
  }
  
  ///// Starting up /////////////////////////////////////////////////

  const setExtension = (p : FilesParser | FilesPlugin) => {
    return 'extensions' in p
      ? p
      : Object.assign(p, {extensions: config.htmlExtensions})
  }

  const run = async () => {
    //log('=== Build start ===')
    await parseAllFiles(
      config.plugins.concat([ 
        markdown, compilePug, compileSass, compileSvelte, cacheBust, htmlFiles 
      ]).map(setExtension)
    )
  }

  return {config, run}
}

export const simplestBuild = async (config? : Partial<Config>) => {
  const build = await start(config)
  const config2 = build.config
  await fs.remove(config2.output)

  return build.run()
}

export const simplestWatch = async (config? : Partial<Config>) => {
  const build = await start(config)
  const config2 = build.config

  const runBuild = debounce(100, build.run)

  const runWatch = (file : string, root : string, stat : Stats) => {
    if(file.endsWith('.temp.js')) return
    log('Updated: ' + file)
    runBuild()
  }

  log('Watching for file changes in ' + c.magenta(config2.input))

  const sane = (await import('sane')).default
  const watcher = sane(config2.input)

  watcher.on('change', runWatch)
  watcher.on('add', runWatch)
  watcher.on('delete', (file) => {
    if(file.endsWith('.temp.js')) return
    log('Deleted: ' + file)
    fs.remove(path.join(config2.output, file))
  })

  await build.run()
  return watcher as any
}

export const simplestDev = async (config? : Partial<Config>) => {
  log('Starting dev server')
  const build = await start(config)
  const config2 = build.config

  await fs.ensureDir(config2.output)
  await simplestWatch(config)
      
  const options = Object.assign({
    server: config2.output,
    files: config2.output
  }, config2.devServerOptions)

  const bs = (await import('browser-sync')).default.create()
  return bs.init(options)
}
