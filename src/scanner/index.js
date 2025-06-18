const fs = require('fs-extra')
const path = require('path')
const { glob } = require('glob') // Updated import for newer glob versions

class Scanner {
  constructor (options = {}) {
    this.options = {
      include: ['**/*.js', '**/*.ts'],
      exclude: ['**/node_modules/**', '**/test/**', '**/*.test.js', '**/*.spec.js'],
      frameworks: ['express'],
      ...options
    }
  }

  async findRouteFiles (directory) {
    const files = []

    try {
      for (const pattern of this.options.include) {
        const matches = await glob(path.join(directory, pattern))
        files.push(...matches)
      }
    } catch (error) {
      console.warn('Glob error:', error.message)
      // Fallback to manual file search
      return this.manualFileSearch(directory)
    }

    // Filter out excluded files
    const filteredFiles = files.filter(file => {
      return !this.options.exclude.some(pattern => {
        return file.match(new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')))
      })
    })

    // Filter files that likely contain routes
    const routeFiles = []
    for (const file of filteredFiles) {
      if (await this.containsRoutes(file)) {
        routeFiles.push(file)
      }
    }

    return routeFiles
  }

  async manualFileSearch (directory) {
    const files = []

    async function searchDir (dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          await searchDir(fullPath)
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
          files.push(fullPath)
        }
      }
    }

    await searchDir(directory)
    return files
  }

  async containsRoutes (filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')

      // Check for common route patterns
      const routePatterns = [
        /app\.(get|post|put|delete|patch)\s*\(/,
        /router\.(get|post|put|delete|patch)\s*\(/,
        /express\(\)\.router\(\)/,
        /@(Get|Post|Put|Delete|Patch)\s*\(/, // NestJS decorators
        /fastify\.(get|post|put|delete|patch)/ // Fastify
      ]

      return routePatterns.some(pattern => pattern.test(content))
    } catch (error) {
      return false
    }
  }
}

module.exports = Scanner
