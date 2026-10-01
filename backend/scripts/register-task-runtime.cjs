const path = require('node:path');

require('ts-node').register({
  project: path.resolve(__dirname, '../tsconfig.json'),
  transpileOnly: true,
  // Prisma's generated TypeScript imports .js paths for compiled output.
  experimentalResolver: true,
});
