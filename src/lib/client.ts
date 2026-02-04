import { treaty } from '@elysiajs/eden';
import type { App } from '@/app/api/[...slugs]/route';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL не задан в .env');
}

export const client = treaty<App>(API_URL).api;
