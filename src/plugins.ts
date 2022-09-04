import path from 'upath'
import fs from 'fs-extra'
import { parse, type HTMLElement } from 'node-html-parser'
import c from 'ansi-colors'
import matter from 'gray-matter'
import md from 'markdown-it'

import { log, isNewer } from './utils.js'
import { type Context } from './index.js'
import { hash } from './utils.js'
// @ts-ignore
import node_modules from 'node_modules-path'

import { compile as svelte, CompileOptions } from 'svelte/compiler'
import { minify } from 'terser'
import { pathToFileURL } from 'url'

const isAbsolute = (url : string) => /^(?:[a-z+]+:)?\/\//i.test(url)

const resolvePath = (url : string, basePath : string, srcFile : string) => {
  if(url.startsWith('/'))
    return path.join(basePath, url)
  else {
    return path.join(path.dirname(srcFile), url)
  }
}

const cssScripts = (root : ReturnType<typeof parse>) => srcScripts(root, 'link', 'href')
const jsScripts = (root : ReturnType<typeof parse>) => srcScripts(root, 'script', 'src')
const imgLinks = (root : ReturnType<typeof parse>) => srcScripts(root, 'img', 'src')

const srcScripts = (root : ReturnType<typeof parse>, selector : string, attr : string) => {
  return root.querySelectorAll(selector)
    .filter((el : HTMLElement) => !!el.attributes[attr])
    .map((el : HTMLElement) => ({
      el,
      attr,
      file: el.attributes[attr]
    })) as {el: HTMLElement, attr: string, file: string}[]
}

const toHtmlTemplate = (vars : Record<string, string>, content : string) => 
  Object.entries(vars).map(([key, value]) => `<!-- build:${key} -->${value}<!-- /build:${key} -->`)
    .join("\n") + "\n" +
    `<!-- build:content -->${content}<!-- /build:content -->`

/////////////////////////////////////////////////////////////////////

const cacheMap = new WeakMap<Context, Map<string, string>>()

export const cacheBust = {
  parse: async (context : Context, srcFile : string, content : string) => {
    if(!cacheMap.has(context)) cacheMap.set(context, new Map())
    const cached = cacheMap.get(context)!

    const root = parse(content, {comment: true})
    const scriptFiles = cssScripts(root).concat(jsScripts(root)).concat(imgLinks(root))
      .filter(f => !f.file.includes('?'))
      .filter(f => !isAbsolute(f.file))

    if(!scriptFiles.length) return content

    for (let {el, attr, file} of scriptFiles) {
      if(file.startsWith('data:')) continue

      // Need to trim filename, since beginning/ending spaces in filename attributes are ok(!)
      file = file.trim()
      const inputPath = resolvePath(file, context.config.input, srcFile)

      if(cached.has(inputPath)) {
        //console.log('Cached: ' + inputPath)
        el.setAttribute(attr, cached.get(inputPath)!)
      } else try {
        const content = await fs.readFile(inputPath).catch(() => {
          // Test if output exists instead of input
          const outputPath = resolvePath(file, context.config.output, srcFile)
          return fs.readFile(outputPath)
        })
        
        const hashedFile = file + '?' + hash(content)
        
        cached.set(inputPath, hashedFile)
        el.setAttribute(attr, hashedFile)
      } catch (e) {
        log(c.red('Warning: ') + c.magenta(file) + ' not found, referenced in ' + c.magenta(srcFile))
      }
    }
    
    const output = root.toString()
    cached.set(srcFile, output)
    return output
  }
}

/////////////////////////////////////////////////////////////////////

let sass : typeof import('sass').compile

export const compileSass = {
  parse: async (context : Context, srcFile : string, content : string) => {
    const root = parse(content, {comment: true})
    const cssRefs = cssScripts(root)

    if(!cssRefs.length) return content

    const parsedFiles : any[] = []

    for (const link of cssRefs) {
      if(!(link.file.endsWith('.sass') || link.file.endsWith('.scss'))) continue
      if(!sass) sass = (await import('sass')).default.compile
      
      const inputFile = resolvePath(link.file, context.config.input, srcFile)
      const compiled = sass(inputFile, context.config.sassOptions as any)
      const cssFileName = path.changeExt(link.file, '.css')

      await fs.outputFile(resolvePath(cssFileName, context.config.output, srcFile), compiled.css)
      link.el.setAttribute(link.attr, cssFileName)

      if(compiled.sourceMap?.file) {
        const mapPath = resolvePath(
          path.changeExt(link.file, '.css.map', undefined, 8), 
          context.config.output, 
          srcFile
        )
        await fs.outputFile(mapPath, compiled.sourceMap.file)
      }

      parsedFiles.push({action: 'remove' as const, file: inputFile})
    }

    return [root.toString()].concat(parsedFiles)
  }
}

/////////////////////////////////////////////////////////////////////

export const htmlFiles = {
  parse: async (context : Context, file : string, content : string) => {
    return content.includes('<!-- /build:content -->')
      ? context.parser.processContent(content)
      : content
  }
}

/////////////////////////////////////////////////////////////////////

export const markdown = {
  extensions: ['.md'],
  parse: async (context : Context, file : string, content : string) => {
    const frontMatter = matter(content)
    const parsed = md(context.config.markdownOptions as any).render(frontMatter.content)
    const vars = Object.entries(frontMatter.data).map(([key, value]) => `<!-- build:${key} -->${value}<!-- /build:${key} -->`)

    return {
      file: path.changeExt(file, '.html'), 
      content: vars.join("\n") + `\n<!-- build:content -->${parsed}<!-- /build:content -->`
    }
  }
}

/////////////////////////////////////////////////////////////////////

let pug: typeof import("pug")

export const compilePug = {
  extensions: ['.pug'],
  parse: async (context : Context, file : string, content : string) => {
    if(!pug) pug = (await import('pug')).default

    // Parse all top-level variable definitions as template vars
    const line = /^-\s+(?:const|var|let)\s+([a-zA-Z_$][a-zA-Z_$0-9]*)\s+=(.*?);?$/gm
    const matches = content.matchAll(line)

    const vars = Object.fromEntries(Array.from(matches).map(m => [m[1], JSON.parse(m[2])]))
    const output = pug.render(content, context.config.pugOptions)

    return {
      file: path.changeExt(file, '.html'), 
      content: toHtmlTemplate(vars, output)
    }
  }
}

/////////////////////////////////////////////////////////////////////

let svelteRuntimeHash = ''

export const compileSvelte = {
  extensions: ['.svelte'],
  parse: async (context : Context, file : string, content : string) => {

    const compile = (svelteContent : string, generate : 'dom' | 'ssr', newOptions : CompileOptions = {}) => {
      const options = {
        format: 'esm',
        generate,
        hydratable: true,
        enableSourcemap: false,
        css: false
      }

      return svelte(svelteContent, Object.assign({}, options, newOptions))
    }

    const minifyOptions = {
      module: true,
      keep_classnames: true
    }

    if(!svelteRuntimeHash) {
      const source = path.resolve(node_modules('svelte'), 'svelte', 'internal', 'index.mjs')
      const dest = path.resolve(context.config.output, 'js', 'svelte.js')
      const sourceContent = await fs.readFile(source, {encoding: "utf8"})
      const minified = (await minify(sourceContent, minifyOptions)).code!

      svelteRuntimeHash = hash(minified)
      await fs.outputFile(dest, minified)
    }

    // Render SSR component
    const tempFile = file + '.temp.js'
    const compiledSSR = compile(content, 'ssr')
    let compiledSSRoutput : {
      html: string,
      css: { code: string }
    }
    try {
      // Save it to a temporary file and render it
      await fs.outputFile(tempFile, compiledSSR.js.code)
      const url = pathToFileURL(tempFile).toString()
      const module = (await import(url)).default
      compiledSSRoutput = module.render()
    } catch(e) {
      throw e
    } finally {
      await fs.remove(tempFile)
    }

    // Compile and output client-side component with the generated SSR
    const compiledDOM = compile(content, 'dom')

    const componentId = 'simplest-svelte-component'
    const code = (compiledDOM.js.code) as string
    const jsOutput = code
      .replace(
        'from "svelte/internal"', 
        `from "/js/svelte.js?${svelteRuntimeHash}"`
      )
      .replace(
        'export default Component;', 
        `new Component({
          target: document.getElementById("${componentId}"),
          hydrate: true
        });`
      )

    let vars
    {
      const exports = /^\s*export\s+const\s+([a-zA-Z_$][a-zA-Z_$0-9]*)\s+=(.*?);?$/gm
      const matches = content.matchAll(exports)

      vars = Object.fromEntries(Array.from(matches).map(m => [m[1], JSON.parse(m[2])]))
    }
  
    return {
      file: path.changeExt(file, '.html'), 
      content: toHtmlTemplate(vars, `
        <style>${compiledSSRoutput.css.code}</style>
        <div id="${componentId}">${compiledSSRoutput.html}</div>
        <script type="module">${(await minify(jsOutput, minifyOptions)).code}</script>
      `)
    }
  }
}
