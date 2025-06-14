const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const { promisify } = require('util');

const globAsync = promisify(glob);

/**
 * File scanner for discovering potential route files
 */
class FileScanner {
  /**
   * Find all files that could contain API routes
   * @param {string} targetPath - Directory to scan
   * @param {Object} options - Scan options
   * @returns {Promise<string[]>} Array of file paths
   */
  async findFiles(targetPath, options = {}) {
    const {
      extensions = ['.js', '.ts', '.mjs'],
      excludeDirs = ['node_modules', 'dist', 'build', '.git', 'coverage'],
      maxFiles = 1000,
      includePatterns = ['**/routes/**', '**/api/**', '**/controllers/**', '**/*route*', '**/*api*'],
      excludePatterns = ['**/*.test.*', '**/*.spec.*', '**/*.d.ts']
    } = options;

    try {
      // Validate target path
      const stat = await fs.stat(targetPath);
      if (!stat.isDirectory()) {
        throw new Error(`Target path is not a directory: ${targetPath}`);
      }

      // Build glob patterns
      const extensionPattern = extensions.length > 1 
        ? `{${extensions.join(',')}}` 
        : extensions[0];
      
      const patterns = [
        ...includePatterns.map(pattern => `${pattern}${extensionPattern}`),
        `**/*${extensionPattern}` // Fallback pattern
      ];

      // Build ignore patterns
      const ignorePatterns = [
        ...excludeDirs.map(dir => `**/${dir}/**`),
        ...excludePatterns
      ];

      const allFiles = new Set();

      // Search with each pattern
      for (const pattern of patterns) {
        try {
          const files = await globAsync(pattern, {
            cwd: targetPath,
            absolute: true,
            ignore: ignorePatterns,
            nodir: true
          });

          files.forEach(file => allFiles.add(file));

          // Prevent scanning too many files
          if (allFiles.size >= maxFiles) {
            break;
          }
        } catch (error) {
          // Continue with other patterns if one fails
          console.warn(`Warning: Pattern "${pattern}" failed:`, error.message);
        }
      }

      // Convert to array and sort
      const result = Array.from(allFiles)
        .slice(0, maxFiles)
        .sort();

      console.log(`📁 FileScanner found ${result.length} files in ${targetPath}`);
      return result;

    } catch (error) {
      console.error('❌ FileScanner error:', error.message);
      throw error;
    }
  }

  /**
   * Check if a file is readable and valid
   * @param {string} filePath 
   * @returns {Promise<boolean>}
   */
  async isValidFile(filePath) {
    try {
      const stat = await fs.stat(filePath);
      return stat.isFile() && stat.size > 0 && stat.size < 10 * 1024 * 1024; // Max 10MB
    } catch (error) {
      return false;
    }
  }

  /**
   * Read file content safely
   * @param {string} filePath 
   * @returns {Promise<string|null>}
   */
  async readFileContent(filePath) {
    try {
      if (!(await this.isValidFile(filePath))) {
        return null;
      }

      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      console.warn(`Warning: Could not read file ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Get file metadata
   * @param {string} filePath 
   * @returns {Promise<Object>}
   */
  async getFileInfo(filePath) {
    try {
      const stat = await fs.stat(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        extension: path.extname(filePath),
        size: stat.size,
        modified: stat.mtime,
        directory: path.dirname(filePath),
        relativePath: path.relative(process.cwd(), filePath)
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Find package.json to understand project structure
   * @param {string} targetPath 
   * @returns {Promise<Object|null>}
   */
  async findPackageJson(targetPath) {
    try {
      let currentPath = path.resolve(targetPath);
      
      while (currentPath !== path.dirname(currentPath)) {
        const packagePath = path.join(currentPath, 'package.json');
        try {
          const content = await fs.readFile(packagePath, 'utf8');
          return {
            path: packagePath,
            content: JSON.parse(content),
            directory: currentPath
          };
        } catch (error) {
          // Continue searching up the directory tree
        }
        currentPath = path.dirname(currentPath);
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = new FileScanner();