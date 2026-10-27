#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const help = `Ludic Canvas project and font tools

Usage: ludic-canvas init [directory] [--template canvas2d|three]
       ludic-canvas fonts [--config <file>] [--force]
       ludic-canvas fonts --init [--config <file>]

init             Generate a project in a new or empty directory (default: ludic-game)
--template       World renderer for init (default: canvas2d)
--config <file>  JSON configuration (default: ludic-canvas.fonts.json)
--force          Regenerate even when inputs and outputs match the cache
--init           Write an example configuration; existing files are preserved
--help           Show this help
--version        Show the installed package version

Inputs: outline TTF, OTF, WOFF and WOFF2. Outputs: MTSDF PNG and JSON metrics.
The compiler ships as WASM. No native tools or network access are required.
`;

try {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) console.log(help);
  else if (args.length === 1 && args[0] === '--version') {
    console.log(JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version);
  } else {
    if (args[0] === 'init') {
      args.shift();
      let directory, template;
      while (args.length) {
        const argument = args.shift();
        if (argument === '--template') {
          if (template || !args[0] || args[0].startsWith('-')) throw new Error('--template requires canvas2d or three');
          template = args.shift();
        } else if (argument.startsWith('-')) throw new Error(`Unknown option: ${argument}`);
        else {
          if (directory) throw new Error('init accepts one project directory');
          directory = argument;
        }
      }
      const { initProject } = await import('./init.mjs');
      const result = await initProject(directory, { template });
      console.log(
        `Created ${result.template} project at ${result.directory}\nOpen that directory, then run:\n  npm install\n  npm run dev`,
      );
    } else {
      if (args.shift() !== 'fonts') throw new Error('Unknown command. Run ludic-canvas --help.');
      const options = { force: false };
      let config,
        init = false;
      while (args.length) {
        const flag = args.shift();
        if (flag === '--config' || flag === '-c') {
          if (config || !args[0] || args[0].startsWith('-')) throw new Error('--config requires one file path');
          config = args.shift();
        } else if (flag === '--force') options.force = true;
        else if (flag === '--init') init = true;
        else throw new Error(`Unknown option: ${flag}`);
      }
      if (init && options.force) throw new Error('--init and --force cannot be combined');
      const { generateFontAtlases, initConfig } = await import('./fonts.mjs');
      if (init)
        console.log(`Created ${await initConfig(config)}. Set your font source paths, then run ludic-canvas fonts.`);
      else await generateFontAtlases(config, options);
    }
  }
} catch (error) {
  console.error(`ludic-canvas: ${error.message}`);
  process.exitCode = 1;
}
