const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const Scanner = require('../scanner');
const Parser = require('../parser');
const Generator = require('../generator');
const Server = require('../server');
const AIAnalyzer = require('../ai');
const fs = require('fs-extra');
const path = require('path');

const program = new Command();

program
  .name('api-documenter')
  .description('AI-powered API documentation generator')
  .version('1.0.0');

program
  .command('scan')
  .description('Scan your codebase for API routes and generate AI-powered documentation')
  .argument('[directory]', 'Directory to scan', './src')
  .option('-o, --output <path>', 'Output directory for generated docs', './docs')
  .option('-c, --config <path>', 'Path to config file')
  .option('-f, --format <format>', 'Output format (json|yaml)', 'json')
  .option('--no-ai', 'Disable AI analysis and use template generation')
  .action(async (directory, options) => {
    const spinner = ora('🔍 Scanning for API routes...').start();
    
    try {
      // Check for Groq API key if AI is enabled
      if (options.ai !== false && !process.env.GROQ_API_KEY) {
        spinner.fail('❌ GROQ_API_KEY environment variable is required for AI analysis');
        console.log(chalk.yellow('\n💡 Get your API key from: https://console.groq.com/'));
        console.log(chalk.white('💡 Set it with: export GROQ_API_KEY="your-api-key"'));
        console.log(chalk.cyan('💡 Or use --no-ai flag for basic template generation'));
        process.exit(1);
      }

      // Initialize scanner
      const scanner = new Scanner();
      const routeFiles = await scanner.findRouteFiles(directory);
      
      spinner.text = `📁 Found ${routeFiles.length} route files. Parsing...`;
      
      // Parse routes
      const parser = new Parser();
      const routes = [];
      
      for (const file of routeFiles) {
        const fileRoutes = await parser.parseFile(file);
        routes.push(...fileRoutes);
      }
      
      spinner.text = `📝 Parsed ${routes.length} routes. ${options.ai !== false ? 'Starting AI analysis...' : 'Generating documentation...'}`;
      
      let analysisResults = [];
      
      if (options.ai !== false) {
        // AI-powered analysis
        const aiAnalyzer = new AIAnalyzer(process.env.GROQ_API_KEY);
        spinner.text = `🤖 Analyzing routes with AI (this may take a moment)...`;
        
        analysisResults = await aiAnalyzer.analyzeBatch(routes);
        
        spinner.text = `✨ AI analysis complete. Generating documentation...`;
      } else {
        // Fallback to template generation
        analysisResults = routes.map(route => ({
          route,
          analysis: {
            summary: `${route.method} ${route.path}`,
            description: 'API endpoint',
            tags: ['API'],
            parameters: route.parameters || [],
            statusCodes: { '200': 'Success' }
          }
        }));
      }
      
      // Generate OpenAPI spec
      const generator = new Generator();
      const openApiSpec = generator.generateSpec(analysisResults);
      
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
      
      spinner.succeed(`✅ Generated ${options.ai !== false ? 'AI-powered' : 'template-based'} API documentation`);
      
      console.log(chalk.cyan('\n📋 Routes discovered:'));
      analysisResults.forEach(({ route, analysis }) => {
        console.log(`  ${chalk.yellow(route.method.padEnd(6))} ${route.path} - ${chalk.gray(analysis.summary)}`);
      });
      
      console.log(chalk.green(`\n📄 Documentation saved to: ${specFile}`));
      console.log(chalk.cyan('\n🚀 Start interactive server:'));
      console.log(chalk.white(`  api-documenter serve --spec ${specFile}`));
      
    } catch (error) {
      spinner.fail('❌ Failed to generate API documentation');
      console.error(chalk.red(error.message));
      if (error.message.includes('Groq')) {
        console.log(chalk.yellow('\n💡 Try using --no-ai flag for basic generation without AI'));
      }
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