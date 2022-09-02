import { simplestBuild, simplestDev, simplestWatch } from './index.js'
import minimist from 'minimist'
import c from 'ansi-colors'

const log = (msg : string) => console.log(
  process.stdout.isTTY ? msg : c.unstyle(msg)
)

const args = minimist(process.argv.slice(2), {boolean: true})

process.on('uncaughtException', (err) => {
  const msg = err.message.startsWith('Error: ') ? err.message.substring('Error: '.length) : err.message
  log(c.red('Error: ') + msg)
  process.exit(1)
})

process.on('unhandledRejection', (err : any) => {
  err = err.toString()
  const msg = err.startsWith('Error: ') ? err.substring('Error: '.length) : err
  log(c.red('Error: ') + msg)
  process.exit(1)
})

/////////////////////////////////////////////////////////////////////

const help = () => console.log(`

Usage:

npm create simplest-sitegen  Initializes a project
npx simplest build           Builds the site
npx simplest                 Starts a dev server

`.trim())

if(args.help) {
  help()
} else {

  const mode = ['dev', 'build', 'watch', 'help'].find(m => m == args._[0]) || 'dev'

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

    case 'help':
      help()
      break
  }
}
