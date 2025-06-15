const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to Express Basic API',
    version: '1.0.0',
    endpoints: ['/api/users', '/api/products', '/api/auth']
  });
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;