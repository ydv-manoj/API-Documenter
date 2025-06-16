const fs = require('fs-extra');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

class Parser {
  constructor() {
    this.routes = [];
  }

  async parseFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ast = parser.parse(content, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport'
        ]
      });

      const routes = [];
      
      traverse(ast, {
        CallExpression: (path) => {
          const route = this.extractRoute(path, content);
          if (route) {
            route.file = filePath;
            routes.push(route);
          }
        }
      });

      return routes;
    } catch (error) {
      console.warn(`Warning: Could not parse ${filePath}:`, error.message);
      return [];
    }
  }

  extractRoute(path, sourceCode) {
    const { node } = path;
    
    // Handle app.get(), router.post(), etc.
    if (t.isMemberExpression(node.callee)) {
      const object = node.callee.object;
      const property = node.callee.property;
      
      if (t.isIdentifier(property)) {
        const method = property.name.toLowerCase();
        const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
        
        if (httpMethods.includes(method)) {
          const routePath = this.extractRoutePath(node.arguments[0]);
          if (routePath) {
            const handlerInfo = this.extractHandlerWithCode(node.arguments, sourceCode);
            
            return {
              method: method.toUpperCase(),
              path: routePath,
              handler: handlerInfo.handler,
              handlerCode: handlerInfo.code,
              middleware: this.extractMiddleware(node.arguments),
              parameters: this.extractParameters(routePath),
              description: this.extractDescription(path)
            };
          }
        }
      }
    }
    
    return null;
  }

  extractRoutePath(node) {
    if (t.isStringLiteral(node)) {
      return node.value;
    }
    if (t.isTemplateLiteral(node)) {
      let path = '';
      for (let i = 0; i < node.quasis.length; i++) {
        path += node.quasis[i].value.raw;
        if (i < node.expressions.length) {
          path += ':param' + i;
        }
      }
      return path;
    }
    return null;
  }

  extractHandlerWithCode(args, sourceCode) {
    // Get the last argument (handler function)
    const handlerNode = args[args.length - 1];
    
    if (!handlerNode) {
      return { handler: null, code: null };
    }

    const handler = this.extractHandler(handlerNode);
    
    // Extract the actual code
    let code = null;
    if (handlerNode.start !== undefined && handlerNode.end !== undefined) {
      code = sourceCode.slice(handlerNode.start, handlerNode.end);
      
      // Clean up the code formatting
      code = this.formatCode(code);
    }
    
    return { handler, code };
  }

  extractHandler(node) {
    if (!node) return null;
    
    if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) {
      return {
        type: 'inline',
        params: node.params.map(param => {
          if (t.isIdentifier(param)) return param.name;
          if (t.isObjectPattern(param)) return 'destructured';
          return 'unknown';
        }),
        async: node.async
      };
    }
    
    if (t.isIdentifier(node)) {
      return {
        type: 'reference',
        name: node.name
      };
    }
    
    return null;
  }

  extractMiddleware(args) {
    const middleware = [];
    // Skip first argument (route path) and last argument (handler)
    for (let i = 1; i < args.length - 1; i++) {
      const arg = args[i];
      if (t.isIdentifier(arg)) {
        middleware.push(arg.name);
      } else if (t.isCallExpression(arg)) {
        // Handle middleware like authenticate(), validate(), etc.
        if (t.isIdentifier(arg.callee)) {
          middleware.push(arg.callee.name + '()');
        }
      }
    }
    return middleware;
  }

  extractParameters(routePath) {
    const parameters = [];
    const pathParams = routePath.match(/:(\w+)/g);
    
    if (pathParams) {
      pathParams.forEach(param => {
        parameters.push({
          name: param.substring(1),
          in: 'path',
          required: true,
          type: 'string'
        });
      });
    }
    
    return parameters;
  }

  extractDescription(path) {
    const comments = path.node.leadingComments;
    if (comments && comments.length > 0) {
      const lastComment = comments[comments.length - 1];
      if (lastComment.type === 'CommentBlock') {
        const content = lastComment.value;
        const descMatch = content.match(/@description\s+(.+)/);
        if (descMatch) return descMatch[1].trim();
        
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim().replace(/^\*\s?/, '');
          if (trimmed && !trimmed.startsWith('@')) {
            return trimmed;
          }
        }
      }
    }
    
    return null;
  }

  formatCode(code) {
    return code
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }
}

module.exports = Parser;