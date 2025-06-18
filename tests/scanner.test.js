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

    test('should exclude test files', async () => {
      const testContent = `
        describe('test', () => {
          test('should work', () => {});
        });
      `;

      const testFile = path.join(tempDir, 'users.test.js');
      await fs.writeFile(testFile, testContent);

      const files = await scanner.findRouteFiles(tempDir);
      expect(files).not.toContain(testFile);
    });

    test('should exclude node_modules', async () => {
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      await fs.ensureDir(nodeModulesDir);

      const moduleFile = path.join(nodeModulesDir, 'package.js');
      await fs.writeFile(moduleFile, 'module.exports = {};');

      const files = await scanner.findRouteFiles(tempDir);
      expect(files).not.toContain(moduleFile);
    });
  });

  describe('containsRoutes', () => {
    test('should detect Express routes', async () => {
      const routeContent = `
        app.get('/users', (req, res) => {
          res.json([]);
        });
      `;

      const routeFile = path.join(tempDir, 'routes.js');
      await fs.writeFile(routeFile, routeContent);

      const hasRoutes = await scanner.containsRoutes(routeFile);
      expect(hasRoutes).toBe(true);
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
});