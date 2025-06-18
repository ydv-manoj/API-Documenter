const Scanner = require('../src/scanner');
const fs = require('fs-extra');
const path = require('path');

describe('Scanner', () => {
  let scanner;
  let tempDir;

  beforeEach(async () => {
    scanner = new Scanner();
    tempDir = path.join(__dirname, 'temp');
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('findRouteFiles', () => {
    test('should find JavaScript files with routes', async () => {
      const routeContent = `
        const express = require('express');
        const router = express.Router();
        router.get('/users', (req, res) => {
          res.json([]);
        });
        module.exports = router;
      `;

      const routeFile = path.join(tempDir, 'users.js');
      await fs.writeFile(routeFile, routeContent);

      const files = await scanner.findRouteFiles(tempDir);
      expect(files).toContain(routeFile);
    });

    test('should exclude test files by filename', async () => {
      const testContent = `
        const express = require('express');
        router.get('/test', (req, res) => res.json({}));
      `;

      const testFile = path.join(tempDir, 'users.test.js');
      await fs.writeFile(testFile, testContent);

      const files = await scanner.findRouteFiles(tempDir);
      expect(files).not.toContain(testFile);
    });

    test('should exclude spec files', async () => {
      const specContent = `
        const express = require('express');
        router.get('/spec', (req, res) => res.json({}));
      `;

      const specFile = path.join(tempDir, 'users.spec.js');
      await fs.writeFile(specFile, specContent);

      const files = await scanner.findRouteFiles(tempDir);
      expect(files).not.toContain(specFile);
    });

    test('should exclude test files by content', async () => {
      const testContent = `
        describe('User routes', () => {
          test('should return users', () => {
            // This has route-like code but is clearly a test
            expect(app.get('/users')).toBeDefined();
          });
        });
      `;

      const testFile = path.join(tempDir, 'userRoutes.js'); // Not obviously a test file by name
      await fs.writeFile(testFile, testContent);

      const files = await scanner.findRouteFiles(tempDir);
      expect(files).not.toContain(testFile);
    });

    test('should exclude node_modules', async () => {
      const nodeModulesDir = path.join(tempDir, 'node_modules', 'some-package');
      await fs.ensureDir(nodeModulesDir);

      const moduleFile = path.join(nodeModulesDir, 'index.js');
      await fs.writeFile(moduleFile, 'app.get("/test", () => {});');

      const files = await scanner.findRouteFiles(tempDir);
      expect(files).not.toContain(moduleFile);
    });

    test('should exclude __tests__ directory', async () => {
      const testsDir = path.join(tempDir, '__tests__');
      await fs.ensureDir(testsDir);

      const testFile = path.join(testsDir, 'routes.js');
      await fs.writeFile(testFile, 'app.get("/test", () => {});');

      const files = await scanner.findRouteFiles(tempDir);
      expect(files).not.toContain(testFile);
    });
  });

  describe('containsRoutes', () => {
    test('should detect Express routes', async () => {
      const routeContent = `
        const express = require('express');
        const app = express();
        app.get('/users', (req, res) => {
          res.json([]);
        });
      `;

      const routeFile = path.join(tempDir, 'routes.js');
      await fs.writeFile(routeFile, routeContent);

      const hasRoutes = await scanner.containsRoutes(routeFile);
      expect(hasRoutes).toBe(true);
    });

    test('should detect router routes', async () => {
      const routeContent = `
        const router = require('express').Router();
        router.post('/users', (req, res) => {
          res.status(201).json({});
        });
      `;

      const routeFile = path.join(tempDir, 'routes.js');
      await fs.writeFile(routeFile, routeContent);

      const hasRoutes = await scanner.containsRoutes(routeFile);
      expect(hasRoutes).toBe(true);
    });

    test('should not detect routes in test files', async () => {
      const testContent = `
        describe('API tests', () => {
          test('should call app.get', () => {
            app.get('/test', handler);
            expect(handler).toHaveBeenCalled();
          });
        });
      `;

      const testFile = path.join(tempDir, 'api.test.js');
      await fs.writeFile(testFile, testContent);

      const hasRoutes = await scanner.containsRoutes(testFile);
      expect(hasRoutes).toBe(false);
    });

    test('should not detect routes in regular files', async () => {
      const regularContent = `
        const config = {
          port: 3000,
          database: 'mongodb://localhost'
        };
        module.exports = config;
      `;

      const configFile = path.join(tempDir, 'config.js');
      await fs.writeFile(configFile, regularContent);

      const hasRoutes = await scanner.containsRoutes(configFile);
      expect(hasRoutes).toBe(false);
    });
  });

  describe('file filtering methods', () => {
    test('isValidFile should accept .js and .ts files', () => {
      expect(scanner.isValidFile('routes.js')).toBe(true);
      expect(scanner.isValidFile('routes.ts')).toBe(true);
      expect(scanner.isValidFile('routes.json')).toBe(false);
      expect(scanner.isValidFile('README.md')).toBe(false);
    });

    test('isExcludedFile should exclude test patterns', () => {
      expect(scanner.isExcludedFile('users.test.js')).toBe(true);
      expect(scanner.isExcludedFile('users.spec.js')).toBe(true);
      expect(scanner.isExcludedFile('test.js')).toBe(true);
      expect(scanner.isExcludedFile('spec.js')).toBe(true);
      expect(scanner.isExcludedFile('users.js')).toBe(false);
      expect(scanner.isExcludedFile('routes.js')).toBe(false);
    });

    test('isExcludedDirectory should exclude common directories', () => {
      expect(scanner.isExcludedDirectory('node_modules')).toBe(true);
      expect(scanner.isExcludedDirectory('__tests__')).toBe(true);
      expect(scanner.isExcludedDirectory('coverage')).toBe(true);
      expect(scanner.isExcludedDirectory('dist')).toBe(true);
      expect(scanner.isExcludedDirectory('src')).toBe(false);
      expect(scanner.isExcludedDirectory('routes')).toBe(false);
    });
  });
});