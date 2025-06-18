const fs = require('fs-extra')
const path = require('path')

class Scanner {
  constructor (options = {}) {
    this.options = {
      include: ['.js', '.ts'],
      exclude: ['node_modules', '.test.', '.spec.', '__tests__', 'coverage', 'dist', 'build', '.git'],
      frameworks: ['express'],
      ...options
    }
  }

  async findRouteFiles (directory) {
    const routeFiles = []
    await this.searchDirectory(directory, routeFiles)
    return routeFiles
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
          if (this.shouldProcessFile(entry.name)) {
            if (await this.containsRoutes(fullPath)) {
              routeFiles.push(fullPath)
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dir}:`, error.message)
    }
  }

  shouldProcessFile (filename) {
    // Must have valid extension
    if (!this.isValidFile(filename)) {
      return false
    }

    // Must not be excluded
    if (this.isExcludedFile(filename)) {
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
      /\.test\./,
      /\.spec\./,
      /test\.js$/,
      /spec\.js$/,
      /\.test\.js$/,
      /\.spec\.js$/,
      /\.test\.ts$/,
      /\.spec\.ts$/
    ]

    if (testPatterns.some(pattern => pattern.test(filename))) {
      return true
    }

    // Check for other excluded patterns
    const excludePatterns = ['coverage', 'dist', 'build', '.min.js']
    return excludePatterns.some(pattern => filename.includes(pattern))
  }

  isExcludedDirectory (dirname) {
    const excludeDirs = ['node_modules', '__tests__', 'coverage', 'dist', 'build', '.git', '.vscode', '.idea']
    return excludeDirs.some(pattern => dirname.includes(pattern))
  }

  async containsRoutes (filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')

      // Skip if it looks like a test file based on content
      if (this.looksLikeTestFile(content)) {
        return false
      }

      // Check for common route patterns
      const routePatterns = [
        /app\.(get|post|put|delete|patch|head|options)\s*\(/i,
        /router\.(get|post|put|delete|patch|head|options)\s*\(/i,
        /express\(\)\.router\(\)/i,
        /@(Get|Post|Put|Delete|Patch|Head|Options)\s*\(/i, // NestJS decorators
        /fastify\.(get|post|put|delete|patch|head|options)/i // Fastify
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
      /afterAll\s*\(/
    ]

    return testPatterns.some(pattern => pattern.test(content))
  }
}

module.exports = Scanner
