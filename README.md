# API-Documenter 🚀

**Automatically scan your codebase and generate interactive Swagger UI documentation for your APIs**

Stop maintaining outdated API docs manually! API-Documenter analyzes your Express.js (and other framework) routes and creates live, testable documentation that stays in sync with your code.

## ✨ What It Does

- 🔍 **Auto-discovers** all API endpoints in your codebase
- 📖 **Generates** OpenAPI 3.0 specification from your routes
- 🌐 **Serves** interactive Swagger UI for testing APIs
- 🔄 **Keeps docs in sync** with code changes automatically
- 🚀 **Zero configuration** - works out of the box

## 🎯 Perfect For

- **Developers** - Never write API docs manually again
- **QA Teams** - Test APIs without Postman collections
- **Frontend Devs** - Explore available endpoints instantly
- **Product Teams** - Understand API capabilities without diving into code

## 🚀 Quick Start

```bash
# Install globally
npm install -g api-documenter

# Scan your project and start interactive docs
cd your-project
api-documenter scan src/

# Serves Swagger UI at http://localhost:3001
```

## 📋 Features

### Current Support
- ✅ Express.js route detection
- ✅ HTTP methods (GET, POST, PUT, DELETE)
- ✅ Route parameters (/users/:id)
- ✅ Query parameters inference
- ✅ Interactive Swagger UI
- ✅ Live API testing

### Coming Soon
- 🔄 Fastify support
- 🔄 Koa.js support
- 🔄 Request/response schema inference
- 🔄 Authentication detection
- 🔄 File watching for auto-reload

## 📖 Usage

### Basic Scanning
```bash
# Scan current directory
api-documenter scan

# Scan specific directory
api-documenter scan ./src/routes

# Scan with custom output
api-documenter scan ./src --output ./docs
```

### Server Mode
```bash
# Start documentation server
api-documenter serve

# Custom port
api-documenter serve --port 4000

# Auto-reload on file changes
api-documenter serve --watch
```

### Configuration
```bash
# Generate config file
api-documenter init

# Use custom config
api-documenter scan --config ./api-doc.config.js
```

## 🏗️ Architecture

API-Documenter is built with a modular architecture:

```
src/
├── scanner/          # File discovery and route detection
├── parser/           # AST parsing and code analysis  
├── generator/        # OpenAPI specification generation
├── server/           # Swagger UI server and proxy
└── cli/              # Command-line interface
```

## 🔧 Supported Frameworks

| Framework | Status | Route Detection | Middleware |
|-----------|--------|----------------|------------|
| Express.js | ✅ | Full | Partial |
| Fastify | 🔄 | Coming Soon | - |
| Koa.js | 🔄 | Coming Soon | - |
| Nest.js | 🔄 | Planned | - |

## 📊 Example Output

Given this Express route:
```javascript
app.get('/users/:id', (req, res) => {
  res.json({ user: users[req.params.id] });
});

app.post('/users', (req, res) => {
  const user = createUser(req.body);
  res.status(201).json(user);
});
```

API-Documenter generates:
- OpenAPI 3.0 specification
- Interactive Swagger UI
- Live API testing interface
- Route parameter documentation

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/ydv-manoj/API-Documenter.git
cd API-Documenter

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## 📁 Project Structure

```
API-Documenter/
├── src/
│   ├── scanner/          # File and route discovery
│   ├── parser/           # Code analysis and AST parsing
│   ├── generator/        # OpenAPI spec generation
│   ├── server/           # Swagger UI server
│   └── cli/              # Command-line interface
├── examples/             # Sample projects for testing
├── templates/            # HTML templates
└── tests/                # Test suites
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Swagger UI team for the interactive documentation interface
- AST parsing libraries that make code analysis possible
- The Node.js community for excellent tooling

## 📈 Roadmap

- [ ] Multi-framework support (Fastify, Koa, NestJS)
- [ ] Request/response schema inference
- [ ] Authentication and security schemes
- [ ] Custom template support
- [ ] Integration with popular API testing tools
- [ ] VS Code extension
- [ ] GitHub Actions integration

---

**Made with ❤️ for developers who hate maintaining docs manually**

[![npm version](https://badge.fury.io/js/api-documenter.svg)](https://www.npmjs.com/package/api-documenter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)