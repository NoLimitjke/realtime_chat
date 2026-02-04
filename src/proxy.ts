import { NextRequest, NextResponse } from 'next/server';
import { redis } from './lib/redis';
import { nanoid } from 'nanoid';

export const proxy = async (req: NextRequest) => {
  const { pathname } = req.nextUrl;

  const match = pathname.match(/^\/room\/([^/]+)$/);
  if (!match) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const roomId = match[1];

  // 1️⃣ Проверяем, существует ли комната
  const exists = await redis.exists(`meta:${roomId}`);
  if (!exists) {
    return NextResponse.redirect(new URL('/?error=room-not-found', req.url));
  }

  // 2️⃣ Проверяем, есть ли токен
  const token = req.cookies.get('x-auth-token')?.value;
  if (token) {
    return NextResponse.next();
  }

  // 3️⃣ Если токена нет — просто выдаём его
  const response = NextResponse.next();

  response.cookies.set('x-auth-token', nanoid(), {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  return response;
};

export const config = {
  matcher: '/room/:path*',
};
