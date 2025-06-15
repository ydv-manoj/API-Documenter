const express = require('express');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const fs = require('fs').promises;

/**
 * Swagger UI server for interactive API documentation
 */
class SwaggerServer {
  constructor(options = {}) {
    this.options = {
      port: 3001,
      host: 'localhost',
      openApiSpec: null,
      watch: false,
      ...options
    };
    
    this.app = express();
    this.server = null;
  }

  /**
   * Start the documentation server
   */
  async start() {
    try {
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Start server
      await this.startServer();
      
      console.log(`📖 Documentation server running at http://${this.options.host}:${this.options.port}`);
      
    } catch (error) {
      console.error('Failed to start server:', error.message);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop() {
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
      console.log('Server stopped');
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Enable CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      next();
    });

    // Parse JSON bodies
    this.app.use(express.json());
    
    // Serve static files
    this.app.use(express.static('public'));
  }

  /**
   * Setup routes
   */
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Serve OpenAPI spec
    this.app.get('/openapi.json', (req, res) => {
      if (this.options.openApiSpec) {
        res.json(this.options.openApiSpec);
      } else {
        res.status(404).json({ error: 'OpenAPI specification not available' });
      }
    });

    // API proxy route (for testing APIs through the documentation)
    this.app.all('/api-proxy/*', this.handleApiProxy.bind(this));

    // Swagger UI
    if (this.options.openApiSpec) {
      const swaggerOptions = {
        explorer: true,
        swaggerOptions: {
          url: '/openapi.json',
          tryItOutEnabled: true,
          requestInterceptor: (req) => {
            // Modify requests to go through proxy if needed
            if (req.url.startsWith('/')) {
              req.url = `/api-proxy${req.url}`;
            }
            return req;
          }
        }
      };

      this.app.use('/', swaggerUi.serve);
      this.app.get('/', swaggerUi.setup(this.options.openApiSpec, swaggerOptions));
    } else {
      // Default landing page if no spec available
      this.app.get('/', (req, res) => {
        res.send(this.getDefaultHtml());
      });
    }

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ 
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`
      });
    });

    // Error handler
    this.app.use((error, req, res, next) => {
      console.error('Server error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message
      });
    });
  }

  /**
   * Handle API proxy requests for testing
   */
  async handleApiProxy(req, res) {
    try {
      const targetUrl = req.path.replace('/api-proxy', '');
      
      // This is a simplified proxy - in a real implementation,
      // you'd want to proxy to the actual API server
      res.json({
        message: 'API proxy endpoint',
        method: req.method,
        path: targetUrl,
        body: req.body,
        query: req.query,
        headers: req.headers
      });
      
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Start the Express server
   */
  async startServer() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.options.port, this.options.host, () => {
          resolve();
        });

        this.server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            reject(new Error(`Port ${this.options.port} is already in use`));
          } else {
            reject(error);
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get default HTML when no OpenAPI spec is available
   */
  getDefaultHtml() {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>API Documenter</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; }
    .header { text-align: center; margin-bottom: 40px; }
    .status { background: #fff3cd; padding: 20px; border-radius: 4px; border-left: 4px solid #ffc107; }
    .commands { background: #f8f9fa; padding: 20px; border-radius: 4px; margin-top: 20px; }
    code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
    .logo { font-size: 48px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🚀</div>
      <h1>API Documenter</h1>
      <p>Interactive API Documentation Generator</p>
    </div>
    
    <div class="status">
      <h3>⚠️ No API Documentation Found</h3>
      <p>The server is running, but no OpenAPI specification has been generated yet.</p>
    </div>

    <div class="commands">
      <h3>📝 Generate Documentation</h3>
      <p>Run one of these commands to generate API documentation:</p>
      <ul>
        <li><code>api-documenter scan ./src</code> - Scan your project for routes</li>
        <li><code>api-documenter scan ./routes</code> - Scan a specific directory</li>
        <li><code>api-documenter scan . --port ${this.options.port}</code> - Scan current directory</li>
      </ul>
    </div>

    <div class="commands">
      <h3>🔗 Useful Links</h3>
      <ul>
        <li><a href="/health">Health Check</a> - Server status</li>
        <li><a href="/openapi.json">OpenAPI Spec</a> - Raw specification (when available)</li>
        <li><a href="https://github.com/ydv-manoj/API-Documenter">GitHub Repository</a></li>
      </ul>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Set OpenAPI specification
   */
  setOpenApiSpec(spec) {
    this.options.openApiSpec = spec;
  }
}

module.exports = SwaggerServer;