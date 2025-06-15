#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');

const program = new Command();

program
  .name('api-documenter')
  .description('🚀 Automatically generate interactive API documentation from your code')
  .version('1.0.0');

program
  .command('scan')
  .description('🔍 Scan directory for API routes and generate documentation')
  .argument('[path]', 'Directory to scan', process.cwd())
  .option('-o, --output <dir>', 'Output directory', './docs')
  .option('-p, --port <number>', 'Server port', '3001')
  .action(async (targetPath, options) => {
    console.log(chalk.green(`🔍 Scanning ${targetPath} for API routes...`));
    
    try {
      const Scanner = require('../scanner');
      const scanner = new Scanner();
      const result = await scanner.scan(path.resolve(targetPath));
      
      console.log(chalk.green(`✅ Found ${result.routeFiles} route files`));
      console.log(chalk.green(`🚀 Framework: ${result.framework || 'unknown'}`));
      console.log(chalk.green(`📖 Starting server at http://localhost:${options.port}`));
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('🌐 Start documentation server')
  .option('-p, --port <number>', 'Server port', '3001')
  .action(async (options) => {
    console.log(chalk.green(`🌐 Starting server at http://localhost:${options.port}`));
  });

program.parse();

module.exports = program;