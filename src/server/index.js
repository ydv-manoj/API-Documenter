const express = require('express');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const chalk = require('chalk');

class Server {
  constructor() {
    this.app = express();
    this.server = null;
  }

  async start(options = {}) {
    const {
      port = 3001,
      host = 'localhost',
      specPath = './docs/openapi.json',
      watch = false
    } = options;

    // Load OpenAPI spec
    let spec = await this.loadSpec(specPath);
    
    if (!spec) {
      throw new Error(`Could not load OpenAPI spec from ${specPath}`);
    }

    // Configure Swagger UI options
    const swaggerOptions = {
      explorer: true,
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info { margin-bottom: 20px }
      `,
      customSiteTitle: 'API Documentation',
      customfavIcon: '/favicon.ico'
    };

    // Setup routes
    this.app.use('/api-docs', swaggerUi.serve);
    this.app.get('/api-docs', swaggerUi.setup(spec, swaggerOptions));
    
    // Redirect root to docs
    this.app.get('/', (req, res) => {
      res.redirect('/api-docs');
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // API endpoint to get current spec
    this.app.get('/spec', (req, res) => {
      res.json(spec);
    });

    // Setup file watching
    if (watch) {
      this.setupFileWatcher(specPath, (newSpec) => {
        spec = newSpec;
        console.log(chalk.green('✓ Specification reloaded'));
      });
    }

    // Start server
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, host, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async loadSpec(specPath) {
    try {
      if (!await fs.pathExists(specPath)) {
        return null;
      }

      const ext = path.extname(specPath).toLowerCase();
      const content = await fs.readFile(specPath, 'utf-8');

      if (ext === '.yaml' || ext === '.yml') {
        const yaml = require('yaml');
        return yaml.parse(content);
      } else {
        return JSON.parse(content);
      }
    } catch (error) {
      console.error(chalk.red(`Error loading spec: ${error.message}`));
      return null;
    }
  }

  setupFileWatcher(specPath, onChange) {
    const watcher = chokidar.watch(specPath);
    
    watcher.on('change', async () => {
      try {
        const newSpec = await this.loadSpec(specPath);
        if (newSpec) {
          onChange(newSpec);
        }
      } catch (error) {
        console.error(chalk.red(`Error reloading spec: ${error.message}`));
      }
    });

    watcher.on('error', (error) => {
      console.error(chalk.red(`File watcher error: ${error.message}`));
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

module.exports = Server;