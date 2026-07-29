/**
 * Scheduled Message Controller
 * 
 * Handles CRUD for scheduled messages
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ScheduledMessage, ScheduledMessageStatus } from '../models/ScheduledMessage';
import { Session } from '../models/Session';

// Types
interface SessionParams {
  sessionId: string;
}

interface ScheduleParams {
  sessionId: string;
  messageId: string;
}

interface CreateScheduledBody {
  recipient: string;
  recipient_type?: 'individual' | 'group';
  message?: string;
  media?: Array<{
    type: 'image' | 'video' | 'document' | 'audio' | 'sticker';
    data: string;
    caption?: string;
    filename?: string;
    mimetype?: string;
  }>;
  scheduled_at: string; // ISO date string
}

/**
 * Create a scheduled message
 * POST /session/:sessionId/schedule
 */
export async function createScheduledHandler(
  request: FastifyRequest<{ Params: SessionParams; Body: CreateScheduledBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { sessionId } = request.params;
    const { recipient, recipient_type = 'individual', message, media, scheduled_at } = request.body;
    const user = request.user!;

    // Validate
    if (!recipient) {
      reply.status(400).send({ success: false, error: 'Recipient required' });
      return;
    }

    if (!message && (!media || media.length === 0)) {
      reply.status(400).send({ success: false, error: 'Message or media required' });
      return;
    }

    if (!scheduled_at) {
      reply.status(400).send({ success: false, error: 'scheduled_at required (ISO date)' });
      return;
    }

    const scheduleDate = new Date(scheduled_at);
    if (isNaN(scheduleDate.getTime())) {
      reply.status(400).send({ success: false, error: 'Invalid scheduled_at date format' });
      return;
    }

    if (scheduleDate <= new Date()) {
      reply.status(400).send({ success: false, error: 'scheduled_at must be in the future' });
      return;
    }

    // Verify session
    const session = await Session.findOne({
      where: { session_id: sessionId, user_id: user.id },
    });

    if (!session) {
      reply.status(404).send({ success: false, error: 'Session not found' });
      return;
    }

    // Create scheduled message
    const scheduledMsg = await ScheduledMessage.create({
      user_id: user.id,
      session_id: sessionId,
      recipient,
      recipient_type,
      message: message || null,
      media: media ? JSON.stringify(media) : null,
      scheduled_at: scheduleDate,
      status: ScheduledMessageStatus.PENDING,
    });

    reply.status(201).send({
      success: true,
      data: {
        id: scheduledMsg.id,
        recipient: scheduledMsg.recipient,
        recipient_type: scheduledMsg.recipient_type,
        scheduled_at: scheduledMsg.scheduled_at,
        status: scheduledMsg.status,
        created_at: scheduledMsg.created_at,
      },
    });
  } catch (error) {
    console.error('[Controller] Create scheduled error:', error);
    reply.status(500).send({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * List scheduled messages
 * GET /session/:sessionId/schedule
 */
export async function listScheduledHandler(
  request: FastifyRequest<{ Params: SessionParams }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { sessionId } = request.params;
    const user = request.user!;

    // Verify session
    const session = await Session.findOne({
      where: { session_id: sessionId, user_id: user.id },
    });

    if (!session) {
      reply.status(404).send({ success: false, error: 'Session not found' });
      return;
    }

    const messages = await ScheduledMessage.findAll({
      where: { 
        session_id: sessionId, 
        user_id: user.id,
        status: [ScheduledMessageStatus.PENDING, ScheduledMessageStatus.PROCESSING],
      },
      order: [['scheduled_at', 'ASC']],
    });

    reply.send({
      success: true,
      data: messages.map((m) => ({
        id: m.id,
        recipient: m.recipient,
        recipient_type: m.recipient_type,
        message: m.message,
        hasMedia: !!m.media,
        scheduled_at: m.scheduled_at,
        status: m.status,
        created_at: m.created_at,
      })),
    });
  } catch (error) {
    console.error('[Controller] List scheduled error:', error);
    reply.status(500).send({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Get scheduled message
 * GET /session/:sessionId/schedule/:messageId
 */
export async function getScheduledHandler(
  request: FastifyRequest<{ Params: ScheduleParams }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { sessionId, messageId } = request.params;
    const user = request.user!;

    const msg = await ScheduledMessage.findOne({
      where: { id: messageId, session_id: sessionId, user_id: user.id },
    });

    if (!msg) {
      reply.status(404).send({ success: false, error: 'Scheduled message not found' });
      return;
    }

    reply.send({
      success: true,
      data: {
        id: msg.id,
        recipient: msg.recipient,
        recipient_type: msg.recipient_type,
        message: msg.message,
        media: msg.getMediaItems(),
        scheduled_at: msg.scheduled_at,
        status: msg.status,
        error: msg.error,
        sent_at: msg.sent_at,
        wa_message_id: msg.wa_message_id,
        created_at: msg.created_at,
      },
    });
  } catch (error) {
    console.error('[Controller] Get scheduled error:', error);
    reply.status(500).send({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Cancel scheduled message
 * DELETE /session/:sessionId/schedule/:messageId
 */
export async function cancelScheduledHandler(
  request: FastifyRequest<{ Params: ScheduleParams }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { sessionId, messageId } = request.params;
    const user = request.user!;

    const msg = await ScheduledMessage.findOne({
      where: { id: messageId, session_id: sessionId, user_id: user.id },
    });

    if (!msg) {
      reply.status(404).send({ success: false, error: 'Scheduled message not found' });
      return;
    }

    if (msg.status !== ScheduledMessageStatus.PENDING) {
      reply.status(400).send({ success: false, error: `Cannot cancel message with status: ${msg.status}` });
      return;
    }

    msg.status = ScheduledMessageStatus.CANCELLED;
    await msg.save();

    reply.send({ success: true, message: 'Scheduled message cancelled' });
  } catch (error) {
    console.error('[Controller] Cancel scheduled error:', error);
    reply.status(500).send({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Get scheduled message history
 * GET /session/:sessionId/schedule/history
 */
export async function historyScheduledHandler(
  request: FastifyRequest<{ Params: SessionParams }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { sessionId } = request.params;
    const user = request.user!;

    // Verify session
    const session = await Session.findOne({
      where: { session_id: sessionId, user_id: user.id },
    });

    if (!session) {
      reply.status(404).send({ success: false, error: 'Session not found' });
      return;
    }

    const messages = await ScheduledMessage.findAll({
      where: { 
        session_id: sessionId, 
        user_id: user.id,
        status: [ScheduledMessageStatus.SENT, ScheduledMessageStatus.FAILED, ScheduledMessageStatus.CANCELLED],
      },
      order: [['scheduled_at', 'DESC']],
      limit: 100,
    });

    reply.send({
      success: true,
      data: messages.map((m) => ({
        id: m.id,
        recipient: m.recipient,
        recipient_type: m.recipient_type,
        message: m.message,
        scheduled_at: m.scheduled_at,
        status: m.status,
        error: m.error,
        sent_at: m.sent_at,
      })),
    });
  } catch (error) {
    console.error('[Controller] History scheduled error:', error);
    reply.status(500).send({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export default {
  createScheduledHandler,
  listScheduledHandler,
  getScheduledHandler,
  cancelScheduledHandler,
  historyScheduledHandler,
};
