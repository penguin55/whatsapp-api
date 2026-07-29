/**
 * Auth Routes (Public - No API Key Required)
 * 
 * Endpoints for user registration and login
 */

import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { User } from '../models/User';
import { AuthSchemas } from '../config/routeSchemas';
import {
  clearDashboardSessionCookie,
  createDashboardSession,
  readDashboardSession,
} from '../lib/dashboardAuth';

// Request body types
interface RegisterBody {
  username: string;
  email?: string;
  password: string;
}

interface LoginBody {
  username: string;
  password: string;
}

/**
 * Register a new user (PUBLIC - no auth required)
 * POST /auth/register
 */
async function registerHandler(
  request: FastifyRequest<{ Body: RegisterBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { username, email, password } = request.body;

    // Validate input
    if (!username || !password) {
      reply.status(400).send({
        success: false,
        error: 'Username and password are required',
      });
      return;
    }

    if (password.length < 6) {
      reply.status(400).send({
        success: false,
        error: 'Password must be at least 6 characters',
      });
      return;
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      reply.status(400).send({
        success: false,
        error: 'Username already exists',
      });
      return;
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        reply.status(400).send({
          success: false,
          error: 'Email already exists',
        });
        return;
      }
    }

    // Create user
    const user = await User.create({ username, email, password });

    reply.status(201).send({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        api_key: user.api_key,
        created_at: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[Auth] Register error:', error);
    reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
    });
  }
}

/**
 * Login and get API key (PUBLIC - no auth required)
 * POST /auth/login
 */
async function loginHandler(
  request: FastifyRequest<{ Body: LoginBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { username, password } = request.body;

    // Validate input
    if (!username || !password) {
      reply.status(400).send({
        success: false,
        error: 'Username and password are required',
      });
      return;
    }

    // Find user
    const user = await User.findOne({ where: { username } });
    if (!user) {
      reply.status(401).send({
        success: false,
        error: 'Invalid username or password',
      });
      return;
    }

    // Check if user is active
    if (!user.is_active) {
      reply.status(401).send({
        success: false,
        error: 'Account is disabled',
      });
      return;
    }

    // Verify password
    const isValid = await user.verifyPassword(password);
    if (!isValid) {
      reply.status(401).send({
        success: false,
        error: 'Invalid username or password',
      });
      return;
    }

    // Update last login
    user.last_login = new Date();
    await user.save();

    reply.send({
      success: true,
      message: 'Login successful',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        api_key: user.api_key,
        last_login: user.last_login,
      },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Login failed',
    });
  }
}

/**
 * Browser-only login. The permanent API key is never returned to JavaScript.
 */
async function dashboardLoginHandler(
  request: FastifyRequest<{ Body: LoginBody }>,
  reply: FastifyReply
): Promise<void> {
  const { username, password } = request.body || {};
  if (!username || !password) {
    reply.status(400).send({
      success: false,
      error: 'Username and password are required',
    });
    return;
  }
  const user = await User.findOne({ where: { username, is_active: true } });

  if (!user || !(await user.verifyPassword(password))) {
    reply.status(401).send({
      success: false,
      error: 'Invalid username or password',
    });
    return;
  }

  user.last_login = new Date();
  await user.save();

  const session = createDashboardSession(user.id);
  reply.header('Set-Cookie', session.cookie).send({
    success: true,
    data: {
      username: user.username,
      csrf_token: session.csrfToken,
    },
  });
}

async function dashboardSessionHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const session = readDashboardSession(request.headers.cookie);
  if (!session) {
    reply.status(401).send({ success: false, error: 'Session expired' });
    return;
  }

  const user = await User.findOne({
    where: { id: session.userId, is_active: true },
    attributes: ['id', 'username'],
  });
  if (!user) {
    reply.status(401).send({ success: false, error: 'Session expired' });
    return;
  }

  reply.send({
    success: true,
    data: {
      username: user.username,
      csrf_token: session.csrf,
    },
  });
}

async function dashboardLogoutHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const session = readDashboardSession(request.headers.cookie);
  const csrfToken = request.headers['x-csrf-token'];
  if (!session || typeof csrfToken !== 'string' || csrfToken !== session.csrf) {
    reply.status(403).send({ success: false, error: 'Invalid CSRF token' });
    return;
  }

  reply
    .header('Set-Cookie', clearDashboardSessionCookie())
    .send({ success: true, message: 'Logged out' });
}

/**
 * Register auth routes (PUBLIC - no authentication)
 */
export async function authRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  // Register new user
  fastify.post('/auth/register', { schema: AuthSchemas.register }, registerHandler);

  // Login
  fastify.post('/auth/login', { schema: AuthSchemas.login }, loginHandler);

  // Browser dashboard authentication (HttpOnly cookie; no API key exposure).
  fastify.post('/auth/dashboard/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
  }, dashboardLoginHandler);
  fastify.get('/auth/dashboard/session', dashboardSessionHandler);
  fastify.post('/auth/dashboard/logout', dashboardLogoutHandler);
}

export default authRoutes;
