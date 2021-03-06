# Gantree CLI

A command-line interface for gantree-lib written in NodeJS.

## Important Note

Please see [gantree-lib](https://github.com/flex-dapps/gantree-lib-nodejs) for information regarding:

- Library requirements
- How to write Gantree configurations
- Misc. important information

## Installation

### External Requirements

**Important:** Please ensure you have installed all external requirements for [gantree-lib](https://github.com/flex-dapps/gantree-lib-nodejs) first.

### Installing via npm

To install the latest **stable** release, use:

```bash
npm install gantree-cli@stable -g
```

\- ***OR*** -

To instead install the latest **beta** release, use:

```bash
npm install gantree-cli@beta -g
```

## Usage

### Synchronisation

To synchronise your configuration with digital infrastructure (create/update/etc.), run the following:

```bash
gantree-cli sync -c [gantree_config_file_path]
```

See `gantree-cli sync --help` for all supported flags

### Cleaning up

To remove all infrastructure defined in your configuration, run the following:

```bash
gantree-cli clean -c [gantree_config_file_path]
```

See `gantree-cli clean --help` for all supported flags

## Todo

- Add information on CLI supported environment variables
