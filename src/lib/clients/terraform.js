const fs = require('fs-extra')
const path = require('path')

const cmd = require('../cmd')
const { Project } = require('../project')
const ssh = require('../ssh')
const tpl = require('../tpl')
const chalk = require('chalk')

class Terraform {
  constructor(cfg) {
    this.config = JSON.parse(JSON.stringify(cfg))

    const project = new Project(cfg)
    this.terraformOriginPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'terraform'
    )
    this.terraformFilesPath = path.join(project.path(), 'terraform')

    this.options = {
      verbose: true
    }
  }

  async sync() {
    console.log('[Gantree] Initialising Terraform')
    this._initializeTerraform()
    // console.log('init')
    // try {
    //   await this._initState();
    // } catch(e) {
    //   console.log(`Allowed error creating state backend: ${e.message}`);
    // }

    this._check_environment_variables(this.config.validators.nodes)

    const sshKeys = ssh.keys()

    // console.log({sshKeys})

    let validatorSyncPromises = []
    try {
      validatorSyncPromises = await this._create(
        'validator',
        sshKeys.validatorPublicKey,
        this.config.validators.nodes
      )
    } catch (e) {
      console.log(
        `[Gantree] Could not get validator sync promises: ${e.message}`
      )
    }

    let publicNodeSyncPromises = []
    // try {
    //   publicNodeSyncPromises = await this._create('publicNode', sshKeys.publicNodePublicKey, this.config.publicNodes.nodes);
    // } catch(e) {
    //   console.log(`Could not get publicNodes sync promises: ${e.message}`);
    // }
    const syncPromises = validatorSyncPromises.concat(publicNodeSyncPromises)

    return Promise.all(syncPromises)
  }

  async clean() {
    this._initializeTerraform()
    let validatorCleanPromises = []
    try {
      validatorCleanPromises = await this._destroy(
        'validator',
        this.config.validators.nodes
      )
    } catch (e) {
      console.log(
        `[Gantree] Could not get validator clean promises: ${e.message}`
      )
    }

    let publicNodesCleanPromises = []
    // try {
    //   publicNodesCleanPromises = await this._destroy('publicNode', this.config.publicNodes.nodes);
    // } catch(e) {
    //   console.log(`Could not get publicNodes clean promises: ${e.message}`);
    // }

    const cleanPromises = validatorCleanPromises.concat(
      publicNodesCleanPromises
    )

    return Promise.all(cleanPromises)
  }

  nodeOutput(type, counter, outputField) {
    const cwd = this._terraformNodeDirPath(type, counter)
    const options = { cwd }

    return this._cmd(`output -json ${outputField}`, options)
  }

  async _create(type, sshKey, nodes) {
    const createPromises = []

    console.log({ nodes })

    for (let counter = 0; counter < nodes.length; counter++) {
      console.log({ counter })
      const cwd = this._terraformNodeDirPath(type, counter)
      // const backendConfig = this._backendConfig(type, counter);
      const nodeName = this._nodeName(type, counter)
      createPromises.push(
        new Promise(async resolve => {
          const options = { cwd }
          // await this._cmd(`init -var state_project=${this.config.state.project} -backend-config=bucket=${backendConfig.bucket} -backend-config=prefix=${backendConfig.prefix}`, options);
          await this._cmd(`init`, options)

          this._createVarsFile(cwd, nodes[counter], sshKey, nodeName)

          console.log({ options })

          cmd.exec(`pwd`)
          await this._cmd(`apply -auto-approve`, options)

          resolve(true)
        })
      )
    }
    return createPromises
  }

  async _check_environment_variables(nodes) {
    const supported_providers = {
      "aws": [
        { name: "AWS_ACCESS_KEY_ID" },
        { name: "AWS_SECRET_ACCESS_KEY" }
      ],
      "do": [
        { name: "DIGITALOCEAN_TOKEN" }
      ],
      "gcp": [
        { name: "GOOGLE_APPLICATION_CREDENTIALS" }
      ]
    }
    for (let i = 0; i < nodes.length; i++) {
      let provider_n = nodes[i].provider
      if (provider_n in supported_providers) {
        console.log(chalk.green(`[Gantree] COMPATIBLE PROVIDER: ${provider_n}`))
        const required_env_vars = supported_providers[provider_n]
        for (let i = 0; i < required_env_vars.length; i++) {
          const required_env_var = required_env_vars[i].name
          if (required_env_var in process.env) {
            console.log(chalk.green(`[Gantree] Require env var found: ${required_env_var}`))
          } else {
            console.log(chalk.red(`[Gantree] Require env var not found!: ${required_env_var}`))
            process.exit(-1)
          }
        }
      } else {
        console.log(chalk.red(`[Gantree] INCOMPATIBLE PROVIDER: ${provider_n}`))
        process.exit(-1)
      }
    }
  }

  async _destroy(type, nodes) {
    const destroyPromises = []

    for (let counter = 0; counter < nodes.length; counter++) {
      const cwd = this._terraformNodeDirPath(type, counter)
      console.log({ cwd })
      // const backendConfig = this._backendConfig(type, counter);
      destroyPromises.push(
        new Promise(async resolve => {
          const options = { cwd }
          // await this._cmd(`init -var state_project=${this.config.state.project} -backend-config=bucket=${backendConfig.bucket} -backend-config=prefix=${backendConfig.prefix}`, options);
          await this._cmd(`init`, options)

          await this._cmd('destroy -lock=false -auto-approve', options)

          resolve(true)
        })
      )
    }
    return destroyPromises
  }

  async _cmd(command, options = {}) {
    const actualOptions = Object.assign({}, this.options, options)
    return cmd.exec(`terraform ${command}`, actualOptions)
  }

  // async _initState(){
  //   const cwd = this._terraformNodeDirPath('remote-state');
  //   const options = { cwd };

  //   await this._cmd(`init -var state_project=${this.config.state.project}`, options);
  //   const bucketName = this._bucketName()
  //   return this._cmd(`apply -var state_project=${this.config.state.project} -var name=${bucketName} -auto-approve`, options);
  // }

  _createVarsFile(cwd, node, sshKey, nodeName) {
    const data = {
      dir: path.resolve(__dirname),
      publicKey: sshKey,
      sshUser: node.sshUser,
      machineType: node.machineType,
      location: node.location,
      zone: node.zone,
      projectId: node.projectId,
      nodeCount: node.count || 1,
      name: nodeName
    }

    const source = path.join(__dirname, '..', '..', '..', 'tpl', 'tfvars')
    const target = path.join(cwd, 'terraform.tfvars')

    tpl.create(source, target, data)
  }

  _initializeTerraform() {
    fs.removeSync(this.terraformFilesPath)
    fs.ensureDirSync(this.terraformFilesPath)

    // console.log(this.terraformFilesPath)

    // this._copyTerraformFiles('remote-state', 0, 'remote-state');
    // console.log(this.config.validators)
    for (
      let counter = 0;
      counter < this.config.validators.nodes.length;
      counter++
    ) {
      // console.log(counter)
      this._copyTerraformFiles(
        'validator',
        counter,
        this.config.validators.nodes[counter].provider
      )
    }

    // for (let counter = 0; counter < this.config.publicNodes.nodes.length; counter++) {
    //   this._copyTerraformFiles('publicNode', counter, this.config.publicNodes.nodes[counter].provider);
    // }
  }

  _copyTerraformFiles(type, counter, provider) {
    const targetDirPath = this._terraformNodeDirPath(type, counter)
    const originDirPath = path.join(this.terraformOriginPath, provider)
    // console.log({targetDirPath, originDirPath})
    // fs.mkdirSync(targetDirPath, {recursive: true})
    fs.ensureDirSync(targetDirPath)
    // console.log('yee')

    const name = this._nodeName(type, counter)

    fs.readdirSync(originDirPath).forEach(item => {
      console.log({ item })
      const origin = path.join(originDirPath, item)
      const target = path.join(targetDirPath, item)
      const data = {
        dir: path.resolve(path.join(__dirname, '..', '..', '..')),
        name
      }
      console.log({ origin, target, data })
      tpl.create(origin, target, data)
    })
  }

  _terraformNodeDirPath(type, counter = 0) {
    const dirName = this._nodeName(type, counter)
    return path.join(this.terraformFilesPath, dirName)
  }

  // _backendConfig(type, counter) {
  //   const bucket = this._bucketName();
  //   const prefix = this._nodeName(type, counter);

  //   return { bucket, prefix };
  // }

  // _bucketName() {
  //   return `${this.config.project}-sv-tf-state`
  // }

  _nodeName(type, counter) {
    const name = `${type}${counter}`
    return name.toLowerCase()
  }
}

module.exports = {
  Terraform
}
