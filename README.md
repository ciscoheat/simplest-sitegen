# simplest-sitegen

**Simplest** is the simplest static sitegen you can find, while still being quite able. It's perfect for smaller websites with just a little dynamic content, and when you want something up fast without diving deep into documentation.

The bold claim of being simplest is made because only HTML is needed. No markdown, no yaml, no template languages, no huge documentation, and a one-step build process. Create a new project with it immediately:

```
npm create simplest-sitegen
```

## No scaffolding except one file: `src/template.html`

That's right, there won't be fifteen files in your project after running a cryptic package command. The only file you need is `src/template.html`, which is the template that your other html files will be based on. Open it up in your editor of choice. It will look similar to this:

**src/template.html**
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title><!-- build:title --></title>
    <link rel="stylesheet" href="/style.css">
    <!-- build:styles -->
  </head>
  <body>
    <!-- build:content -->
    <!-- build:scripts -->
  </body>
</html>
```

There are four template variables inside it, only one is required: `<!-- build:content -->`

Now let's build the real site content, why not the index page:

**src/index.html**
```html
<!-- build:title -->Simplest<!-- /build:title -->
<!-- build:content -->
<h1>The simplest site generator is finally here!</h1>
<!-- /build:content -->
```

It's just HTML! No need to learn anything, since you already know it!

Lets just add a little bit of style though:

**src/style.css**
```css
h1 {
  color: #6200EE;
}
```

## Building the site

```
cd new-project
npx simplest build
```

This will generate your brand new site in the `build` directory, that can be uploaded directly to any host. For more pages and files, just add them in `src` in any folder structure, and they will be copied over to the correct dir. 

It's up to you to link to them correctly, create a nice navigation in `template.html`, etc, but that's quick and easy compared to plowing through the documentation of any other "simpler" site generator out there. Just include your favorite css framework, and you should be good to go.

## It has a Dev server, of course

Simplest near-real time hot-reloading dev server is one of the simplest to use:

```
npx simplest
```

This will start a [Browsersync](https://browsersync.io/) server, and open up a browser window for you. Any changes in `src` will update the browser automatically.

## Multiple templates

You can put a `template.html` in any subdirectory, and all html files in that directory and below will use that template instead of the top-level one.

## Cache busting included

All links, scripts and images relative to the site, for example `/script.js` or `../css/style.css` (but not `https://example.com/script.js`), will be automatically cache-busted, so you don't have to worry about serving old content. You will also get a warning if a file doesn't exist.

# Extra features

If you're fine with HTML and nothing else, the above is all you need to know. Go and create something beautiful!

But if you're comfortable with web development, there are libraries and tools that makes life easier. Simplest includes some of them. They are purely optional.

## Sass

You can use [Sass](https://sass-lang.com/) instead of css in your html files. It's a ridiculously simple drop-in replacement in your html:

```html
<link rel="stylesheet" href="/style.scss">
```

Just make sure that the source file is in the correct directory as the output, i.e. `src/css/style.scss` should be linked as `/css/style.scss` in the template.


## Markdown

Markdown is simple enough for it to be included. This is the corresponding `.md` file for the index page in the example above:

**src/index.md**
```
---
title: Simplest
---
# The simplest site generator is finally here!
```

Just be aware that it's unspecified which file will take precedence when only the extension differ. So having an `index.html` in the same directory as `index.md` will probably cause trouble. A warning will be issued if that's the case.

## Pug

[Pug](https://pugjs.org/) is a template language in the spirit of simplicity, so yes, it can be used:

**src/index.pug**
```pug
- const title = "Simplest"

h1 The simplest site generator is finally here!
```

Any top-level unbuffered code (a line starting with `-`) will be parsed into a corresponding `<!-- build:VAR -->` comment block.

## Svelte!

Using [Svelte](https://svelte.dev/) components is far from keeping things simple, right? Well, if you're looking for some sporadic client-side interactivity, a Svelte component makes things quite simple. Here's the start page representation:

**src/index.svelte**
```svelte
<script>
  export const title = "Simplest"
</script>

<h1>The simplest site generator is finally here!</h1>
```

All **export const** variables will be used in the template. Unfortunately there cannot be any nested components. The reason is technical, but let's say for now that nested components wouldn't be simple enough. :)

## Configuration

If you need to complicate things, it's understandable, things aren't always as simple as one would like. Fortunately it's not too hard to configure simplest. Create a `simplest.config.js` file in your project top directory, with any of the following properties:

```js
export default {
  input: "src",
  output: "build",
  template: "template.html", // Template file(s) to look for
  htmlExtensions: [".html", ".htm"], // What files to parse for HTML content
  sourceExtensions: [".sass", ".scss", ".pug", ".svelte"], // Won't be copied to the output dir
  passThrough: [], // Glob patterns (relative to input dir) that will skip parsing
  devServerOptions: { ui: false, notify: false }, // Extra Browsersync options
  sassOptions: { style: "compressed" }, // Extra sass options
  markdownOptions: {}, // Extra markdown-it options
  pugOptions: {}, // Extra pug options
  plugins: [], // Will be documented on popular request
  verbose: false
}
```

- Browsersync options are listed [here](https://browsersync.io/docs/options)
- Sass options are listed [here](https://sass-lang.com/documentation/js-api/interfaces/Options)
- Markdown-it options are listed [here](https://www.npmjs.com/package/markdown-it#init-with-presets-and-options)
- Pug options are listed [here](https://pugjs.org/api/reference.html)
- Glob patterns are available [here](https://github.com/mrmlnc/fast-glob#pattern-syntax).

## Server-side power with PHP

The easiest and cheapest way to add powerful server-side capabilities to Simplest is by parsing PHP files, using the built-in PHP dev server to keep the hot reload capabilities. Configure it like this:

**simplest.config.js**

```js
export default {
  htmlExtensions: [".html", ".htm", ".php"],
  devServerOptions: { 
    ui: false, notify: false, 
    server: undefined, 
    proxy: "127.0.0.1:3500" 
  }
}
```

Then start the `php` dev server (make sure [PHP is installed](https://www.php.net/downloads.php) on your system first):

```
php -S 127.0.0.1:3500 -t build
```

With this, you can start using PHP files! Start `npx simplest` to confirm that the Browsersync proxy works, then replace `src/index.html` with this file to test:

**src/index.php**

```php
<!-- build:title -->PHP Powered site!<!-- /build:title -->
<!-- build:content -->
<h1>PHP test</h1>
<ul>
<?php foreach(array("A", "B", "C") as $char): ?>
  <li><b><?php echo $char ?>:</b> Php works</li>
<?php endforeach; ?>
</ul>
<!-- /build:content -->
```

If you want to add a PHP framework to the site, exclude it from parsing using the `passThrough` configuration option.

## When not to use Simplest

When your site is more dynamic and data-driven, and you want routing, client-side rendering, etc, you're better of using [SvelteKit](https://kit.svelte.dev/) or [Astro](https://astro.build/).

If your site is mostly static but you want a more complete CMS/blog with advanced templating, look at the [jamstack generators](https://jamstack.org/generators/) again. 

But for non-complicated sites Simplest should be fine, and you can even add some CMS capabilities with a [headless CMS](https://jamstack.org/headless-cms/).

## If you dislike scaffolding

Here's how to create a project manually:

```
mkdir new-project
cd new-project
npm init
npm i simplest-sitegen
mkdir src
```

([pnpm](https://pnpm.io/) is recommended instead of npm though!)

Then add `"type": "module"` to your `package.json` file. Finally, create a `src/template.html` file and you're ready to go.

## Feedback wanted

Comments, bug reports and feature requests that will keep things simple(st), are very welcome as a [github issue](https://github.com/ciscoheat/simplest-sitegen/issues). 

Thanks for reading, and enjoy simplicity for a change!
