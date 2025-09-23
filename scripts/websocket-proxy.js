#!/usr/bin/env node

/**
 * Proxy CORS simple para desarrollo con Binance WebSocket
 * 
 * Uso:
 * 1. npm install ws express cors
 * 2. node scripts/websocket-proxy.js
 * 3. Cambiar useProxy: true en src/config/websocket.ts
 */

const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 8080;

// Habilitar CORS para todas las rutas
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:19006'],
  credentials: true
}));

// Proxy para API REST de Binance
app.use('/api', createProxyMiddleware({
  target: 'https://api.binance.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/'
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: 'Proxy error' });
  }
}));

// Crear servidor WebSocket
const wss = new WebSocket.Server({ 
  port: 8081,
  perMessageDeflate: false 
});

console.log('🚀 CORS Proxy iniciado:');
console.log('📡 HTTP API Proxy: http://localhost:8080/api');
console.log('🔌 WebSocket Proxy: ws://localhost:8081');

// Manejar conexiones WebSocket
wss.on('connection', (clientWs) => {
  console.log('👤 Cliente conectado al proxy');
  
  // Conectar al WebSocket real de Binance
  const binanceWs = new WebSocket('wss://stream.binance.com:9443/ws/');
  
  binanceWs.on('open', () => {
    console.log('📡 Conectado a Binance WebSocket');
  });
  
  binanceWs.on('message', (data) => {
    // Reenviar mensaje del servidor Binance al cliente
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data);
    }
  });
  
  binanceWs.on('error', (error) => {
    console.error('❌ Error en Binance WebSocket:', error.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'Binance WebSocket error');
    }
  });
  
  binanceWs.on('close', () => {
    console.log('🔌 Binance WebSocket desconectado');
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'Binance WebSocket closed');
    }
  });
  
  // Reenviar mensajes del cliente a Binance
  clientWs.on('message', (data) => {
    if (binanceWs.readyState === WebSocket.OPEN) {
      binanceWs.send(data);
    }
  });
  
  clientWs.on('close', () => {
    console.log('👤 Cliente desconectado del proxy');
    if (binanceWs.readyState === WebSocket.OPEN) {
      binanceWs.close();
    }
  });
  
  clientWs.on('error', (error) => {
    console.error('❌ Error en cliente WebSocket:', error.message);
    if (binanceWs.readyState === WebSocket.OPEN) {
      binanceWs.close();
    }
  });
});

// Iniciar servidor HTTP
app.listen(PORT, () => {
  console.log('✅ Proxy CORS listo para desarrollo');
  console.log('');
  console.log('📝 Para usar el proxy:');
  console.log('1. Cambiar useProxy: true en src/config/websocket.ts');
  console.log('2. Reiniciar tu aplicación React Native');
});

// Manejo de errores global
process.on('uncaughtException', (error) => {
  console.error('💥 Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promesa rechazada no manejada:', reason);
});
