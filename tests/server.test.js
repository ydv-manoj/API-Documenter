const request = require('supertest');
const Server = require('../src/server');
const fs = require('fs-extra');
const path = require('path');

describe('Server', () => {
  let server;
  let app;
  let tempDir;

  beforeEach(async () => {
    server = new Server();
    tempDir = path.join(__dirname, 'temp');
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    if (server) {
      server.stop();
    }
    await fs.remove(tempDir);
  });

  describe('server functionality', () => {
    test('should start server and serve health endpoint', async () => {
      const mockSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {}
      };

      const specFile = path.join(tempDir, 'openapi.json');
      await fs.writeJSON(specFile, mockSpec);

      await server.start({
        port: 0, // Random available port
        host: 'localhost',
        specPath: specFile
      });

      const response = await request(server.app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });

    test('should serve OpenAPI spec', async () => {
      const mockSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              summary: 'Get users'
            }
          }
        }
      };

      const specFile = path.join(tempDir, 'openapi.json');
      await fs.writeJSON(specFile, mockSpec);

      await server.start({
        port: 0,
        host: 'localhost',
        specPath: specFile
      });

      const response = await request(server.app).get('/spec');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSpec);
    });

    test('should redirect root to docs', async () => {
      const mockSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {}
      };

      const specFile = path.join(tempDir, 'openapi.json');
      await fs.writeJSON(specFile, mockSpec);

      await server.start({
        port: 0,
        host: 'localhost',
        specPath: specFile
      });

      const response = await request(server.app).get('/');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/api-docs');
    });
  });
});