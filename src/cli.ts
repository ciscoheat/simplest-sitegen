import { simplestBuild, simplestDev, simplestWatch } from './index.js'
import minimist from 'minimist'

const args = minimist(process.argv.slice(2))
const build = args._.includes('build')
const watch = args._.includes('watch')

if(build && watch) throw new Error('Cannot build and watch at the same time.')

if(build) simplestBuild()
else if(watch) simplestWatch()
else simplestDev()
