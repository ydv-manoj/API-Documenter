#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const Scanner = require('../scanner');
const Parser = require('../parser');
const Generator = require('../generator');
const Server = require('../server');
const fs = require('fs-extra');
const path = require('path');

const program = new Command();

program
  .name('api-documenter')
  .description('Automatically scan your codebase and generate interactive Swagger UI documentation')
  .version('1.0.0');

program
  .command('scan')
  .description('Scan your codebase for API routes')
  .argument('[directory]', 'Directory to scan', './src')
  .option('-o, --output <path>', 'Output directory for generated docs', './docs')
  .option('-c, --config <path>', 'Path to config file')
  .option('-f, --format <format>', 'Output format (json|yaml)', 'json')
  .action(async (directory, options) => {
    const spinner = ora('Scanning for API routes...').start();
    
    try {
      // Initialize scanner
      const scanner = new Scanner();
      const routeFiles = await scanner.findRouteFiles(directory);
      
      spinner.text = `Found ${routeFiles.length} route files. Parsing...`;
      
      // Parse routes
      const parser = new Parser();
      const routes = [];
      
      for (const file of routeFiles) {
        const fileRoutes = await parser.parseFile(file);
        routes.push(...fileRoutes);
      }
      
      spinner.text = `Parsed ${routes.length} routes. Generating documentation...`;
      
      // Generate OpenAPI spec
      const generator = new Generator();
      const openApiSpec = generator.generateSpec(routes);
      
      // Ensure output directory exists
      await fs.ensureDir(options.output);
      
      // Write spec file
      const specFile = path.join(options.output, `openapi.${options.format}`);
      if (options.format === 'yaml') {
        const yaml = require('yaml');
        await fs.writeFile(specFile, yaml.stringify(openApiSpec));
      } else {
        await fs.writeJSON(specFile, openApiSpec, { spaces: 2 });
      }
      
      spinner.succeed(`Generated API documentation at ${chalk.green(specFile)}`);
      
      console.log(chalk.cyan('\nRoutes discovered:'));
      routes.forEach(route => {
        console.log(`  ${chalk.yellow(route.method.padEnd(6))} ${route.path}`);
      });
      
      console.log(chalk.cyan('\nRun the following to serve interactive docs:'));
      console.log(chalk.white(`  api-documenter serve --spec ${specFile}`));
      
    } catch (error) {
      spinner.fail('Failed to scan API routes');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Start documentation server with Swagger UI')
  .option('-p, --port <port>', 'Port to serve on', '3001')
  .option('-s, --spec <path>', 'Path to OpenAPI spec file', './docs/openapi.json')
  .option('-w, --watch', 'Watch for file changes and auto-reload')
  .option('--host <host>', 'Host to bind to', 'localhost')
  .action(async (options) => {
    const spinner = ora('Starting documentation server...').start();
    
    try {
      const server = new Server();
      await server.start({
        port: parseInt(options.port),
        host: options.host,
        specPath: options.spec,
        watch: options.watch
      });
      
      const url = `http://${options.host}:${options.port}`;
      spinner.succeed(`Documentation server running at ${chalk.green(url)}`);
      
      console.log(chalk.cyan('\nPress Ctrl+C to stop the server'));
      console.log(chalk.white(`Open your browser and go to: ${url}`));
      
      // Auto-open browser with dynamic import
      try {
        const { default: open } = await import('open');
        await open(url);
      } catch (error) {
        console.log(chalk.yellow('Could not auto-open browser. Please open manually.'));
      }
      
    } catch (error) {
      spinner.fail('Failed to start server');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Generate configuration file')
  .option('-f, --force', 'Overwrite existing config file')
  .action(async (options) => {
    const configPath = './api-doc.config.js';
    
    if (await fs.pathExists(configPath) && !options.force) {
      console.log(chalk.yellow('Configuration file already exists. Use --force to overwrite.'));
      return;
    }
    
    const defaultConfig = `module.exports = {
  // Directories to scan for route files
  scanDirs: ['./src', './routes'],
  
  // File patterns to include
  include: ['**/*.js', '**/*.ts'],
  
  // File patterns to exclude
  exclude: ['**/node_modules/**', '**/test/**', '**/*.test.js'],
  
  // Server configuration
  server: {
    port: 3001,
    host: 'localhost'
  },
  
  // OpenAPI specification info
  info: {
    title: 'API Documentation',
    version: '1.0.0',
    description: 'Auto-generated API documentation'
  },
  
  // Supported frameworks
  frameworks: ['express'],
  
  // Output configuration
  output: {
    dir: './docs',
    format: 'json' // json or yaml
  }
};`;
    
    await fs.writeFile(configPath, defaultConfig);
    console.log(chalk.green(`Configuration file created at ${configPath}`));
  });

// Global error handler
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});

program.parse();