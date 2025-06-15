class Generator {
  constructor(options = {}) {
    this.options = {
      title: 'API Documentation',
      version: '1.0.0',
      description: 'Auto-generated API documentation',
      baseUrl: 'http://localhost:3000',
      ...options
    };
  }

  generateSpec(routes) {
    const paths = {};
    const components = {
      schemas: {},
      responses: {},
      parameters: {}
    };

    // Group routes by path
    const groupedRoutes = this.groupRoutesByPath(routes);

    // Generate paths
    Object.entries(groupedRoutes).forEach(([path, pathRoutes]) => {
      paths[path] = {};
      
      pathRoutes.forEach(route => {
        const operation = this.generateOperation(route);
        paths[path][route.method.toLowerCase()] = operation;
      });
    });

    const spec = {
      openapi: '3.0.0',
      info: {
        title: this.options.title,
        version: this.options.version,
        description: this.options.description
      },
      servers: [
        {
          url: this.options.baseUrl,
          description: 'Development server'
        }
      ],
      paths,
      components
    };

    return spec;
  }

  groupRoutesByPath(routes) {
    const grouped = {};
    
    routes.forEach(route => {
      if (!grouped[route.path]) {
        grouped[route.path] = [];
      }
      grouped[route.path].push(route);
    });
    
    return grouped;
  }

  generateOperation(route) {
    const operation = {
      summary: this.generateSummary(route),
      description: route.description || this.generateDescription(route),
      tags: this.generateTags(route),
      parameters: this.generateParameters(route),
      responses: this.generateResponses(route)
    };

    // Add request body for POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(route.method)) {
      operation.requestBody = this.generateRequestBody(route);
    }

    return operation;
  }

  generateSummary(route) {
    if (route.description) {
      return route.description.split('.')[0];
    }
    
    const pathParts = route.path.split('/').filter(part => part && !part.startsWith(':'));
    const resource = pathParts[pathParts.length - 1] || 'resource';
    
    const actionMap = {
      'GET': route.path.includes(':') ? `Get ${resource}` : `List ${resource}s`,
      'POST': `Create ${resource}`,
      'PUT': `Update ${resource}`,
      'PATCH': `Partially update ${resource}`,
      'DELETE': `Delete ${resource}`
    };
    
    return actionMap[route.method] || `${route.method} ${resource}`;
  }

  generateDescription(route) {
    const pathParts = route.path.split('/').filter(part => part && !part.startsWith(':'));
    const resource = pathParts[pathParts.length - 1] || 'resource';
    
    const descriptionMap = {
      'GET': route.path.includes(':') ? 
        `Retrieve a specific ${resource} by ID` : 
        `Retrieve a list of ${resource}s`,
      'POST': `Create a new ${resource}`,
      'PUT': `Update an existing ${resource}`,
      'PATCH': `Partially update an existing ${resource}`,
      'DELETE': `Delete a ${resource}`
    };
    
    return descriptionMap[route.method] || `Perform ${route.method} operation on ${resource}`;
  }

  generateTags(route) {
    const pathParts = route.path.split('/').filter(part => part && !part.startsWith(':'));
    if (pathParts.length > 0) {
      const tag = pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1);
      return [tag];
    }
    return ['API'];
  }

  generateParameters(route) {
    const parameters = [];
    
    // Add path parameters
    if (route.parameters) {
      route.parameters.forEach(param => {
        parameters.push({
          name: param.name,
          in: 'path',
          required: true,
          schema: {
            type: 'string'
          },
          description: `${param.name} identifier`
        });
      });
    }
    
    // Add common query parameters for GET requests
    if (route.method === 'GET' && !route.path.includes(':')) {
      parameters.push(
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 10
          },
          description: 'Number of items to return'
        },
        {
          name: 'offset',
          in: 'query',
          required: false,
          schema: {
            type: 'integer',
            minimum: 0,
            default: 0
          },
          description: 'Number of items to skip'
        }
      );
    }
    
    return parameters;
  }

  generateRequestBody(route) {
    const pathParts = route.path.split('/').filter(part => part && !part.startsWith(':'));
    const resource = pathParts[pathParts.length - 1] || 'resource';
    
    return {
      description: `${resource} data`,
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              // Add some common properties
              id: {
                type: 'string',
                description: 'Unique identifier'
              },
              name: {
                type: 'string',
                description: 'Name'
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
                description: 'Creation timestamp'
              },
              updatedAt: {
                type: 'string',
                format: 'date-time',
                description: 'Last update timestamp'
              }
            }
          },
          example: {
            id: '123',
            name: `Sample ${resource}`,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z'
          }
        }
      }
    };
  }

  generateResponses(route) {
    const responses = {};
    
    // Success response
    if (route.method === 'POST') {
      responses['201'] = {
        description: 'Resource created successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      };
    } else if (route.method === 'DELETE') {
      responses['204'] = {
        description: 'Resource deleted successfully'
      };
    } else {
      responses['200'] = {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: {
              type: route.path.includes(':') ? 'object' : 'array',
              items: route.path.includes(':') ? undefined : { type: 'object' }
            }
          }
        }
      };
    }
    
    // Error responses
    if (route.path.includes(':')) {
      responses['404'] = {
        description: 'Resource not found'
      };
    }
    
    responses['400'] = {
      description: 'Bad request'
    };
    
    responses['500'] = {
      description: 'Internal server error'
    };
    
    return responses;
  }
}

module.exports = Generator;