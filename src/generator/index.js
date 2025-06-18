class Generator {
  constructor (options = {}) {
    this.options = {
      title: 'API Documentation',
      version: '1.0.0',
      description: 'AI-generated API documentation',
      baseUrl: 'http://localhost:3000',
      ...options
    }
  }

  generateSpec (analysisResults) {
    const paths = {}
    const components = {
      schemas: {},
      responses: {},
      parameters: {}
    }

    // Group analysis results by path
    const groupedResults = this.groupResultsByPath(analysisResults)

    // Generate paths with AI analysis
    Object.entries(groupedResults).forEach(([path, pathResults]) => {
      paths[path] = {}

      pathResults.forEach(({ route, analysis }) => {
        const operation = this.generateOperationFromAnalysis(route, analysis)
        paths[path][route.method.toLowerCase()] = operation
      })
    })

    // Extract reusable schemas from analysis
    this.extractReusableSchemas(analysisResults, components)

    const spec = {
      openapi: '3.0.0',
      info: {
        title: this.options.title,
        version: this.options.version,
        description: this.options.description + ' (AI-Enhanced)'
      },
      servers: [
        {
          url: this.options.baseUrl,
          description: 'Development server'
        }
      ],
      paths,
      components
    }

    return spec
  }

  groupResultsByPath (analysisResults) {
    const grouped = {}

    analysisResults.forEach(result => {
      const path = result.route.path
      if (!grouped[path]) {
        grouped[path] = []
      }
      grouped[path].push(result)
    })

    return grouped
  }

  generateOperationFromAnalysis (route, analysis) {
    const operation = {
      summary: analysis.summary,
      description: analysis.description,
      tags: analysis.tags,
      parameters: this.generateParametersFromAnalysis(analysis),
      responses: this.generateResponsesFromAnalysis(analysis)
    }

    // Add request body for POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(route.method) && analysis.requestSchema) {
      operation.requestBody = {
        description: 'Request payload',
        required: true,
        content: {
          'application/json': {
            schema: analysis.requestSchema,
            example: analysis.examples?.request || {}
          }
        }
      }
    }

    return operation
  }

  generateParametersFromAnalysis (analysis) {
    const parameters = []

    // Add analyzed parameters
    if (analysis.parameters) {
      analysis.parameters.forEach(param => {
        parameters.push({
          name: param.name,
          in: param.in || 'path',
          required: param.required !== false,
          schema: {
            type: param.type || 'string'
          },
          description: param.description
        })
      })
    }

    return parameters
  }

  generateResponsesFromAnalysis (analysis) {
    const responses = {}

    // Use AI-analyzed status codes
    if (analysis.statusCodes) {
      Object.entries(analysis.statusCodes).forEach(([code, description]) => {
        responses[code] = {
          description
        }

        // Add response schema for success responses
        if (code.startsWith('2') && analysis.responseSchema) {
          responses[code].content = {
            'application/json': {
              schema: analysis.responseSchema,
              example: analysis.examples?.response || {}
            }
          }
        }
      })
    } else {
      // Fallback responses
      responses['200'] = {
        description: 'Success',
        content: {
          'application/json': {
            schema: analysis.responseSchema || { type: 'object' }
          }
        }
      }
    }

    return responses
  }

  extractReusableSchemas (analysisResults, components) {
    const schemaMap = new Map()

    analysisResults.forEach(({ route, analysis }) => {
      // Extract common request schemas
      if (analysis.requestSchema) {
        const schemaKey = JSON.stringify(analysis.requestSchema)
        if (!schemaMap.has(schemaKey)) {
          const schemaName = this.generateSchemaName(route, 'Request')
          components.schemas[schemaName] = analysis.requestSchema
          schemaMap.set(schemaKey, schemaName)
        }
      }

      // Extract common response schemas
      if (analysis.responseSchema) {
        const schemaKey = JSON.stringify(analysis.responseSchema)
        if (!schemaMap.has(schemaKey)) {
          const schemaName = this.generateSchemaName(route, 'Response')
          components.schemas[schemaName] = analysis.responseSchema
          schemaMap.set(schemaKey, schemaName)
        }
      }
    })
  }

  generateSchemaName (route, suffix) {
    const pathParts = route.path.split('/').filter(part => part && !part.startsWith(':'))
    const resource = pathParts[pathParts.length - 1] || 'Resource'
    return resource.charAt(0).toUpperCase() + resource.slice(1) + suffix
  }
}

module.exports = Generator
