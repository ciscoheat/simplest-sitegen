import dircompare from 'dir-compare'
import ansi from 'ansi-colors'
import { createTwoFilesPatch } from 'diff'
import path from 'upath'
import fs from 'fs-extra'
// @ts-ignore
import colorize from '@npmcli/disparity-colors'
import { simplestBuild } from './index.js'

;(async () => {
  await fs.emptyDir("build")
  await simplestBuild()
  const result = await dircompare.compare("expected", "build", {compareContent: true})
  if(!result.same) {
    console.log(ansi.red('  Test failure'))
    console.log(ansi.yellow('  ' + result.differences + " difference(s):") + "\n")

    const diffs = result.diffSet!.filter(r => r.state == 'distinct')
    const problems = result.diffSet!.filter(r => r.state != 'equal' && r.state != 'distinct')

    diffs.forEach(r => {
      const test = path.join(r.path1, r.name1)
      const expected = path.join(r.path2, r.name2)

      const result = createTwoFilesPatch(
        expected, test,
        fs.readFileSync(test, {encoding: 'utf-8'}), 
        fs.readFileSync(expected, {encoding: 'utf-8'}),
        undefined, undefined,
        { context: 0 }
      )
      console.log(colorize(result))
    })

    if(problems.length) {
      console.log("====================================================================")
      console.log(problems)
    }

    process.exitCode = 1
  } else {
    console.log(ansi.green('Tests passed, directories are identical.'))
  }
})()
