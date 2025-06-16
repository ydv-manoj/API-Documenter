const Groq = require('groq-sdk');

class AIAnalyzer {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Groq API key is required. Set GROQ_API_KEY environment variable.');
    }
    
    this.groq = new Groq({
      apiKey: apiKey
    });
  }

  async analyzeRoute(route) {
    try {
      const prompt = this.buildAnalysisPrompt(route);
      
      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are an expert API documentation generator. You MUST respond with ONLY a valid JSON object, no markdown, no explanations, no backticks.

Your response must be a single JSON object in this exact format:
{
  "summary": "Brief description",
  "description": "Detailed description", 
  "requestSchema": {
    "type": "object",
    "properties": {},
    "required": []
  },
  "responseSchema": {
    "type": "object", 
    "properties": {}
  },
  "parameters": [],
  "tags": ["TagName"],
  "examples": {
    "request": {},
    "response": {}
  },
  "statusCodes": {
    "200": "Success description"
  }
}

CRITICAL: Return ONLY the JSON object. No text before or after. No markdown formatting.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        temperature: 0.1, // Lower temperature for more consistent JSON
        max_tokens: 1500
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('No response from Groq API');
      }

      // Extract JSON from response (handle markdown or extra text)
      const jsonContent = this.extractJSON(content);
      const analysis = JSON.parse(jsonContent);
      
      return this.validateAndEnhanceAnalysis(analysis, route);
      
    } catch (error) {
      console.warn(`AI analysis failed for ${route.method} ${route.path}:`, error.message);
      return this.generateFallbackAnalysis(route);
    }
  }

  extractJSON(content) {
    // Remove markdown code blocks if present
    let jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Find JSON object boundaries
    const startIndex = jsonStr.indexOf('{');
    const lastIndex = jsonStr.lastIndexOf('}');
    
    if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
      jsonStr = jsonStr.substring(startIndex, lastIndex + 1);
    }
    
    // Clean up common issues
    jsonStr = jsonStr
      .replace(/^\s*["']json["']?\s*/, '') // Remove 'json' prefix
      .replace(/Here is the?.*?:/i, '') // Remove "Here is the analysis:"
      .replace(/Based on.*?:/i, '') // Remove "Based on analysis:"
      .trim();
    
    return jsonStr;
  }

  buildAnalysisPrompt(route) {
    return `Analyze this Express.js route:

Method: ${route.method}
Path: ${route.path}
Handler Code:
${route.handlerCode || 'No code available'}

Generate API documentation focusing on:
1. What this endpoint actually does
2. Expected request format
3. Response format
4. HTTP status codes used
5. Realistic examples

Return analysis as JSON only.`;
  }

  validateAndEnhanceAnalysis(analysis, route) {
    // Ensure all required fields exist with defaults
    const enhanced = {
      summary: analysis.summary || this.generateDefaultSummary(route),
      description: analysis.description || this.generateDefaultDescription(route),
      requestSchema: analysis.requestSchema || null,
      responseSchema: analysis.responseSchema || { type: 'object' },
      parameters: analysis.parameters || [],
      tags: analysis.tags || [this.inferTag(route.path)],
      examples: analysis.examples || { request: {}, response: {} },
      statusCodes: analysis.statusCodes || { '200': 'Success' }
    };

    // Ensure requestSchema is null for GET requests unless specifically needed
    if (route.method === 'GET' && enhanced.requestSchema) {
      enhanced.requestSchema = null;
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
          });
        }
      });
    }

    return enhanced;
  }

  generateDefaultSummary(route) {
    const pathParts = route.path.split('/').filter(part => part && !part.startsWith(':'));
    const resource = pathParts[pathParts.length - 1] || 'resource';
    
    const actionMap = {
      'GET': route.path.includes(':') ? `Get ${resource}` : `List ${resource}s`,
      'POST': `Create ${resource}`,
      'PUT': `Update ${resource}`,
      'PATCH': `Update ${resource}`,
      'DELETE': `Delete ${resource}`
    };
    
    return actionMap[route.method] || `${route.method} ${resource}`;
  }

  generateDefaultDescription(route) {
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

  generateFallbackAnalysis(route) {
    const pathParts = route.path.split('/').filter(part => part && !part.startsWith(':'));
    const resource = pathParts[pathParts.length - 1] || 'resource';
    
    return {
      summary: this.generateDefaultSummary(route),
      description: this.generateDefaultDescription(route),
      requestSchema: ['POST', 'PUT', 'PATCH'].includes(route.method) ? {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name field' },
          id: { type: 'string', description: 'Identifier' }
        },
        required: ['name']
      } : null,
      responseSchema: {
        type: route.method === 'GET' && !route.path.includes(':') ? 'array' : 'object',
        properties: route.method === 'GET' && !route.path.includes(':') ? undefined : {
          id: { type: 'string', description: 'Unique identifier' },
          name: { type: 'string', description: 'Name' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      parameters: route.parameters || [],
      tags: [this.inferTag(route.path)],
      examples: {
        request: ['POST', 'PUT', 'PATCH'].includes(route.method) ? { name: 'Example name' } : {},
        response: route.method === 'GET' && !route.path.includes(':') ? 
          [{ id: '1', name: 'Example item' }] : 
          { id: '1', name: 'Example item' }
      },
      statusCodes: {
        '200': route.method === 'DELETE' ? undefined : 'Success',
        '201': route.method === 'POST' ? 'Created successfully' : undefined,
        '204': route.method === 'DELETE' ? 'Deleted successfully' : undefined,
        '400': 'Bad request',
        '404': route.path.includes(':') ? 'Not found' : undefined,
        '500': 'Internal server error'
      }
    };
  }

  inferTag(path) {
    const pathParts = path.split('/').filter(part => part && !part.startsWith(':'));
    if (pathParts.length > 0) {
      return pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1);
    }
    return 'API';
  }

  async analyzeBatch(routes, batchSize = 3) { // Reduced batch size
    const results = [];
    
    console.log(`\n🤖 Analyzing ${routes.length} routes with AI...`);
    
    for (let i = 0; i < routes.length; i += batchSize) {
      const batch = routes.slice(i, i + batchSize);
      
      // Process routes one by one for better error handling
      for (const route of batch) {
        try {
          const analysis = await this.analyzeRoute(route);
          results.push({ route, analysis });
          process.stdout.write('✓');
        } catch (error) {
          console.warn(`\n⚠️  Failed to analyze ${route.method} ${route.path}`);
          const fallback = this.generateFallbackAnalysis(route);
          results.push({ route, analysis: fallback });
          process.stdout.write('⚠');
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Longer delay between batches
      if (i + batchSize < routes.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`\n✅ Analysis complete!`);
    return results;
  }
}

module.exports = AIAnalyzer;