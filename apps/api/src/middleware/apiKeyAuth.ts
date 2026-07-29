/**
 * API Key Authentication Middleware
 * 
 * Validates API key from x-api-key header and attaches user to request
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { User } from '../models/User';
import { readDashboardSession } from '../lib/dashboardAuth';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

/**
 * Verify API key and attach user to request
 */
export async function apiKeyAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string | undefined;
  const dashboardSession = apiKey
    ? null
    : readDashboardSession(request.headers.cookie);

  if (!apiKey && !dashboardSession) {
    reply.status(401).send({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  try {
    const user = await User.findOne(
      apiKey
        ? { where: { api_key: apiKey, is_active: true } }
        : { where: { id: dashboardSession!.userId, is_active: true } }
    );

    if (!user) {
      reply.status(401).send({
        success: false,
        error: 'Invalid or expired authentication',
      });
      return;
    }

    if (dashboardSession && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const csrfToken = request.headers['x-csrf-token'];
      if (
        typeof csrfToken !== 'string' ||
        csrfToken !== dashboardSession.csrf
      ) {
        reply.status(403).send({
          success: false,
          error: 'Invalid CSRF token',
        });
        return;
      }
    }

    request.user = user;
  } catch (error) {
    console.error('[Auth] Error validating API key:', error);
    reply.status(500).send({
      success: false,
      error: 'Authentication error',
    });
  }
}

export default apiKeyAuth;
