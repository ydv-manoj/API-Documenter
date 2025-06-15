const fileScanner = require('./fileScanner');

/**
 * Route detector for identifying framework usage and route definitions
 */
class RouteDetector {
  constructor() {
    // Framework detection patterns
    this.frameworkPatterns = {
      express: {
        imports: [
          /require\s*\(\s*['"`]express['"`]\s*\)/,
          /import.*from\s+['"`]express['"`]/,
          /import\s+express\s+from/
        ],
        routes: [
          /\.get\s*\(/,
          /\.post\s*\(/,
          /\.put\s*\(/,
          /\.patch\s*\(/,
          /\.delete\s*\(/,
          /\.all\s*\(/,
          /\.use\s*\(/,
          /app\.(get|post|put|patch|delete|all|use)\s*\(/,
          /router\.(get|post|put|patch|delete|all|use)\s*\(/
        ],
        confidence: {
          import: 0.8,
          route: 0.6,
          appPattern: 0.7
        }
      },
      fastify: {
        imports: [
          /require\s*\(\s*['"`]fastify['"`]\s*\)/,
          /import.*from\s+['"`]fastify['"`]/
        ],
        routes: [
          /\.get\s*\(/,
          /\.post\s*\(/,
          /\.put\s*\(/,
          /\.patch\s*\(/,
          /\.delete\s*\(/,
          /fastify\.(get|post|put|patch|delete)\s*\(/,
          /\.register\s*\(/
        ],
        confidence: {
          import: 0.9,
          route: 0.7,
          register: 0.8
        }
      },
      koa: {
        imports: [
          /require\s*\(\s*['"`]koa['"`]\s*\)/,
          /require\s*\(\s*['"`]@?koa\/router['"`]\s*\)/,
          /import.*from\s+['"`]koa['"`]/,
          /import.*from\s+['"`]@?koa\/router['"`]/
        ],
        routes: [
          /\.get\s*\(/,
          /\.post\s*\(/,
          /\.put\s*\(/,
          /\.patch\s*\(/,
          /\.delete\s*\(/,
          /router\.(get|post|put|patch|delete)\s*\(/
        ],
        confidence: {
          import: 0.9,
          route: 0.6
        }
      }
    };

    // Generic route patterns that suggest API endpoints
    this.genericRoutePatterns = [
      /['"`]\/api\//,
      /['"`]\/v\d+\//,
      /['"`]\/users?\//,
      /['"`]\/auth\//,
      /['"`]\/login/,
      /['"`]\/register/,
      /['"`]\/logout/,
      /res\.json\s*\(/,
      /res\.send\s*\(/,
      /response\.json\s*\(/,
      /reply\.send\s*\(/,
      /ctx\.body\s*=/
    ];
  }

  /**
   * Analyze a file to detect framework usage and routes
   * @param {string} filePath 
   * @param {string[]} frameworks - Frameworks to check for
   * @returns {Promise<Object>}
   */
  async analyzeFile(filePath, frameworks = ['express', 'fastify', 'koa']) {
    try {
      const content = await fileScanner.readFileContent(filePath);
      if (!content) {
        return {
          hasRoutes: false,
          framework: null,
          confidence: 0,
          routeCount: 0
        };
      }

      return this.analyzeContent(content, frameworks, filePath);
    } catch (error) {
      console.warn(`Warning: Could not analyze file ${filePath}:`, error.message);
      return {
        hasRoutes: false,
        framework: null,
        confidence: 0,
        routeCount: 0,
        error: error.message
      };
    }
  }

  /**
   * Analyze file content for framework and route detection
   * @param {string} content 
   * @param {string[]} frameworks 
   * @param {string} filePath 
   * @returns {Object}
   */
  analyzeContent(content, frameworks, filePath = '') {
    const results = {
      hasRoutes: false,
      framework: null,
      confidence: 0,
      routeCount: 0,
      detectedPatterns: []
    };

    // Check each framework
    for (const framework of frameworks) {
      const patterns = this.frameworkPatterns[framework];
      if (!patterns) continue;

      let frameworkConfidence = 0;
      let routeCount = 0;
      const detectedPatterns = [];

      // Check for imports
      for (const importPattern of patterns.imports) {
        if (importPattern.test(content)) {
          frameworkConfidence += patterns.confidence.import || 0.8;
          detectedPatterns.push(`${framework}_import`);
          break;
        }
      }

      // Check for route patterns
      for (const routePattern of patterns.routes) {
        const matches = content.match(new RegExp(routePattern.source, 'g'));
        if (matches) {
          routeCount += matches.length;
          frameworkConfidence += (patterns.confidence.route || 0.6) * Math.min(matches.length, 3);
          detectedPatterns.push(`${framework}_routes`);
        }
      }

      // Check for generic API patterns
      let apiPatternCount = 0;
      for (const pattern of this.genericRoutePatterns) {
        if (pattern.test(content)) {
          apiPatternCount++;
        }
      }

      if (apiPatternCount > 0) {
        frameworkConfidence += Math.min(apiPatternCount * 0.1, 0.3);
        detectedPatterns.push('api_patterns');
      }

      // Update results if this framework has higher confidence
      if (frameworkConfidence > results.confidence) {
        results.framework = framework;
        results.confidence = Math.min(frameworkConfidence, 1.0);
        results.routeCount = routeCount;
        results.detectedPatterns = detectedPatterns;
        results.hasRoutes = routeCount > 0 || frameworkConfidence > 0.5;
      }
    }

    // Fallback: check for any route-like patterns
    if (!results.hasRoutes) {
      let genericRouteCount = 0;
      for (const pattern of this.genericRoutePatterns) {
        const matches = content.match(new RegExp(pattern.source, 'g'));
        if (matches) {
          genericRouteCount += matches.length;
        }
      }

      if (genericRouteCount > 2) {
        results.hasRoutes = true;
        results.framework = 'unknown';
        results.confidence = Math.min(genericRouteCount * 0.1, 0.5);
        results.routeCount = genericRouteCount;
        results.detectedPatterns = ['generic_routes'];
      }
    }

    return results;
  }

  /**
   * Quick check if file likely contains routes (for performance)
   * @param {string} filePath 
   * @returns {Promise<Object>}
   */
  async quickCheck(filePath) {
    try {
      const content = await fileScanner.readFileContent(filePath);
      if (!content) {
        return { hasRoutes: false };
      }

      // Quick patterns for common route indicators
      const quickPatterns = [
        /\.get\s*\(/,
        /\.post\s*\(/,
        /\.put\s*\(/,
        /\.delete\s*\(/,
        /['"`]\/api\//,
        /res\.json\s*\(/,
        /express/,
        /fastify/,
        /router/i
      ];

      for (const pattern of quickPatterns) {
        if (pattern.test(content)) {
          return { hasRoutes: true };
        }
      }

      return { hasRoutes: false };
    } catch (error) {
      return { hasRoutes: false };
    }
  }

  /**
   * Extract route information from content
   * @param {string} content 
   * @param {string} framework 
   * @returns {Array}
   */
  extractRoutes(content, framework) {
    const routes = [];

    try {
      // Framework-specific route extraction
      if (framework === 'express') {
        routes.push(...this.extractExpressRoutes(content));
      } else if (framework === 'fastify') {
        routes.push(...this.extractFastifyRoutes(content));
      } else if (framework === 'koa') {
        routes.push(...this.extractKoaRoutes(content));
      }

      return routes;
    } catch (error) {
      console.warn('Warning: Route extraction failed:', error.message);
      return routes;
    }
  }

  /**
   * Extract Express.js routes from content
   * @param {string} content 
   * @returns {Array}
   */
  extractExpressRoutes(content) {
    const routes = [];
    const routePattern = /(app|router)\.(get|post|put|patch|delete|all|use)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      routes.push({
        method: match[2].toUpperCase(),
        path: match[3],
        framework: 'express'
      });
    }

    return routes;
  }

  /**
   * Extract Fastify routes from content
   * @param {string} content 
   * @returns {Array}
   */
  extractFastifyRoutes(content) {
    const routes = [];
    const routePattern = /fastify\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        framework: 'fastify'
      });
    }

    return routes;
  }

  /**
   * Extract Koa routes from content
   * @param {string} content 
   * @returns {Array}
   */
  extractKoaRoutes(content) {
    const routes = [];
    const routePattern = /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        framework: 'koa'
      });
    }

    return routes;
  }
}

module.exports = new RouteDetector();