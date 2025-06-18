const Generator = require('../src/generator');

describe('Generator', () => {
  let generator;

  beforeEach(() => {
    generator = new Generator({
      title: 'Test API',
      version: '1.0.0',
      description: 'Test API Documentation'
    });
  });

  describe('generateSpec', () => {
    test('should generate valid OpenAPI 3.0 spec', () => {
      const analysisResults = [
        {
          route: {
            method: 'GET',
            path: '/users',
            parameters: []
          },
          analysis: {
            summary: 'Get all users',
            description: 'Retrieve a list of all users',
            tags: ['Users'],
            parameters: [],
            statusCodes: { '200': 'Success' },
            responseSchema: {
              type: 'array',
              items: { type: 'object' }
            }
          }
        }
      ];

      const spec = generator.generateSpec(analysisResults);

      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info.title).toBe('Test API');
      expect(spec.paths['/users']).toBeDefined();
      expect(spec.paths['/users'].get).toBeDefined();
      expect(spec.paths['/users'].get.summary).toBe('Get all users');
    });

    test('should group routes by path', () => {
      const analysisResults = [
        {
          route: { method: 'GET', path: '/users' },
          analysis: { summary: 'Get users', tags: ['Users'], statusCodes: { '200': 'Success' } }
        },
        {
          route: { method: 'POST', path: '/users' },
          analysis: { summary: 'Create user', tags: ['Users'], statusCodes: { '201': 'Created' } }
        }
      ];

      const spec = generator.generateSpec(analysisResults);

      expect(spec.paths['/users'].get).toBeDefined();
      expect(spec.paths['/users'].post).toBeDefined();
    });

    test('should add request body for POST requests', () => {
      const analysisResults = [
        {
          route: { method: 'POST', path: '/users' },
          analysis: {
            summary: 'Create user',
            tags: ['Users'],
            statusCodes: { '201': 'Created' },
            requestSchema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string' }
              }
            }
          }
        }
      ];

      const spec = generator.generateSpec(analysisResults);

      expect(spec.paths['/users'].post.requestBody).toBeDefined();
      expect(spec.paths['/users'].post.requestBody.content['application/json'].schema).toEqual(
        analysisResults[0].analysis.requestSchema
      );
    });
  });
});