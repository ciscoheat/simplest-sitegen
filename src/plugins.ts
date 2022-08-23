import path from 'upath'
import fs from 'fs-extra'
import { parse } from 'node-html-parser'

import { hash } from './utils.js'
import { type Context } from './index.js'
import { compile } from 'sass'

interface ParsedElement {
  attributes: Record<string, string>
  setAttribute(name : string, value : string) : void
}

export const cacheBust = async (context : Context, template : string) => {
  const root = parse(template, {comment: true})

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

  const content = await Promise.allSettled(scriptFiles
    .map(script => path.join(context.config.input, script.file))
    .map(file => fs.readFile(file))
  )

  content.forEach((res, i) => {
    if(res.status != 'fulfilled') return
    const {el, attr, file} = scriptFiles[i]
    el.setAttribute(attr, file + '?' + hash(res.value))
  })

  return root.toString()
}

export const htmlFiles = {
  extensions: ['.html', '.htm'],
  parse: async (context : Context, file : string) => {
    const content = await fs.readFile(file)

    return content.includes('<!-- build:content -->')
      ? context.parser.processContent(content.toString('utf8'))
      : content
  }
}

let sass : typeof compile

export const compileSass = {
  extensions: ['.sass', '.scss'],
  parse: async (context : Context, file : string) => {
    if(!sass) sass = (await import('sass')).default.compile
    const content = sass(file)

    return {
      file: path.changeExt(file, 'css'),
      content: content.css
    }
  }
}
