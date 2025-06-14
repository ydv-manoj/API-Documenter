const yaml = require('js-yaml');

/**
 * OpenAPI specification generator
 */
class Generator {
  constructor(options = {}) {
    this.options = {
      title: 'API Documentation',
      description: 'Generated API documentation',
      version: '1.0.0',
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server'
        }
      ],
      ...options
    };
  }

  /**
   * Generate OpenAPI specification from parsed route data
   * @param {Object} parseResult - Result from parser
   * @param {Object} options - Generation options
   * @returns {Promise<Object>}
   */
  async generate(parseResult, options = {}) {
    const { format = 'json', title, description } = options;

    console.log(`📖 Generating ${format.toUpperCase()} documentation...`);

    try {
      // Build OpenAPI specification
      const openApiSpec = this.buildOpenApiSpec(parseResult, { title, description });

      // Convert to requested format
      let content;
      switch (format.toLowerCase()) {
        case 'yaml':
        case 'yml':
          content = yaml.dump(openApiSpec, { indent: 2, lineWidth: -1 });
          break;
        case 'json':
        default:
          content = JSON.stringify(openApiSpec, null, 2);
          break;
      }

      return {
        openApiSpec,
        content,
        format,
        routes: parseResult.routes.length,
        summary: parseResult.summary
      };

    } catch (error) {
      console.error('Generator error:', error.message);
      throw error;
    }
  }

  /**
   * Build OpenAPI 3.0 specification
   * @param {Object} parseResult 
   * @param {Object} options 
   * @returns {Object}
   */
  buildOpenApiSpec(parseResult, options = {}) {
    const spec = {
      openapi: '3.0.3',
      info: {
        title: options.title || this.options.title,
        description: options.description || this.options.description,
        version: this.options.version,
        'x-generated-by': 'API-Documenter',
        'x-generated-at': new Date().toISOString()
      },
      servers: this.options.servers,
      paths: {},
      components: {
        schemas: {},
        parameters: {},
        responses: {}
      },
      tags: []
    };

    // Process routes and group by path
    const pathGroups = this.groupRoutesByPath(parseResult.routes);

    // Generate paths
    for (const [path, routes] of Object.entries(pathGroups)) {
      spec.paths[path] = this.buildPathItem(routes, parseResult);
    }

    // Generate components
    spec.components.schemas = this.buildSchemas(parseResult);
    spec.tags = this.buildTags(parseResult.routes);

    // Add summary information
    spec['x-summary'] = {
      totalRoutes: parseResult.routes.length,
      frameworks: parseResult.summary.frameworks,
      httpMethods: parseResult.summary.httpMethods,
      categories: this.getRouteCategories(parseResult.routes)
    };

    return spec;
  }

  /**
   * Group routes by path for OpenAPI structure
   * @param {Array} routes 
   * @returns {Object}
   */
  groupRoutesByPath(routes) {
    const groups = {};
    
    routes.forEach(route => {
      const path = this.normalizeOpenApiPath(route.path);
      if (!groups[path]) {
        groups[path] = [];
      }
      groups[path].push(route);
    });

    return groups;
  }

  /**
   * Normalize path for OpenAPI format
   * @param {string} path 
   * @returns {string}
   */
  normalizeOpenApiPath(path) {
    // Convert Express-style parameters (:param) to OpenAPI style ({param})
    return path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
  }

  /**
   * Build OpenAPI path item for a set of routes
   * @param {Array} routes 
   * @param {Object} parseResult 
   * @returns {Object}
   */
  buildPathItem(routes, parseResult) {
    const pathItem = {};

    routes.forEach(route => {
      const operation = this.buildOperation(route, parseResult);
      pathItem[route.method.toLowerCase()] = operation;
    });

    return pathItem;
  }

  /**
   * Build OpenAPI operation object
   * @param {Object} route 
   * @param {Object} parseResult 
   * @returns {Object}
   */
  buildOperation(route, parseResult) {
    const operation = {
      summary: route.documentation?.summary || `${route.method} ${route.path}`,
      description: route.documentation?.description || `${route.method} operation for ${route.path}`,
      operationId: route.id || `${route.method.toLowerCase()}_${route.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
      tags: [route.category || 'general'],
      parameters: [],
      responses: {}
    };

    // Add path parameters
    if (route.parameters) {
      route.parameters.forEach(param => {
        operation.parameters.push({
          name: param.name,
          in: param.in,
          required: param.required || false,
          schema: {
            type: param.type || 'string'
          },
          description: param.description || `${param.name} parameter`
        });
      });
    }

    // Add request body for methods that typically have one
    if (['POST', 'PUT', 'PATCH'].includes(route.method) && route.requestSchema) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: route.requestSchema
          }
        }
      };
    }

    // Add responses
    operation.responses = this.buildResponses(route);

    // Add metadata
    if (route.metadata) {
      operation['x-metadata'] = {
        hasAuth: route.metadata.hasAuth,
        hasValidation: route.metadata.hasValidation,
        complexity: route.metadata.complexity,
        framework: route.framework
      };
    }

    return operation;
  }

  /**
   * Build responses for a route
   * @param {Object} route 
   * @returns {Object}
   */
  buildResponses(route) {
    const responses = {
      '200': {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: route.responseSchema || {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'Success'
                }
              }
            }
          }
        }
      }
    };

    // Add common error responses
    if (route.metadata?.hasAuth) {
      responses['401'] = {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string', example: 'Unauthorized' }
              }
            }
          }
        }
      };
    }

    if (route.metadata?.hasValidation) {
      responses['400'] = {
        description: 'Bad Request - Validation Error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string', example: 'Validation failed' },
                details: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      };
    }

    responses['500'] = {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: { type: 'string', example: 'Internal server error' }
            }
          }
        }
      }
    };

    return responses;
  }

  /**
   * Build schemas component
   * @param {Object} parseResult 
   * @returns {Object}
   */
  buildSchemas(parseResult) {
    const schemas = {};

    // Add schemas from parsed results
    if (parseResult.schemas) {
      Object.assign(schemas, parseResult.schemas);
    }

    // Add common schemas
    schemas.Error = {
      type: 'object',
      properties: {
        error: {
          type: 'string',
          description: 'Error message'
        },
        code: {
          type: 'string',
          description: 'Error code'
        }
      }
    };

    schemas.Success = {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Success message'
        },
        data: {
          type: 'object',
          description: 'Response data'
        }
      }
    };

    return schemas;
  }

  /**
   * Build tags for grouping operations
   * @param {Array} routes 
   * @returns {Array}
   */
  buildTags(routes) {
    const categories = new Set();
    routes.forEach(route => {
      categories.add(route.category || 'general');
    });

    return Array.from(categories).map(category => ({
      name: category,
      description: this.getCategoryDescription(category)
    }));
  }

  /**
   * Get description for route category
   * @param {string} category 
   * @returns {string}
   */
  getCategoryDescription(category) {
    const descriptions = {
      authentication: 'Authentication and authorization endpoints',
      'user-management': 'User management operations',
      'versioned-api': 'Versioned API endpoints',
      admin: 'Administrative operations',
      'health-check': 'Health check and monitoring endpoints',
      general: 'General API operations'
    };

    return descriptions[category] || `${category} operations`;
  }

  /**
   * Get route categories with counts
   * @param {Array} routes 
   * @returns {Object}
   */
  getRouteCategories(routes) {
    const categories = {};
    routes.forEach(route => {
      const category = route.category || 'general';
      categories[category] = (categories[category] || 0) + 1;
    });
    return categories;
  }
}

module.exports = Generator;