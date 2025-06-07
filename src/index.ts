import 'dotenv/config';
import express, { Request, Response } from 'express';
import { logger } from './utils/logger';
import { startBot } from './bot';
import { handleWebhook } from './bot/handlers/webhookHandler';
import { stopBotPolling } from './bot/botInstance';
import { exchangeRateJobService } from './services/jobs/exchangeRateJobService';
import adminRoutes from './routes/admin';
import net from 'net';

const app = express();
const defaultPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware
app.use(express.json());

// Admin routes (PRD requirement: Exchange rate monitoring)
app.use('/admin', adminRoutes);

// Webhook endpoint
app.post('/webhook', (req: Request, res: Response) => {
  handleWebhook(req, res).catch(error => {
    logger.error('Webhook handler error', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    });
    res.sendStatus(500);
  });
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.sendStatus(200);
});

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        // Port is in use, try the next one
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(error);
      }
    });

    server.listen(startPort, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Graceful shutdown handler
 */
const shutdown = async () => {
  try {
    logger.info('Shutting down gracefully...');
    
    // Stop exchange rate background job
    exchangeRateJobService.stopJob();
    logger.info('Exchange rate background job stopped');
    
    // Stop bot polling
    await stopBotPolling();
    
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    });
    process.exit(1);
  }
};

// Start server
async function startServer() {
  try {
    // Find available port
    const port = await findAvailablePort(defaultPort);
    
    // Start bot
    await startBot();
    
    // Start exchange rate background job (PRD requirement: Automated updates)
    exchangeRateJobService.startJob();
    logger.info('Exchange rate background job started', {
      schedule: 'Every 4 hours'
    });
    
    // Start server
    app.listen(port, () => {
      logger.info('Server started', {
        port,
        env: process.env.NODE_ENV,
        originalPort: defaultPort,
        exchangeRateJob: 'active'
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      attemptedPort: defaultPort
    });
    process.exit(1);
  }
}

// Start the server
startServer();

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  // Enhanced error logging for bot conflicts
  if (error.message.includes('ETELEGRAM') || error.message.includes('getUpdates')) {
    console.log('\x1b[31m%s\x1b[0m', 'Bot Conflict Detected!');
    console.log('\x1b[33m%s\x1b[0m', 'Error Details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Log process information
    console.log('\x1b[36m%s\x1b[0m', 'Process Info:', {
      pid: process.pid,
      ppid: process.ppid,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  }

  logger.error('Uncaught Exception', {
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error,
    processInfo: {
      pid: process.pid,
      ppid: process.ppid,
      uptime: process.uptime()
    }
  });
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  // Enhanced error logging for bot conflicts
  if (error instanceof Error && (error.message.includes('ETELEGRAM') || error.message.includes('getUpdates'))) {
    console.log('\x1b[31m%s\x1b[0m', 'Bot Conflict Detected in Promise!');
    console.log('\x1b[33m%s\x1b[0m', 'Error Details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Log process information
    console.log('\x1b[36m%s\x1b[0m', 'Process Info:', {
      pid: process.pid,
      ppid: process.ppid,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  }

  logger.error('Unhandled Rejection', {
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error,
    processInfo: {
      pid: process.pid,
      ppid: process.ppid,
      uptime: process.uptime()
    }
  });
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown); 