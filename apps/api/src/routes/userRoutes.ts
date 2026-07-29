/**
 * User Routes
 * 
 * API routes for user management
 * Most endpoints require admin access
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { adminOnly } from '../middleware/adminOnly';
import { UserSchemas } from '../config/routeSchemas';
import {
  createUserHandler,
  listUsersHandler,
  getUserHandler,
  updateUserHandler,
  deleteUserHandler,
  regenerateApiKeyHandler,
  getMeHandler,
} from '../controllers/userController';

/**
 * Register user routes
 */
export async function userRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  // Apply API key authentication to all routes
  fastify.addHook('preHandler', apiKeyAuth);

  // ========================================
  // USER ENDPOINTS (any authenticated user)
  // ========================================

  // Get current user profile
  fastify.get('/users/me', { schema: UserSchemas.me }, getMeHandler);

  // ========================================
  // ADMIN ENDPOINTS (admin only)
  // ========================================

  // Create new user (admin only)
  fastify.route({
    method: 'POST',
    url: '/users',
    schema: UserSchemas.create,
    preHandler: adminOnly,
    handler: createUserHandler,
  });

  // List all users (admin only)
  fastify.route({
    method: 'GET',
    url: '/users',
    schema: UserSchemas.list,
    preHandler: adminOnly,
    handler: listUsersHandler,
  });

  // Get user by ID (admin only)
  fastify.route({
    method: 'GET',
    url: '/users/:userId',
    schema: UserSchemas.get,
    preHandler: adminOnly,
    handler: getUserHandler,
  });

  // Update user (admin only)
  fastify.route({
    method: 'PUT',
    url: '/users/:userId',
    schema: UserSchemas.update,
    preHandler: adminOnly,
    handler: updateUserHandler,
  });

  // Delete user (admin only)
  fastify.route({
    method: 'DELETE',
    url: '/users/:userId',
    schema: UserSchemas.delete,
    preHandler: adminOnly,
    handler: deleteUserHandler,
  });

  // Regenerate API key (admin only)
  fastify.route({
    method: 'POST',
    url: '/users/:userId/regenerate-key',
    schema: UserSchemas.regenerateKey,
    preHandler: adminOnly,
    handler: regenerateApiKeyHandler,
  });
}

export default userRoutes;
