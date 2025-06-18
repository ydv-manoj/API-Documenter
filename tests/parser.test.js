const Parser = require('../src/parser');
const fs = require('fs-extra');
const path = require('path');

describe('Parser', () => {
  let parser;
  let tempDir;

  beforeEach(async () => {
    parser = new Parser();
    tempDir = path.join(__dirname, 'temp');
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('parseFile', () => {
    test('should parse Express GET route', async () => {
      const routeContent = `
        const express = require('express');
        const app = express();
        
        app.get('/users', (req, res) => {
          res.json([]);
        });
      `;

      const routeFile = path.join(tempDir, 'routes.js');
      await fs.writeFile(routeFile, routeContent);

      const routes = await parser.parseFile(routeFile);
      
      expect(routes).toHaveLength(1);
      expect(routes[0]).toMatchObject({
        method: 'GET',
        path: '/users',
        file: routeFile
      });
    });

    test('should parse route with parameters', async () => {
      const routeContent = `
        app.get('/users/:id', (req, res) => {
          res.json({ id: req.params.id });
        });
      `;

      const routeFile = path.join(tempDir, 'routes.js');
      await fs.writeFile(routeFile, routeContent);

      const routes = await parser.parseFile(routeFile);
      
      expect(routes[0].path).toBe('/users/:id');
      expect(routes[0].parameters).toHaveLength(1);
      expect(routes[0].parameters[0].name).toBe('id');
    });

    test('should handle multiple HTTP methods', async () => {
      const routeContent = `
        app.get('/users', (req, res) => res.json([]));
        app.post('/users', (req, res) => res.status(201).json({}));
        app.put('/users/:id', (req, res) => res.json({}));
        app.delete('/users/:id', (req, res) => res.status(204).send());
      `;

      const routeFile = path.join(tempDir, 'routes.js');
      await fs.writeFile(routeFile, routeContent);

      const routes = await parser.parseFile(routeFile);
      
      expect(routes).toHaveLength(4);
      expect(routes.map(r => r.method)).toEqual(['GET', 'POST', 'PUT', 'DELETE']);
    });

    test('should extract handler code', async () => {
      const routeContent = `
        app.get('/users', (req, res) => {
          const users = getUsersFromDatabase();
          res.json(users);
        });
      `;

      const routeFile = path.join(tempDir, 'routes.js');
      await fs.writeFile(routeFile, routeContent);

      const routes = await parser.parseFile(routeFile);
      
      expect(routes[0].handlerCode).toContain('getUsersFromDatabase');
      expect(routes[0].handlerCode).toContain('res.json');
    });
  });
});