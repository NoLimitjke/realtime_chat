'use client';

import { createRealtime } from '@upstash/realtime/client';
import type { RealTimeEvents } from './realtime';

export const { useRealtime } = createRealtime<RealTimeEvents>();
