const Groq = require('groq-sdk')

class AIAnalyzer {
  constructor (apiKey) {
    if (!apiKey) {
      throw new Error('Groq API key is required. Set GROQ_API_KEY environment variable.')
    }

    this.groq = new Groq({
      apiKey
    })
  }

  async analyzeRoute (route) {
    const maxRetries = 3
    let lastError

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const prompt = this.buildAnalysisPrompt(route)

        const completion = await this.groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are an expert API documentation generator. You must respond with ONLY a valid JSON object. No markdown, no explanations, no text before or after.

Response format:
{
  "summary": "Brief description",
  "description": "Detailed description", 
  "requestSchema": null or {"type": "object", "properties": {}},
  "responseSchema": {"type": "object", "properties": {}},
  "parameters": [],
  "tags": ["TagName"],
  "examples": {"request": {}, "response": {}},
  "statusCodes": {"200": "Success description"}
}

CRITICAL RULES:
1. Return ONLY valid JSON
2. No markdown formatting
3. Use null for empty requestSchema (GET requests)
4. All strings must be properly quoted
5. No trailing commas
6. No comments in JSON`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.1,
          max_tokens: 1000
        })

        const content = completion.choices[0]?.message?.content?.trim()
        if (!content) {
          throw new Error('No response from Groq API')
        }

        // Extract and validate JSON
        const jsonContent = this.extractJSON(content)
        const analysis = this.parseJSON(jsonContent)

        return this.validateAndEnhanceAnalysis(analysis, route)
      } catch (error) {
        lastError = error
        if (attempt < maxRetries) {
          console.warn(`AI analysis attempt ${attempt} failed for ${route.method} ${route.path}, retrying...`)
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        }
      }
    }

    console.warn(`AI analysis failed for ${route.method} ${route.path} after ${maxRetries} attempts:`, lastError.message)
    return this.generateFallbackAnalysis(route)
  }

  parseJSON (jsonString) {
    try {
      return JSON.parse(jsonString)
    } catch (error) {
      // Try to fix common JSON issues
      const fixed = jsonString
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
        .replace(/:\s*'([^']*)'/g, ': "$1"') // Replace single quotes with double quotes
        .replace(/\\n/g, ' ') // Replace newlines
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()

      try {
        return JSON.parse(fixed)
      } catch (fixError) {
        throw new Error(`Invalid JSON: ${error.message}. Content: ${jsonString.substring(0, 200)}...`)
      }
    }
  }

  extractJSON (content) {
    // Remove markdown code blocks
    let jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '')

    // Find JSON object boundaries
    const startIndex = jsonStr.indexOf('{')
    const lastIndex = jsonStr.lastIndexOf('}')

    if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
      jsonStr = jsonStr.substring(startIndex, lastIndex + 1)
    }

    // Clean up common prefixes
    jsonStr = jsonStr
      .replace(/^.*?Here\s+is.*?:/i, '')
      .replace(/^.*?Based\s+on.*?:/i, '')
      .replace(/^.*?Analysis.*?:/i, '')
      .trim()

    return jsonStr
  }

  buildAnalysisPrompt (route) {
    return `Analyze this Express.js route and return documentation as JSON:

Method: ${route.method}
Path: ${route.path}
Code: ${route.handlerCode || 'No code available'}

Generate JSON with summary, description, schemas, parameters, tags, examples, and status codes.`
  }

  validateAndEnhanceAnalysis (analysis, route) {
    // Ensure all required fields exist with defaults
    const enhanced = {
      summary: analysis.summary || this.generateDefaultSummary(route),
      description: analysis.description || this.generateDefaultDescription(route),
      requestSchema: analysis.requestSchema || null,
      responseSchema: analysis.responseSchema || { type: 'object' },
      parameters: analysis.parameters || [],
      tags: analysis.tags || [this.inferTag(route.path)],
      examples: analysis.examples || { request: {}, response: {} },
      statusCodes: analysis.statusCodes || { 200: 'Success' }
    }

    // Ensure requestSchema is null for GET requests unless specifically needed
    if (route.method === 'GET' && enhanced.requestSchema) {
      enhanced.requestSchema = null
    }

    // Add path parameters if missing
    if (route.parameters?.length) {
      route.parameters.forEach(param => {
        if (!enhanced.parameters.find(p => p.name === param.name)) {
          enhanced.parameters.push({
            name: param.name,
            type: 'string',
            description: `${param.name} identifier`,
            required: true,
            in: 'path'
          })
        }
      })
    }

    return enhanced
  }

  generateDefaultSummary (route) {
    const pathParts = route.path.split('/').filter(part => part && !part.startsWith(':'))
    const resource = pathParts[pathParts.length - 1] || 'resource'

    const actionMap = {
      GET: route.path.includes(':') ? `Get ${resource}` : `List ${resource}s`,
      POST: `Create ${resource}`,
      PUT: `Update ${resource}`,
      PATCH: `Update ${resource}`,
      DELETE: `Delete ${resource}`
    }

    return actionMap[route.method] || `${route.method} ${resource}`
  }

  generateDefaultDescription (route) {
    const pathParts = route.path.split('/').filter(part => part && !part.startsWith(':'))
    const resource = pathParts[pathParts.length - 1] || 'resource'

    const descriptionMap = {
      GET: route.path.includes(':')
        ? `Retrieve a specific ${resource} by ID`
        : `Retrieve a list of ${resource}s`,
      POST: `Create a new ${resource}`,
      PUT: `Update an existing ${resource}`,
      PATCH: `Partially update an existing ${resource}`,
      DELETE: `Delete a ${resource}`
    }

    return descriptionMap[route.method] || `Perform ${route.method} operation on ${resource}`
  }

  generateFallbackAnalysis (route) {
    // const pathParts = route.path.split('/').filter(part => part && !part.startsWith(':'))
    // const resource = pathParts[pathParts.length - 1] || 'resource'

    return {
      summary: this.generateDefaultSummary(route),
      description: this.generateDefaultDescription(route),
      requestSchema: ['POST', 'PUT', 'PATCH'].includes(route.method)
        ? {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name field' },
              id: { type: 'string', description: 'Identifier' }
            },
            required: ['name']
          }
        : null,
      responseSchema: {
        type: route.method === 'GET' && !route.path.includes(':') ? 'array' : 'object',
        properties: route.method === 'GET' && !route.path.includes(':')
          ? undefined
          : {
              id: { type: 'string', description: 'Unique identifier' },
              name: { type: 'string', description: 'Name' },
              createdAt: { type: 'string', format: 'date-time' }
            }
      },
      parameters: route.parameters || [],
      tags: [this.inferTag(route.path)],
      examples: {
        request: ['POST', 'PUT', 'PATCH'].includes(route.method) ? { name: 'Example name' } : {},
        response: route.method === 'GET' && !route.path.includes(':')
          ? [{ id: '1', name: 'Example item' }]
          : { id: '1', name: 'Example item' }
      },
      statusCodes: {
        200: route.method === 'DELETE' ? undefined : 'Success',
        201: route.method === 'POST' ? 'Created successfully' : undefined,
        204: route.method === 'DELETE' ? 'Deleted successfully' : undefined,
        400: 'Bad request',
        404: route.path.includes(':') ? 'Not found' : undefined,
        500: 'Internal server error'
      }
    }
  }

  inferTag (path) {
    const pathParts = path.split('/').filter(part => part && !part.startsWith(':'))
    if (pathParts.length > 0) {
      return pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1)
    }
    return 'API'
  }

  async analyzeBatch (routes, batchSize = 3) { // Reduced batch size
    const results = []

    // console.log(`\n🤖 Analyzing ${routes.length} routes with AI...`)

    for (let i = 0; i < routes.length; i += batchSize) {
      const batch = routes.slice(i, i + batchSize)

      // Process routes one by one for better error handling
      for (const route of batch) {
        try {
          const analysis = await this.analyzeRoute(route)
          results.push({ route, analysis })
          process.stdout.write('✓')
        } catch (error) {
          console.warn(`\n⚠️  Failed to analyze ${route.method} ${route.path}`)
          const fallback = this.generateFallbackAnalysis(route)
          results.push({ route, analysis: fallback })
          process.stdout.write('⚠')
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Longer delay between batches
      if (i + batchSize < routes.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // console.log('\n✅ Analysis complete!')
    return results
  }
}

module.exports = AIAnalyzer
