# simplest-sitegen

## Do you recognize this:

- You are comfortable with html and want to build a relatively simple, modern static site.
- You look at the [jamstack site generators](https://jamstack.org/generators/) but they always seem a bit too complicated. Too much configuration, too much scaffolding, too many themes, too much documentation.
- You don't want to get into all that *again*, because you have tested a few of them.

## Don't despair, the solution is in front of you!

Introducing **simplest**. It's true, it really is the simplest static sitegen. Only HTML needed. No markdown, no yaml, no template languages, no huge documentation, and a one-step build process. Make a new project and install it immediately:

```
mkdir new-project
cd new-project
npm init es6
npm i simplest-sitegen
mkdir src
```

The `npm init es6` is for `"type": "module"` to be included in the `package.json` file. You can add that line manually and use the normal `npm init` if you want. 

([pnpm](https://pnpm.io/) is recommended instead of npm though!)

## No scaffolding except one file: `src/template.html`

That's right, there won't be fifteen files in your project after running a cryptic package command. You only need to create `src/template.html` yourself, which is the template that your other html files will be based on. You can use any [html5 boilerplate](https://www.google.com/search?q=html5+boilerplate) for example, but here's a simple one:

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

This will generate your brand new site in the `build` directory, that can be uploaded directly to any host. For more pages and files, just add them in `src` in any folder structure, and they will be copied over to the correct dir. It's up to you to link to them correctly, create a nice navigation in `template.html`, etc, but that's quick and easy compared to plowing through the documentation of any other "simpler" site generator out there.

## It has a Dev server, of course

We're not done just yet: I'm sure you feel the need for a near-real time hot-reloading supercharged experience when developing your site. It's one of the simplest to use:

```
npx simplest
```

This will start a [Browsersync](https://browsersync.io/) server, and open up a browser window for you. Any changes in `src` will update the browser automatically.

## Cache busting included

All links and scripts relative to the site, for example `/script.js` or `../css/style.css` (but not `https://example.com/script.js`), will be automatically cache-busted based on its content, so you don't have to worry about serving old scripts and styles.

## Sass compilation included as well

with a simple `(p)npm i sass`, you can now use [Sass](https://sass-lang.com/) instead of css in your html files. It's a ridiculously simple drop-in replacement:

```html
<link rel="stylesheet" href="/style.scss">
```

Just make sure that the source file is in the correct directory as the output, i.e. `src/css/style.scss` should be linked as `/css/style.scss` in the template.

## Multiple templates

You can put a `template.html` in any subdirectory, and all html files in that directory and below will use that template instead of the top-level one.

## This is great, but I still want to use Markdown!

All right, that's simple enough for it to be included. This is the corresponding `.md` file for the index page in the example above:

**src/index.md**
```
---
title: Simplest
---
# The simplest site generator is finally here!
```

Just be aware that it's unspecified which file will take precedence when only the extension differ. So don't create a `template.md` file for example.

## Configuration

If you need to complicate things, it's understandable, things aren't always as simple as one would like. Fortunately it's not too hard to configure simplest. Create a `simplest.config.js` file in your project top directory, with any of the following properties:

```js
export default {
  input: "src",
  output: "build",
  template: "template.html",
  ignoreExtensions: [".sass", ".scss"], // Won't be copied to the output dir
  passThrough: [], // Glob patterns (in input directory) that will skip parsing for matched files
  devServerOptions: { ui: false, notify: false }, // Extra Browsersync options
  sassOptions: { style: "compressed" }, // Extra sass options
  markdownOptions: {} // Extra markdown-it options
  plugins: [], // Will be documented on popular request
}
```

- Browsersync options are listed [here](https://browsersync.io/docs/options)
- Sass options are listed [here](https://sass-lang.com/documentation/js-api/interfaces/Options)
- Markdown-it options are listed [here](https://www.npmjs.com/package/markdown-it#init-with-presets-and-options)
- Glob patterns are available [here](https://github.com/mrmlnc/fast-glob#pattern-syntax).

## Any limitations?

Sure, if you want to use a framework like Svelte, Vue, etc, you're better off using [Vite](https://vitejs.dev/). And if you want more advanced CMS/blog features with advanced templating, look at the [jamstack generators](https://jamstack.org/generators/) again. But for non-complicated sites it should be fine, and you can even add some CMS capabilities with a [headless CMS](https://jamstack.org/headless-cms/).

## Feedback wanted

Comments, bug reports and feature requests that will keep things simple(st), are very welcome as a [github issue](https://github.com/ciscoheat/simplest-sitegen/issues). 

Thanks for reading, and enjoy simplicity for a change!
