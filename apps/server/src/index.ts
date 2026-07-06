import express from 'express';
import http from 'http';
import { initSocketServer } from './socket/socketServer';
import { prisma } from '@greeed/database';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: 'connected' });
});

const server = http.createServer(app);

initSocketServer(server);

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
    
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
