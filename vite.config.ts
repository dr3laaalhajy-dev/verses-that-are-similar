import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: '.env', override: false });


function apiServerPlugin(): Plugin {
  return {
    name: 'api-server-plugin',
    configureServer(server) {
      server.middlewares.use(async (req: any, res: any, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        try {
          const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          const pathname = urlObj.pathname;

          req.query = {};
          urlObj.searchParams.forEach((val, key) => {
            req.query[key] = val;
          });

          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            const buffers = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const data = Buffer.concat(buffers).toString();
            try {
              req.body = data ? JSON.parse(data) : {};
            } catch {
              req.body = data;
            }
          } else {
            req.body = req.body || {};
          }

          res.status = (statusCode: number) => {
            res.statusCode = statusCode;
            return res;
          };
          res.json = (data: any) => {
            if (!res.getHeader('Content-Type')) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
            res.end(JSON.stringify(data));
            return res;
          };
          res.send = (data: any) => {
            res.end(data);
            return res;
          };

          let relativePath = '';
          if (pathname === '/api/1v1') relativePath = 'api/1v1.ts';
          else if (pathname === '/api/leaderboard') relativePath = 'api/leaderboard.ts';
          else if (pathname === '/api/player-register') relativePath = 'api/player-register.ts';
          else if (pathname === '/api/player-score') relativePath = 'api/player-score.ts';
          else if (pathname === '/api/admin') relativePath = 'api/admin/index.ts';
          else if (pathname === '/api/settings') relativePath = 'api/settings.ts';
          else if (pathname === '/api/challenges') relativePath = 'api/challenges/index.ts';
          else if (pathname.startsWith('/api/challenges/')) {
            const id = pathname.replace('/api/challenges/', '');
            req.query.id = id;
            relativePath = 'api/challenges/[id].ts';
          }

          if (!relativePath) {
            res.status(404).json({ error: 'API route not found' });
            return;
          }

          const fullPath = path.resolve(__dirname, relativePath);
          const mod = await server.ssrLoadModule(fullPath);
          const handler = mod.default || mod;
          await handler(req, res);
        } catch (err: any) {
          console.error('API Error:', err);
          if (!res.writableEnded) {
            res.status(500).json({ message: 'Internal Server Error', error: err.message });
          }
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), apiServerPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      headers: {
        'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self)',
      },
    },
    preview: {
      headers: {
        'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self)',
      },
    },
  };
});
