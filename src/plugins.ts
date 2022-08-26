import path from 'upath'
import fs from 'fs-extra'
import { parse, type HTMLElement } from 'node-html-parser'
import { compile } from 'sass'
import c from 'ansi-colors'

import { type Context } from './index.js'
import { hash } from './utils.js'

const isAbsolute = (url : string) => /^(?:[a-z+]+:)?\/\//i.test(url)

const cssScripts = (root : ReturnType<typeof parse>) => srcScripts(root, 'link', 'href')
const jsScripts = (root : ReturnType<typeof parse>) => srcScripts(root, 'script', 'src')

const srcScripts = (root : ReturnType<typeof parse>, selector : string, attr : string) => {
  return root.querySelectorAll(selector)
    .filter((el : HTMLElement) => !!el.attributes[attr])
    .map((el : HTMLElement) => ({
      el,
      attr,
      file: el.attributes[attr]
    })) as {el: HTMLElement, attr: string, file: string}[]
}

/////////////////////////////////////////////////////////////////////

export const cacheBust = async (context : Context, template : string) => {
  const root = parse(template, {comment: true})
  const scriptFiles = cssScripts(root).concat(jsScripts(root))
    .filter(f => !isAbsolute(f.file))

  for (const {el, attr, file} of scriptFiles) {
    const inputPath = path.join(context.config.input, file)
    try {
      const content = await fs.readFile(inputPath).catch(() => {
        // Test if output exists instead of input
        const outputPath = path.join(context.config.output, file)
        return fs.readFile(outputPath)
      })
      el.setAttribute(attr, file + '?' + hash(content))
    } catch (e) {
      const msg = 'Warning: ' + file + ' not found, referenced in ' + context.config.template
      console.log(process.stdout.isTTY ? c.red(msg) : msg)
    }
  }

  return root.toString()
}

/////////////////////////////////////////////////////////////////////

let sass : typeof compile

export const compileSass = async (context : Context, template : string) => {
  const root = parse(template, {comment: true})
  for (const link of cssScripts(root)) {
    if(!(link.file.endsWith('.sass') || link.file.endsWith('.scss'))) continue
    if(!sass) sass = (await import('sass')).default.compile
    
    const compiled = sass(path.join(context.config.input, link.file))
    const cssFileName = path.changeExt(link.file, '.css')

    await fs.outputFile(path.join(context.config.output, cssFileName), compiled.css)
    link.el.setAttribute(link.attr, cssFileName)

    if(compiled.sourceMap?.file) {
      await fs.outputFile(path.join(context.config.output, path.changeExt(link.file, '.css.map', undefined, 8)), compiled.sourceMap.file)
    }
  }

  return root.toString()
}

/////////////////////////////////////////////////////////////////////

export const htmlFiles = {
  extensions: ['.html', '.htm'],
  parse: async (context : Context, file : string, content : string) => {
    return content.includes('<!-- /build:content -->')
      ? context.parser.processContent(content)
      : content
  }
}
