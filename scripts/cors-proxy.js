const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 3002;

console.log('🔧 Setting up CORS proxy...');

// Enable CORS for all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Accept'],
  credentials: false
}));

console.log('✅ CORS middleware configured');

// Proxy for Binance API
const proxyOptions = {
  target: 'https://api.binance.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/binance': '/api/v3',
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 Proxying: ${req.method} ${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ Response: ${proxyRes.statusCode} for ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error:', err.message);
    res.status(500).json({ error: 'Proxy error', message: err.message });
  }
};

app.use('/api/binance', createProxyMiddleware(proxyOptions));

console.log('✅ Proxy middleware configured');

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'CORS Proxy is running',
    timestamp: new Date().toISOString()
  });
});

console.log('✅ Health check endpoint configured');

app.listen(PORT, (err) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
  
  console.log('🚀 CORS Proxy server started successfully');
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`🔗 Binance API Proxy: http://localhost:${PORT}/api/binance`);
  console.log(`💊 Health Check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('Ready to proxy requests!');
});
