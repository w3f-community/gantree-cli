const { Gantree, packageDir } = require('gantree-lib')
const { gantreeTitle } = require('../lib/art')
const path = require('path')
const inventoryPath = path.join(packageDir, '/inventory')
const ansiblePath = path.join(packageDir, '/ansible')

const gantree = new Gantree()

async function ansibleCleanWrapper() {
  console.log(gantreeTitle)
  console.warn('Please note, ansibleClean is a temporary subcommand.')
  await gantree.ansibleCleanAll(inventoryPath, ansiblePath)
}

module.exports = {
  ansibleCleanWrapper
}
