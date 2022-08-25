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
npm init -y
npm install simplest-sitegen
mkdir src
```

([pnpm](https://pnpm.io/) is recommended instead of npm though)

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
  </head>
  <body>
    <!-- build:content -->
  </body>
</html>
```

There are two template variables inside it, only one is required: `<!-- build:content -->`

Now let's build the real site content, why not the index page:

**src/index.html**
```html
<!-- build:title -->Simplest<!-- /build:title -->
<!-- build:content -->
<h1>The simplest site generator is finally here!</h1>
<!-- /build:content -->
```

And just a little bit of style.

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

This will generate your brand new site in the `build` directory. For other pages and files, just add them in any subdirectory to `src`, and they will be copied over to the correct dir. It's up to you to link to them correctly, create a nice navigation in `template.html`, etc, but that's quick and easy compared to plowing through the documentation of any other "simpler" site generator out there.

## It has a Dev server, of course

We're not done just yet: I'm sure you feel the need for a near-real time hot-reloading supercharged experience when developing your site. It's one of the simplest to use:

```
npx simplest
```

This will start a [Browsersync](https://browsersync.io/) server, and open up a browser window for you. In case it doesn't work, `npm install browser-sync` should fix it.

## Cache busting included

All non-absolute links and scripts, for example the one in `<link rel="stylesheet" href="/style.css">`, will be automatically cache-busted based on its content, so you don't have to worry about serving old scripts and styles.

## Sass compilation included as well

with a simple `(p)npm install sass`, you can now use [Sass](https://sass-lang.com/) instead of css in your website. It's a ridiculously simple drop-in replacement:

```html
<link rel="stylesheet" href="/style.scss">
```

## Configuration

If you need to complicate things, it's understandable, things aren't always as simple as one would like. Fortunately, it's not too hard to configure simplest. Create a `simplest.config.js` file in your project top directory (above `src`), with any of the following properties:

```js
export default {
  input: "src",
  output: "build",
  template: "src/template.html",
  ignoreExtensions: [".sass", ".scss"], // Won't be copied to the output dir
  devServerOptions: '', // Extra Browsersync options
  templatePlugins: [], // Will be documented on popular request
  filesPlugin: [], // Will be documented on popular request
}
```

## Feedback wanted

Comments, bug reports, feature requests that will keep things simple(st), are very welcome as a [github issue](https://github.com/ciscoheat/simplest-sitegen). Thanks for reading, and enjoy simplicity for a change!
