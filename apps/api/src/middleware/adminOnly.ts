/**
 * Admin Only Middleware
 * 
 * Restricts access to admin users only
 */

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Check if user is admin
 */
export async function adminOnly(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = request.user;

  if (!user) {
    reply.status(401).send({
      success: false,
      error: 'Not authenticated',
    });
    return;
  }

  if (user.role !== 'admin') {
    reply.status(403).send({
      success: false,
      error: 'Access denied. Admin privileges required.',
    });
    return;
  }
}

export default adminOnly;
