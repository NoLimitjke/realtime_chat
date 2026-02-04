import { redis } from '@/lib/redis';
import { Elysia } from 'elysia';
import { nanoid } from 'nanoid';
import { authMiddleware } from './auth';
import { z } from 'zod';
import { Message, realtime } from '@/lib/realtime';

const ROOM_TTL_SECONDS = 60 * 10;

/* ===================== ROOMS ===================== */

const rooms = new Elysia({ prefix: '/room' })

  // ---------- CREATE ROOM ----------
  .post('/create', async () => {
    const roomId = nanoid();

    await redis.hset(`meta:${roomId}`, {
      connected: [],
      createdAt: Date.now(),
    });

    await redis.expire(`meta:${roomId}`, ROOM_TTL_SECONDS);

    return { roomId };
  })

  .use(authMiddleware)

  // ---------- JOIN ROOM (IMPORTANT) ----------
  .post(
    '/join',
    async ({ auth }) => {
      const key = `meta:${auth.roomId}`;

      const meta = await redis.hgetall<{
        connected: string[];
        createdAt: number;
      }>(key);

      if (!meta) {
        throw new Error('Room does not exist');
      }

      const connected = meta.connected ?? [];

      // already joined → idempotent
      if (connected.includes(auth.token as string)) {
        return { ok: true };
      }

      if (connected.length >= 2) {
        throw new Error('Room full');
      }

      await redis.hset(key, {
        connected: [...connected, auth.token],
      });

      return { ok: true };
    },
    {
      query: z.object({
        roomId: z.string(),
      }),
    },
  )

  // ---------- ROOM TTL ----------
  .get(
    '/ttl',
    async ({ auth }) => {
      const ttl = await redis.ttl(`meta:${auth.roomId}`);
      return { ttl: ttl > 0 ? ttl : 0 };
    },
    { query: z.object({ roomId: z.string() }) },
  )

  // ---------- DESTROY ROOM ----------
  .delete(
    '/',
    async ({ auth }) => {
      await realtime.channel(auth.roomId).emit('chat.destroy', { isDestroyed: true });

      await Promise.all([redis.del(`meta:${auth.roomId}`), redis.del(`messages:${auth.roomId}`)]);
    },
    { query: z.object({ roomId: z.string() }) },
  );

/* ===================== MESSAGES ===================== */

const message = new Elysia({ prefix: '/messages' })
  .use(authMiddleware)

  // ---------- SEND MESSAGE ----------
  .post(
    '/',
    async ({ body, auth }) => {
      const { sender, text } = body;
      const { roomId, token } = auth;

      const meta = await redis.hgetall<{ connected: string[] }>(`meta:${roomId}`);

      if (!meta) {
        throw new Error('Room does not exist');
      }

      if (!meta.connected?.includes(token as string)) {
        throw new Error('User is not joined to the room');
      }

      const message: Message = {
        id: nanoid(),
        sender,
        text,
        timestamp: Date.now(),
        roomId,
      };

      await redis.rpush(`messages:${roomId}`, {
        ...message,
        token,
      });

      await realtime.channel(roomId).emit('chat.message', message);

      // keep TTL in sync
      const remaining = await redis.ttl(`meta:${roomId}`);
      if (remaining > 0) {
        await redis.expire(`messages:${roomId}`, remaining);
      }
    },
    {
      query: z.object({ roomId: z.string() }),
      body: z.object({
        sender: z.string().max(100),
        text: z.string().max(1000),
      }),
    },
  )

  // ---------- GET MESSAGES ----------
  .get(
    '/',
    async ({ auth }) => {
      const messages = await redis.lrange<Message>(`messages:${auth.roomId}`, 0, -1);

      return {
        messages: messages.map((m) => ({
          ...m,
          token: m.token === auth.token ? auth.token : undefined,
        })),
      };
    },
    { query: z.object({ roomId: z.string() }) },
  );

/* ===================== APP ===================== */

const app = new Elysia({ prefix: '/api' }).use(rooms).use(message);

export const GET = app.fetch;
export const POST = app.fetch;
export const DELETE = app.fetch;

export type App = typeof app;
