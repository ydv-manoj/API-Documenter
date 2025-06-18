const AIAnalyzer = require('../src/ai');

// Mock Groq SDK
jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }));
});

describe('AIAnalyzer', () => {
  let aiAnalyzer;
  let mockGroq;

  beforeEach(() => {
    const Groq = require('groq-sdk');
    mockGroq = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    Groq.mockImplementation(() => mockGroq);
    
    aiAnalyzer = new AIAnalyzer('fake-api-key');
  });

  describe('analyzeRoute', () => {
    test('should analyze route and return valid analysis', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: 'Get user by ID',
              description: 'Retrieve a specific user by their ID',
              tags: ['Users'],
              parameters: [{
                name: 'id',
                type: 'string',
                description: 'User ID',
                required: true,
                in: 'path'
              }],
              statusCodes: {
                '200': 'User found',
                '404': 'User not found'
              }
            })
          }
        }]
      };

      mockGroq.chat.completions.create.mockResolvedValue(mockResponse);

      const route = {
        method: 'GET',
        path: '/users/:id',
        handlerCode: 'res.json({ id: req.params.id })',
        parameters: [{ name: 'id', type: 'string' }]
      };

      const analysis = await aiAnalyzer.analyzeRoute(route);

      expect(analysis.summary).toBe('Get user by ID');
      expect(analysis.description).toBe('Retrieve a specific user by their ID');
      expect(analysis.tags).toEqual(['Users']);
      expect(analysis.parameters).toHaveLength(1);
    });

    test('should handle AI API failures gracefully', async () => {
      mockGroq.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const route = {
        method: 'GET',
        path: '/users',
        handlerCode: 'res.json([])',
        parameters: []
      };

      const analysis = await aiAnalyzer.analyzeRoute(route);

      // Should return fallback analysis
      expect(analysis.summary).toContain('users');
      expect(analysis.description).toBeDefined();
      expect(analysis.tags).toBeDefined();
    });

    test('should extract JSON from markdown response', () => {
      const markdownResponse = '```json\n{"summary": "Test"}\n```';
      const extracted = aiAnalyzer.extractJSON(markdownResponse);
      expect(extracted).toBe('{"summary": "Test"}');
    });

    test('should handle malformed JSON responses', () => {
      const malformedResponse = 'Here is the analysis: {"summary": "Test"} and some extra text';
      const extracted = aiAnalyzer.extractJSON(malformedResponse);
      expect(extracted).toBe('{"summary": "Test"}');
    });
  });

  describe('generateFallbackAnalysis', () => {
    test('should generate fallback for GET route', () => {
      const route = {
        method: 'GET',
        path: '/users',
        parameters: []
      };

      const analysis = aiAnalyzer.generateFallbackAnalysis(route);

      expect(analysis.summary).toContain('List users');
      expect(analysis.requestSchema).toBeNull();
      expect(analysis.responseSchema.type).toBe('array');
    });

    test('should generate fallback for POST route', () => {
      const route = {
        method: 'POST',
        path: '/users',
        parameters: []
      };

      const analysis = aiAnalyzer.generateFallbackAnalysis(route);

      expect(analysis.summary).toContain('Create users');
      expect(analysis.requestSchema).toBeDefined();
      expect(analysis.requestSchema.type).toBe('object');
    });
  });
});