module.exports = {
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
};