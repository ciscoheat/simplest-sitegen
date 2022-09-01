import path from 'upath'
import fs from 'fs-extra'
import { parse, type HTMLElement } from 'node-html-parser'
import { compile } from 'sass'
import c from 'ansi-colors'
import matter from 'gray-matter'
import md from 'markdown-it'

import { log } from './utils.js'
import { type Context } from './index.js'
import { hash } from './utils.js'

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

const srcScripts = (root : ReturnType<typeof parse>, selector : string, attr : string) => {
  return root.querySelectorAll(selector)
    .filter((el : HTMLElement) => !!el.attributes[attr])
    .map((el : HTMLElement) => ({
      el,
      attr,
      file: el.attributes[attr]
    })) as {el: HTMLElement, attr: string, file: string}[]
}

const html = ['.html', '.htm']

/////////////////////////////////////////////////////////////////////

export const cacheBust = {
  parse: async (context : Context, srcFile : string, content : string) => {
    const root = parse(content, {comment: true})
    const scriptFiles = cssScripts(root).concat(jsScripts(root))
      .filter(f => !f.file.includes('?'))
      .filter(f => !isAbsolute(f.file))

    if(!scriptFiles.length) return content

    for (const {el, attr, file} of scriptFiles) {
      const inputPath = resolvePath(file, context.config.input, srcFile)
      try {
        const content = await fs.readFile(inputPath).catch(() => {
          // Test if output exists instead of input
          const outputPath = resolvePath(file, context.config.output, srcFile)
          return fs.readFile(outputPath)
        })
        el.setAttribute(attr, file + '?' + hash(content))
      } catch (e) {
        log(c.red('Warning: ') + file + ' not found, referenced in ' + srcFile)
      }
    }

    return root.toString()
  }
}

/////////////////////////////////////////////////////////////////////

let sass : typeof compile

export const compileSass = {
  parse: async (context : Context, srcFile : string, content : string) => {
    const root = parse(content, {comment: true})
    const cssRefs = cssScripts(root)

    if(!cssRefs.length) return content

    for (const link of cssRefs) {
      if(!(link.file.endsWith('.sass') || link.file.endsWith('.scss'))) continue
      if(!sass) sass = (await import('sass')).default.compile
      
      const compiled = sass(resolvePath(link.file, context.config.input, srcFile), context.config.sassOptions as any)
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
    }

    return root.toString()
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