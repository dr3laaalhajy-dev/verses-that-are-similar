import type { VercelRequest, VercelResponse } from '@vercel/node';
import cronWirdHandler from './_lib/cronWird.js';
import cronFridayHandler from './_lib/cronFriday.js';
import cronAdhkarHandler from './_lib/cronAdhkar.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const job = (req.query.job as string) || (req.query.action as string) || '';

  if (job === 'wird' || job === 'cron-wird') {
    return cronWirdHandler(req, res);
  }

  if (job === 'friday' || job === 'cron-friday') {
    return cronFridayHandler(req, res);
  }

  if (job === 'adhkar' || job === 'cron-adhkar') {
    return cronAdhkarHandler(req, res);
  }

  return res.status(400).json({
    success: false,
    message: 'Unknown cron job. Specify ?job=wird, ?job=friday, or ?job=adhkar'
  });
}

