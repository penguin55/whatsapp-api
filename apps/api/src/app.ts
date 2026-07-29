/**
 * WhatsApp API Gateway
 * 
 * Main application entry point
 */

import 'reflect-metadata';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import apiReference from '@scalar/fastify-api-reference';
import { env, validateEnv } from './config/env';
import { initDatabase, closeDatabase } from './config/database';
import { swaggerConfig } from './config/swagger';
import { sessionRoutes } from './routes/sessionRoutes';
import { userRoutes } from './routes/userRoutes';
import { authRoutes } from './routes/authRoutes';
import { restoreAllSessions, closeAllSessions } from './services/whatsappService';
import { startScheduler, stopScheduler } from './services/schedulerService';
import { User } from './models/User';
import { readFile } from 'fs/promises';
import path from 'path';

// Create Fastify instance
const app: FastifyInstance = Fastify({
  logger: {
    level: env.logLevel,
    transport: env.isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        }
      : undefined,
  },
  ajv: {
    customOptions: {
      removeAdditional: true,
      coerceTypes: true,
      useDefaults: true,
      keywords: ['example'],
    },
  },
});

/**
 * Register plugins and routes
 */
async function registerPlugins(): Promise<void> {
  // Swagger documentation (OpenAPI 3.0 generator)
  await app.register(swagger, swaggerConfig);

  // Scalar API Reference (Better UI + Code Snippets)
  await app.register(apiReference, {
    routePrefix: '/docs',
    configuration: {
      title: 'VenusConnect API Documentation',
      theme: 'purple',
      spec: {
        content: () => app.swagger(),
      },
    },
  });

  // Rate limiting - anti-spam protection
  await app.register(rateLimit, {
    max: 100, // 100 requests per window
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      success: false,
      error: 'Too many requests. Please slow down.',
      code: 'RATE_LIMIT_EXCEEDED',
    }),
  });

  // CORS
  await app.register(cors, {
    origin: env.corsOrigins.length > 0 ? env.corsOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'x-csrf-token'],
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // Health check route (no auth required)
  app.get('/health', {
    schema: {
      hide: true,
    },
  }, async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  const dashboardRoot = path.join(__dirname, '..', 'public', 'dashboard');
  const dashboardHeaders = {
    'Cache-Control': 'no-store',
    'Content-Security-Policy':
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
  };

  app.get('/dashboard', {
    schema: { hide: true },
  }, async (_, reply) => reply.redirect('/dashboard/'));

  app.get('/dashboard/', {
    schema: { hide: true },
  }, async (_, reply) => {
    const html = await readFile(path.join(dashboardRoot, 'index.html'), 'utf-8');
    return reply
      .headers(dashboardHeaders)
      .header('Content-Type', 'text/html; charset=utf-8')
      .send(html);
  });

  app.get<{ Params: { '*': string } }>('/dashboard/assets/*', {
    schema: { hide: true },
  }, async (request, reply) => {
    const fileName = path.basename(request.params['*']);
    const extension = path.extname(fileName);
    const contentTypes: Record<string, string> = {
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    if (!fileName || !contentTypes[extension]) return reply.code(404).send();

    const asset = await readFile(path.join(dashboardRoot, 'assets', fileName));
    return reply
      .header('Content-Type', contentTypes[extension])
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .header('X-Content-Type-Options', 'nosniff')
      .send(asset);
  });

  // API info route
  app.get('/', {
    schema: {
      hide: true,
      tags: ['Health'],
      summary: 'API Info',
      description: 'Returns API information and documentation links',
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            documentation: { type: 'string' },
            openapi: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    return {
      name: 'VenusConnect - WhatsApp API Gateway',
      version: '2.0.0',
      documentation: '/docs',
      openapi: '/openapi.json',
    };
  });

  // Serve OpenAPI 3.0 specification
  app.get('/openapi.json', {
    schema: {
      tags: ['Health'],
      summary: 'OpenAPI 3.0 Specification',
      description: 'Returns the complete OpenAPI 3.0.3 specification in JSON format',
      hide: true,
    },
  }, async (_, reply) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const specPath = path.join(__dirname, '..', 'docs', 'openapi.json');
      const spec = await fs.readFile(specPath, 'utf-8');
      reply.header('Content-Type', 'application/json');
      return spec;
    } catch {
      return { error: 'OpenAPI specification not found' };
    }
  });

  // Register session routes under /api prefix
  await app.register(sessionRoutes, { prefix: '/api' });

  // Register user routes under /api prefix
  await app.register(userRoutes, { prefix: '/api' });

  // Register auth routes under /api prefix (PUBLIC - no auth required)
  await app.register(authRoutes, { prefix: '/api' });
}

/**
 * Create initial admin user if not exists
 */
async function seedDatabase(): Promise<void> {
  const userCount = await User.count();
  if (userCount > 0) return;

  const { username, password } = env.admin;
  if (!username || !password) {
    throw new Error(
      'The database has no users. Set ADMIN_USERNAME and ADMIN_PASSWORD to create the initial admin.'
    );
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
  }

  const adminUser = await User.create({
    username,
    password,
    role: 'admin',
  });

  console.log('='.repeat(60));
  console.log('🔐 INITIAL ADMIN USER CREATED');
  console.log('='.repeat(60));
  console.log(`Username: ${adminUser.username}`);
  console.log('Role:     admin');
  console.log('The password and API key are not written to logs.');
  console.log('='.repeat(60));
}

/**
 * Start the server
 */
async function start(): Promise<void> {
  try {
    // Validate environment
    validateEnv();

    // Initialize database
    await initDatabase();

    // Seed database with initial data
    await seedDatabase();

    // Register plugins and routes
    await registerPlugins();

    // Restore existing sessions
    await restoreAllSessions();

    // Start scheduled message processor
    startScheduler();

    // Start server
    const address = await app.listen({
      port: env.port,
      host: env.host,
    });

    console.log('');
    console.log('🚀 WhatsApp API Gateway is running!');
    console.log(`📍 Server: ${address}`);
    console.log(`🔧 Environment: ${env.nodeEnv}`);
    console.log(`⏰ Scheduler: Active (checking every minute)`);
    console.log(`🛡️  Rate Limit: 100 requests/minute`);
    console.log('');
    console.log('API Endpoints:');
    console.log('');
    console.log('Session:');
    console.log(`  POST   ${address}/api/session/create`);
    console.log(`  GET    ${address}/api/sessions`);
    console.log(`  GET    ${address}/api/session/:id/status`);
    console.log(`  GET    ${address}/api/session/:id/qr`);
    console.log(`  DELETE ${address}/api/session/:id`);
    console.log(`  POST   ${address}/api/session/:id/send`);
    console.log(`  POST   ${address}/api/session/:id/broadcast`);
    console.log(`  POST   ${address}/api/session/:id/schedule`);
    console.log('');
    console.log('User:');
    console.log(`  GET    ${address}/api/users/me`);
    console.log(`  POST   ${address}/api/users`);
    console.log(`  GET    ${address}/api/users`);
    console.log(`  GET    ${address}/api/users/:id`);
    console.log(`  PUT    ${address}/api/users/:id`);
    console.log(`  DELETE ${address}/api/users/:id`);
    console.log(`  POST   ${address}/api/users/:id/regenerate-key`);
    console.log('');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  console.log('\n🛑 Shutting down gracefully...');

  try {
    // Stop scheduler
    stopScheduler();

    // Close all WhatsApp sessions
    await closeAllSessions();

    // Close server
    await app.close();

    // Close database
    await closeDatabase();

    console.log('👋 Goodbye!');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the application
start();

export default app;
