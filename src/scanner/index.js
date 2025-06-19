const fs = require('fs-extra')
const path = require('path')

class Scanner {
  constructor (options = {}) {
    this.options = {
      include: ['.js', '.ts'],
      exclude: [
        // Directories to skip
        'node_modules', '__tests__', 'coverage', 'dist', 'build',
        '.git', '.vscode', '.idea', 'logs', 'tmp', 'temp',

        // File patterns to skip
        '.test.', '.spec.', '.min.', '.bundle.',
        'package.json', 'package-lock.json', 'yarn.lock',
        '.env', '.gitignore', 'README', 'LICENSE',
        'webpack.', 'babel.', 'jest.', 'tsconfig.',
        '.eslintrc', '.prettierrc'
      ],
      frameworks: ['express'],
      ...options
    }
  }

  async findRouteFiles (directory) {
    const routeFiles = []
    await this.searchDirectory(directory, routeFiles)

    // Sort files for consistent output
    return routeFiles.sort()
  }

  async searchDirectory (dir, routeFiles) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          // Skip excluded directories
          if (!this.isExcludedDirectory(entry.name)) {
            await this.searchDirectory(fullPath, routeFiles)
          }
        } else if (entry.isFile()) {
          // Check if file should be processed
          if (this.shouldProcessFile(entry.name, fullPath)) {
            if (await this.containsRoutes(fullPath)) {
              routeFiles.push(fullPath)
            }
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read (permissions, etc.)
      console.warn(`Warning: Could not read directory ${dir}:`, error.message)
    }
  }

  shouldProcessFile (filename, fullPath) {
    // Must have valid extension
    if (!this.isValidFile(filename)) {
      return false
    }

    // Must not be excluded by patterns
    if (this.isExcludedFile(filename)) {
      return false
    }

    // Skip very large files (over 1MB) - likely not route files
    try {
      const stats = require('fs').statSync(fullPath)
      if (stats.size > 1024 * 1024) {
        return false
      }
    } catch (error) {
      return false
    }

    return true
  }

  isValidFile (filename) {
    return this.options.include.some(ext => filename.endsWith(ext))
  }

  isExcludedFile (filename) {
    // Check for test file patterns
    const testPatterns = [
      /\.test\./i,
      /\.spec\./i,
      /test\.js$/i,
      /spec\.js$/i,
      /\.test\.js$/i,
      /\.spec\.js$/i,
      /\.test\.ts$/i,
      /\.spec\.ts$/i,
      /\.min\.js$/i,
      /\.bundle\.js$/i
    ]

    if (testPatterns.some(pattern => pattern.test(filename))) {
      return true
    }

    // Check for config and build files
    const configPatterns = [
      'package.json', 'package-lock.json', 'yarn.lock', 'npm-shrinkwrap.json',
      'webpack.config.js', 'webpack.prod.js', 'webpack.dev.js',
      'babel.config.js', '.babelrc.js',
      'jest.config.js', 'jest.setup.js',
      'tsconfig.json', 'tsconfig.build.json',
      '.eslintrc.js', '.eslintrc.json',
      '.prettierrc.js', '.prettierrc.json',
      'rollup.config.js', 'vite.config.js',
      'tailwind.config.js', 'postcss.config.js'
    ]

    if (configPatterns.includes(filename.toLowerCase())) {
      return true
    }

    // Check for other excluded patterns
    return this.options.exclude.some(pattern => filename.toLowerCase().includes(pattern.toLowerCase()))
  }

  isExcludedDirectory (dirname) {
    const excludeDirs = [
      'node_modules', '__tests__', 'coverage', 'dist', 'build',
      '.git', '.vscode', '.idea', '.nyc_output',
      'logs', 'tmp', 'temp', 'cache',
      '.next', '.nuxt', '.output',
      'public', 'static', 'assets'
    ]

    return excludeDirs.some(pattern =>
      dirname.toLowerCase() === pattern.toLowerCase() ||
      dirname.toLowerCase().includes(pattern.toLowerCase())
    )
  }

  async containsRoutes (filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')

      // Skip if it looks like a test file based on content
      if (this.looksLikeTestFile(content)) {
        return false
      }

      // Skip if it looks like a config file
      if (this.looksLikeConfigFile(content)) {
        return false
      }

      // Check for common route patterns
      const routePatterns = [
        /app\.(get|post|put|delete|patch|head|options)\s*\(/i,
        /router\.(get|post|put|delete|patch|head|options)\s*\(/i,
        /express\(\)\.router\(\)/i,
        /@(Get|Post|Put|Delete|Patch|Head|Options)\s*\(/i, // NestJS decorators
        /fastify\.(get|post|put|delete|patch|head|options)/i, // Fastify
        /\.route\s*\(\s*['"][^'"]*['"]\s*\)/i // General route definitions
      ]

      return routePatterns.some(pattern => pattern.test(content))
    } catch (error) {
      return false
    }
  }

  looksLikeTestFile (content) {
    const testPatterns = [
      /describe\s*\(/,
      /it\s*\(/,
      /test\s*\(/,
      /expect\s*\(/,
      /jest\./,
      /beforeEach\s*\(/,
      /afterEach\s*\(/,
      /beforeAll\s*\(/,
      /afterAll\s*\(/,
      /chai\./,
      /should\./,
      /assert\./
    ]

    const testKeywordCount = testPatterns.filter(pattern => pattern.test(content)).length
    return testKeywordCount >= 2 // Multiple test indicators
  }

  looksLikeConfigFile (content) {
    const configPatterns = [
      /module\.exports\s*=\s*\{[^}]*port\s*:/,
      /export\s+default\s+\{[^}]*port\s*:/,
      /"scripts"\s*:\s*\{/,
      /"dependencies"\s*:\s*\{/,
      /"devDependencies"\s*:\s*\{/,
      /webpack|babel|jest|eslint|prettier/i
    ]

    return configPatterns.some(pattern => pattern.test(content))
  }
}

module.exports = Scanner
