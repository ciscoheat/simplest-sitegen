import { simplest, simplestWatch } from './index.js'
import minimist from 'minimist'

const args = minimist(process.argv.slice(2))
const watch = args._.includes('watch')

if(watch) simplestWatch()
else simplest()
