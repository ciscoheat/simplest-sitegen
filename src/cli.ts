import { simplestBuild, simplestDev, simplestWatch } from './index.js'
import minimist from 'minimist'
import path from 'upath'
import c from 'ansi-colors'
import enquirer from 'enquirer'
import fs from 'fs-extra'
import replace from 'replace-in-file'
import spawn from 'cross-spawn'

const log = console.log
const args = minimist(process.argv.slice(2), {boolean: true})

process.on('uncaughtException', (err) => {
  log(c.red('Error: ') + err.message)
  process.exit(1)
})

process.on('unhandledRejection', (err) => {
  log(c.red('Error: ') + err)
  process.exit(1)
})

if(args.help) {
  
console.log(`Usage:

npx simplest build   Builds the site
npx simplest         Starts a dev server`)

} else {

  const mode = ['dev', 'build', 'watch', 'create'].find(m => m == args._[0]) || 'dev'

  //console.log(import.meta.url)

  switch(mode) {
    case 'dev':
      simplestDev()
      break

    case 'build':
      simplestBuild()
      break
    
    case 'watch':
      simplestWatch()
      break

    case 'create':     
      const dir = args._[1]
      if(!dir) {
        log(c.yellow('Creating simplest project'))
        enquirer.prompt({
          type: 'input',
          name: 'dir',
          message: 'Directory name for project?'
        }).then((response : any) => {
          createProject(response.dir)
        })
      } else {
        log(c.yellow('Creating simplest project in ') + c.blueBright(dir))
        createProject(dir)
      }
  }
}

/////////////////////////////////////////////////////////////////////

async function createProject(dir : string) {
  const error = (msg : string) => log(c.red(`Error: `) + msg)

  try {
    const files = fs.readdirSync(dir)

    if(files.length > 0)
      return error(c.blueBright(dir) + ' dir is not empty.')
  } catch (e) {}

  const scaffoldDir = path.join(path.dirname(import.meta.url.slice('file:///'.length)), '../create')

  try {
    await fs.accessSync(scaffoldDir)
  } catch(e) {
    return error('Scaffolding dir ' + scaffoldDir + ' not found.')
  }

  fs.copySync(scaffoldDir, dir)
  process.chdir(dir)

  replace.sync({
    files: '**',
    from: 'my-project',
    to: dir
  })

  const answer = await enquirer.prompt({
    type: 'select',
    name: 'installer',
    message: "Which package manager are you using? (If you don't know, use 'npm')",
    choices: ['npm', 'pnpm', 'yarn']
  }) as {installer: string}

  const installed = spawn.sync(answer.installer, ['install'], {stdio: 'inherit'})

  if(installed.error) return log(installed.error.message)

  const runner = (answer.installer == 'npm') ? 'npm run'
    : (answer.installer == 'pnpm') ? 'pnpm'
      : 'yarn run'

  log('')
  log(c.blueBright('Simplest project created!') + ' Start with:')
  log('')
  log('cd ' + c.blueBright(dir))
  log('')
  log('Then:')
  log(` - Start a dev server with ` + c.green(`${runner} dev`))
  log(` - Build the project with ` + c.green(`${runner} build`))
  log('')
  log('Documentation is available at ' + c.blueBright('https://www.npmjs.com/package/simplest-sitegen'))
}
