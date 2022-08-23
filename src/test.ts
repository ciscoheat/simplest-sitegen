import { exec } from 'child_process'
import dircompare from 'dir-compare'
import ansi from 'ansi-colors'
import { createTwoFilesPatch } from 'diff'
import path from 'upath'
import fs from 'fs-extra'
// @ts-ignore
import colorize from '@npmcli/disparity-colors'

const run = (command : string, okMsg = '') => new Promise<void>((res, rej) =>
  exec(command, err => {
    if(err) return rej(err)
    if(okMsg) console.log(okMsg)
    res()
  })
)

;(async () => {
  await run('npm run start')
  const result = await dircompare.compare("build", "expected", {compareContent: true})
  if(!result.same) {
    console.log(ansi.red('  Test failure'))
    console.log(ansi.yellow('  ' + result.differences + " difference(s):") + "\n")

    const notEqual = result.diffSet!.filter(r => r.state != 'equal')
      .forEach(r => {
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

    process.exitCode = 1
  } else {
    console.log(ansi.green('Tests passed, directories are identical.'))
  }
})()
