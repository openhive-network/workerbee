# AutoBee

Example bot to use in your browser app based on the wax and beekeeper library

## Install

This is a [Node.js](https://nodejs.org/en/) module available through the
[npm registry](https://www.npmjs.com/).

Before installing, [download and install Node.js](https://nodejs.org/en/download/).
Node.js 12 or higher is required.

Installation is done using the
[`npm install` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):

```bash
npm install @hive-staging/autobee
```

## Usage

### Simple bot usage

```js
import bootstrap from '@hive-staging/autobee';

await bootstrap();
```

## API

See API definition in [api.md](https://gitlab.syncad.com/mtyszczak/autobee/-/blob/${CommitSHA}/api.md)

## Support and tests

Tested on the latest Chromium (v117)

[Automated CI test](https://gitlab.syncad.com/mtyszczak/autobee/-/pipelines) runs are available.

To run the tests on your own, clone the Wax repo and install the dependencies and then compile the project:

```bash
sudo npm install -g pnpm
pnpm install
```

Compile source:

```bash
npm run build
```

Then run tests:

```bash
npm run test
```

## License

See license in the [LICENSE.md](https://gitlab.syncad.com/mtyszczak/autobee/-/blob/${CommitSHA}/LICENSE.md) file
