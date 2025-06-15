const fileScanner = require('./fileScanner');
const routeDetector = require('./routeDetector');

class Scanner {
  constructor(options = {}) {
    this.options = {
      extensions: ['.js', '.ts', '.mjs'],
      excludeDirs: ['node_modules', 'dist', 'build', '.git', 'coverage'],
      frameworks: ['express', 'fastify', 'koa'],
      ...options
    };
  }

  /**
   * Scan directory for API route files
   * @param {string} targetPath - Path to scan
   * @returns {Promise<Object>} Scan results with framework detection and file list
   */
  async scan(targetPath = process.cwd()) {
    console.log(`🔍 Scanning ${targetPath} for API routes...`);
    
    try {
      // Find all potential route files
      const files = await fileScanner.findFiles(targetPath, this.options);
      console.log(`📁 Found ${files.length} potential route files`);

      // Detect framework and filter relevant files
      const routeFiles = [];
      let detectedFramework = null;

      for (const file of files) {
        const detection = await routeDetector.analyzeFile(file, this.options.frameworks);
        if (detection.hasRoutes) {
          routeFiles.push({
            path: file,
            framework: detection.framework,
            confidence: detection.confidence,
            routeCount: detection.routeCount
          });
          
          if (!detectedFramework || detection.confidence > 0.8) {
            detectedFramework = detection.framework;
          }
        }
      }

      const result = {
        targetPath,
        framework: detectedFramework,
        totalFiles: files.length,
        routeFiles: routeFiles.length,
        files: routeFiles,
        scanTime: new Date().toISOString()
      };

      console.log(`✅ Scan complete: ${routeFiles.length} route files found`);
      if (detectedFramework) {
        console.log(`🚀 Detected framework: ${detectedFramework}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Scanner error:', error.message);
      throw error;
    }
  }

  /**
   * Quick scan to check if directory contains API routes
   * @param {string} targetPath 
   * @returns {Promise<boolean>}
   */
  async hasRoutes(targetPath = process.cwd()) {
    try {
      const files = await fileScanner.findFiles(targetPath, { 
        ...this.options, 
        maxFiles: 20 // Quick scan limit
      });
      
      for (const file of files) {
        const detection = await routeDetector.quickCheck(file);
        if (detection.hasRoutes) {
          return true;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}

module.exports = Scanner;