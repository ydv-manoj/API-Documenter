const expressParser = require('./expressParser');
const astAnalyzer = require('./astAnalyzer');
const fileScanner = require('../scanner/fileScanner');

/**
 * Main parser for extracting detailed route information from code
 */
class Parser {
  constructor(options = {}) {
    this.options = {
      parseComments: true,
      inferSchemas: true,
      extractMiddleware: true,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      ...options
    };
  }

  /**
   * Parse route files to extract detailed API information
   * @param {Array} files - Array of file objects from scanner
   * @returns {Promise<Object>} Parsed route information
   */
  async parseFiles(files) {
    console.log(`📝 Parsing ${files.length} route files...`);

    const results = {
      routes: [],
      middleware: [],
      schemas: {},
      errors: [],
      summary: {
        totalRoutes: 0,
        frameworks: new Set(),
        httpMethods: new Set()
      }
    };

    for (const file of files) {
      try {
        console.log(`   Parsing ${file.path}`);
        const parseResult = await this.parseFile(file);
        
        if (parseResult.routes.length > 0) {
          results.routes.push(...parseResult.routes);
          results.middleware.push(...parseResult.middleware);
          
          // Merge schemas
          Object.assign(results.schemas, parseResult.schemas);
          
          // Update summary
          results.summary.totalRoutes += parseResult.routes.length;
          results.summary.frameworks.add(file.framework);
          
          parseResult.routes.forEach(route => {
            results.summary.httpMethods.add(route.method);
          });
        }
      } catch (error) {
        console.warn(`⚠️  Failed to parse ${file.path}:`, error.message);
        results.errors.push({
          file: file.path,
          error: error.message
        });
      }
    }

    // Convert Sets to Arrays for JSON serialization
    results.summary.frameworks = Array.from(results.summary.frameworks);
    results.summary.httpMethods = Array.from(results.summary.httpMethods);

    console.log(`✅ Parsing complete: ${results.routes.length} routes extracted`);
    return results;
  }

  /**
   * Parse a single file for route information
   * @param {Object} file - File object with path and framework info
   * @returns {Promise<Object>}
   */
  async parseFile(file) {
    const content = await fileScanner.readFileContent(file.path);
    if (!content) {
      throw new Error('Could not read file content');
    }

    // Check file size
    if (content.length > this.options.maxFileSize) {
      throw new Error(`File too large: ${content.length} bytes`);
    }

    const parseResult = {
      routes: [],
      middleware: [],
      schemas: {},
      filePath: file.path,
      framework: file.framework
    };

    try {
      // Parse with framework-specific parser
      switch (file.framework) {
        case 'express':
          const expressResult = await expressParser.parse(content, file.path, this.options);
          Object.assign(parseResult, expressResult);
          break;
          
        case 'fastify':
          // TODO: Implement fastify parser
          console.warn('Fastify parsing not yet implemented');
          break;
          
        case 'koa':
          // TODO: Implement koa parser
          console.warn('Koa parsing not yet implemented');
          break;
          
        default:
          // Try generic AST parsing
          const genericResult = await astAnalyzer.parseGeneric(content, file.path, this.options);
          Object.assign(parseResult, genericResult);
      }

      // Enhance routes with additional analysis
      parseResult.routes = parseResult.routes.map(route => this.enhanceRoute(route, content));

      return parseResult;
    } catch (error) {
      console.error(`Parser error in ${file.path}:`, error.message);
      throw error;
    }
  }

  /**
   * Enhance route with additional metadata and analysis
   * @param {Object} route 
   * @param {string} content 
   * @returns {Object}
   */
  enhanceRoute(route, content) {
    const enhanced = { ...route };

    // Add unique ID
    enhanced.id = this.generateRouteId(route);

    // Analyze route parameters
    enhanced.parameters = this.extractParameters(route.path);

    // Try to infer response schema
    if (this.options.inferSchemas) {
      enhanced.responseSchema = this.inferResponseSchema(route, content);
      enhanced.requestSchema = this.inferRequestSchema(route, content);
    }

    // Extract JSDoc comments if available
    if (this.options.parseComments && route.comments) {
      enhanced.documentation = this.parseJSDocComments(route.comments);
    }

    // Categorize route
    enhanced.category = this.categorizeRoute(route.path);

    // Add metadata
    enhanced.metadata = {
      hasAuth: this.detectAuthentication(route, content),
      hasValidation: this.detectValidation(route, content),
      isAsync: route.isAsync || false,
      complexity: this.calculateComplexity(route)
    };

    return enhanced;
  }

  /**
   * Generate unique ID for route
   * @param {Object} route 
   * @returns {string}
   */
  generateRouteId(route) {
    const pathKey = route.path.replace(/[^a-zA-Z0-9]/g, '_');
    return `${route.method.toLowerCase()}_${pathKey}`;
  }

  /**
   * Extract parameters from route path
   * @param {string} path 
   * @returns {Array}
   */
  extractParameters(path) {
    const parameters = [];
    
    // Express-style parameters (:param)
    const expressParams = path.match(/:([a-zA-Z0-9_]+)/g);
    if (expressParams) {
      expressParams.forEach(param => {
        parameters.push({
          name: param.substring(1),
          in: 'path',
          type: 'string',
          required: true
        });
      });
    }

    // Capture groups ({param})
    const captureParams = path.match(/{([a-zA-Z0-9_]+)}/g);
    if (captureParams) {
      captureParams.forEach(param => {
        const name = param.slice(1, -1);
        if (!parameters.find(p => p.name === name)) {
          parameters.push({
            name,
            in: 'path',
            type: 'string',
            required: true
          });
        }
      });
    }

    return parameters;
  }

  /**
   * Infer response schema from route handler
   * @param {Object} route 
   * @param {string} content 
   * @returns {Object|null}
   */
  inferResponseSchema(route, content) {
    // Simple schema inference - can be enhanced with AST analysis
    try {
      // Look for common response patterns
      const responsePatterns = [
        /res\.json\s*\(\s*{([^}]+)}/,
        /res\.send\s*\(\s*{([^}]+)}/,
        /return\s*{([^}]+)}/
      ];

      for (const pattern of responsePatterns) {
        const match = content.match(pattern);
        if (match) {
          // Basic schema extraction - can be improved
          return {
            type: 'object',
            properties: {
              // Simplified - would need proper AST parsing for accurate schemas
              data: { type: 'object' }
            }
          };
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Infer request schema from route handler
   * @param {Object} route 
   * @param {string} content 
   * @returns {Object|null}
   */
  inferRequestSchema(route, content) {
    if (['POST', 'PUT', 'PATCH'].includes(route.method)) {
      // Look for body parsing patterns
      if (content.includes('req.body')) {
        return {
          type: 'object',
          properties: {
            // Simplified - would need proper analysis
          }
        };
      }
    }
    return null;
  }

  /**
   * Parse JSDoc comments
   * @param {string} comments 
   * @returns {Object}
   */
  parseJSDocComments(comments) {
    const doc = {
      summary: '',
      description: '',
      tags: []
    };

    try {
      // Simple JSDoc parsing - can be enhanced
      const lines = comments.split('\n');
      for (const line of lines) {
        const trimmed = line.trim().replace(/^\*\s?/, '');
        if (trimmed.startsWith('@')) {
          const [tag, ...rest] = trimmed.split(' ');
          doc.tags.push({
            tag: tag.substring(1),
            value: rest.join(' ')
          });
        } else if (trimmed && !doc.description) {
          doc.description = trimmed;
        }
      }

      doc.summary = doc.description.split('.')[0] || '';
      return doc;
    } catch (error) {
      return doc;
    }
  }

  /**
   * Categorize route based on path patterns
   * @param {string} path 
   * @returns {string}
   */
  categorizeRoute(path) {
    if (path.includes('/auth')) return 'authentication';
    if (path.includes('/api/v')) return 'versioned-api';
    if (path.includes('/admin')) return 'admin';
    if (path.includes('/user')) return 'user-management';
    if (path.includes('/health')) return 'health-check';
    return 'general';
  }

  /**
   * Detect authentication patterns
   * @param {Object} route 
   * @param {string} content 
   * @returns {boolean}
   */
  detectAuthentication(route, content) {
    const authPatterns = [
      /auth/i,
      /jwt/i,
      /token/i,
      /authenticate/i,
      /passport/i,
      /req\.user/,
      /authorization/i
    ];

    return authPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Detect validation patterns
   * @param {Object} route 
   * @param {string} content 
   * @returns {boolean}
   */
  detectValidation(route, content) {
    const validationPatterns = [
      /validate/i,
      /joi/i,
      /yup/i,
      /ajv/i,
      /schema/i,
      /check\(/,
      /body\(/
    ];

    return validationPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Calculate route complexity score
   * @param {Object} route 
   * @returns {number}
   */
  calculateComplexity(route) {
    let complexity = 1; // Base complexity

    // Add complexity for parameters
    if (route.parameters && route.parameters.length > 0) {
      complexity += route.parameters.length * 0.5;
    }

    // Add complexity for middleware
    if (route.middleware && route.middleware.length > 0) {
      complexity += route.middleware.length * 0.3;
    }

    // Add complexity for async operations
    if (route.isAsync) {
      complexity += 1;
    }

    return Math.round(complexity * 10) / 10;
  }
}

module.exports = Parser;