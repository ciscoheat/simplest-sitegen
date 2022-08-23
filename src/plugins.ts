import path from 'upath'
import fs from 'fs-extra'
import { parse, type HTMLElement } from 'node-html-parser'
import { compile } from 'sass'

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

export const cacheBust = async (context : Context, template : string) => {
  const root = parse(template, {comment: true})
  const scriptFiles = cssScripts(root).concat(jsScripts(root))

  const content = await Promise.allSettled(scriptFiles
    .filter(f => !isAbsolute(f.file))
    .map(script => {
        const inputPath = path.join(context.config.input, script.file)
        return fs.readFile(inputPath).catch(() => {
          // Test if output exists instead of input
          const outputPath = path.join(context.config.output, script.file)
          return fs.readFile(outputPath)
      })
    })
  )

  content.forEach((res, i) => {
    if(res.status != 'fulfilled') return
    const {el, attr, file} = scriptFiles[i]
    el.setAttribute(attr, file + '?' + hash(res.value))
  })

  return root.toString()
}

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
  parse: async (context : Context, file : string) => {
    const content = await fs.readFile(file)

    return content.includes('<!-- build:content -->')
      ? context.parser.processContent(content.toString('utf8'))
      : content
  }
}
