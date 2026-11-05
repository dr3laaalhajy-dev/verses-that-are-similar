import type { VercelRequest, VercelResponse } from '@vercel/node';
import sendHandler from '../_lib/sendNotification.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return await sendHandler(req, res);
}

