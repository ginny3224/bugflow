/**
 * BugFlow Worker – Main Entrypoint
 * Starts:
 *   1. HTTP health-check server (GET / → JSON status)
 *   2. Job queue poller (polls Supabase every 2 s)
 *   3. Discord bot gateway (if DISCORD_BOT_TOKEN is set)
 *
 * Handles graceful shutdown on SIGTERM / SIGINT.
 */

import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { Client as DiscordClient, GatewayIntentBits, Events } from 'discord.js';
import pino from 'pino';
import { startPoller, stopPoller, getJobsProcessed } from './queue.js';

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
});

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    log.error({ env_var: name }, 'Required environment variable is not set');
    process.exit(1);
  }
  return value;
}

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const PORT = parseInt(process.env.PORT ?? '8080', 10);
const WORKER_ID = process.env.WORKER_ID ?? `worker-${process.pid}`;

// ---------------------------------------------------------------------------
// Supabase client (service role — bypasses RLS)
// ---------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ---------------------------------------------------------------------------
// HTTP health-check server
// ---------------------------------------------------------------------------

const startTime = Date.now();

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    const body = JSON.stringify({
      status: 'ok',
      worker_id: WORKER_ID,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      jobs_processed: getJobsProcessed(),
    });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

// ---------------------------------------------------------------------------
// Discord bot (optional)
// ---------------------------------------------------------------------------

let discordClient: DiscordClient | null = null;

async function startDiscordBot(token: string): Promise<void> {
  discordClient = new DiscordClient({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  discordClient.once(Events.ClientReady, (client) => {
    log.info({ tag: client.user.tag }, 'Discord bot connected');
  });

  discordClient.on(Events.MessageCreate, async (message) => {
    // Ignore messages from bots (including ourselves)
    if (message.author.bot) return;

    const guildId = message.guildId;
    const channelId = message.channelId;
    const content = message.content?.trim();

    if (!content || !guildId) return;

    log.debug(
      { guild_id: guildId, channel_id: channelId, author: message.author.username },
      'Discord message received',
    );

    // Upsert the integration record keyed on guild ID so the worker can find
    // the correct team when processing the job. The integration must already
    // exist in Supabase — the bot only stores the incoming message here.
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('id, team_id')
      .eq('platform', 'discord')
      .eq('enabled', true)
      // The Discord guild ID is stored in config.guild_id
      .contains('config', { guild_id: guildId })
      .maybeSingle();

    if (intError || !integration) {
      // No matching integration found for this guild; silently ignore
      log.debug({ guild_id: guildId }, 'No active Discord integration found for guild');
      return;
    }

    const typedIntegration = integration as { id: string; team_id: string };

    // Insert the raw message into incoming_messages; the DB trigger will
    // automatically enqueue a classify_message job.
    const { error: insertError } = await supabase.from('incoming_messages').insert({
      team_id: typedIntegration.team_id,
      integration_id: typedIntegration.id,
      platform: 'discord',
      external_id: message.id,
      channel_id: channelId,
      author_name: message.author.username,
      content,
      raw_payload: {
        guild_id: guildId,
        channel_id: channelId,
        message_id: message.id,
        author_id: message.author.id,
        author_username: message.author.username,
        timestamp: message.createdAt.toISOString(),
      },
    });

    if (insertError) {
      // Duplicate messages are expected (UNIQUE constraint on integration_id + external_id)
      if (insertError.code !== '23505') {
        log.error(
          { guild_id: guildId, message_id: message.id, error: insertError.message },
          'Failed to insert Discord incoming_message',
        );
      }
    } else {
      log.info(
        { guild_id: guildId, message_id: message.id, team_id: typedIntegration.team_id },
        'Discord message ingested',
      );
    }
  });

  discordClient.on(Events.Error, (err) => {
    log.error({ error: err.message }, 'Discord client error');
  });

  await discordClient.login(token);
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, 'Shutdown signal received');

  // Stop accepting new connections
  server.close(() => {
    log.info('HTTP server closed');
  });

  // Stop polling new jobs
  stopPoller(log);

  // Disconnect Discord bot
  if (discordClient) {
    discordClient.destroy();
    log.info('Discord client destroyed');
  }

  log.info({ jobs_processed: getJobsProcessed() }, 'Worker shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// ---------------------------------------------------------------------------
// Main bootstrap
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log.info({ worker_id: WORKER_ID, port: PORT }, 'BugFlow worker starting');

  // Start HTTP server
  await new Promise<void>((resolve, reject) => {
    server.listen(PORT, () => {
      log.info({ port: PORT }, 'HTTP health-check server listening');
      resolve();
    });
    server.on('error', reject);
  });

  // Start job queue poller
  startPoller(supabase, { workerId: WORKER_ID }, log);

  // Start Discord bot if token is present
  const discordToken = process.env.DISCORD_BOT_TOKEN;
  if (discordToken) {
    log.info('DISCORD_BOT_TOKEN found; starting Discord gateway bot');
    await startDiscordBot(discordToken);
  } else {
    log.info('DISCORD_BOT_TOKEN not set; skipping Discord bot');
  }

  log.info('BugFlow worker ready');
}

main().catch((err: unknown) => {
  log.error({ error: err instanceof Error ? err.message : String(err) }, 'Fatal startup error');
  process.exit(1);
});
