/**
 * BugFlow Worker – Claude AI Client
 * Thin wrapper around @anthropic-ai/sdk exposing typed helper functions
 * for each step of the bug-triage pipeline.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  classificationResultSchema,
  bugExtractionResultSchema,
  dedupResultSchema,
  type ClassificationResult,
  type BugExtractionResult,
  type DedupResult,
} from '@bugflow/shared';
import {
  CLASSIFY_SYSTEM_PROMPT,
  EXTRACT_SYSTEM_PROMPT,
  DEDUP_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
  DIGEST_SYSTEM_PROMPT,
} from './prompts.js';

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Call Claude with a system prompt and user content, returning raw text.
 */
async function callClaude(systemPrompt: string, userContent: string): Promise<string> {
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const block = message.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('Claude returned an unexpected response shape');
  }
  return block.text.trim();
}

/**
 * Call Claude and parse the response as JSON, then validate with a Zod schema.
 */
async function callClaudeJson<T>(
  systemPrompt: string,
  userContent: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const raw = await callClaude(systemPrompt, userContent);

  // Strip markdown code fences if the model wraps the JSON despite instructions
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Claude returned non-JSON text: ${cleaned.slice(0, 200)}`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Claude response failed validation: ${result.error.message}\nRaw: ${cleaned.slice(0, 500)}`,
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determine whether a message describes a software bug.
 */
export async function classifyMessage(content: string): Promise<ClassificationResult> {
  return callClaudeJson(
    CLASSIFY_SYSTEM_PROMPT,
    `Message to classify:\n\n${content}`,
    classificationResultSchema,
  );
}

/**
 * Extract structured bug data from a raw message that has been classified as a bug.
 */
export async function extractBugData(content: string): Promise<BugExtractionResult> {
  return callClaudeJson(
    EXTRACT_SYSTEM_PROMPT,
    `Bug report message:\n\n${content}`,
    bugExtractionResultSchema,
  );
}

export interface DedupCandidate {
  id: string;
  name: string;
  description: string | null;
}

/**
 * Compare a new bug against candidate existing bugs to detect duplicates.
 */
export async function checkDuplicate(
  bugTitle: string,
  bugDescription: string,
  candidates: DedupCandidate[],
): Promise<DedupResult> {
  const candidateBlock = candidates
    .map(
      (c, i) =>
        `[${i + 1}] ID: ${c.id}\n    Title: ${c.name}\n    Description: ${c.description ?? '(none)'}`,
    )
    .join('\n\n');

  const userContent = [
    'New bug report:',
    `Title: ${bugTitle}`,
    `Description: ${bugDescription}`,
    '',
    'Candidate existing bugs:',
    candidateBlock,
  ].join('\n');

  return callClaudeJson(DEDUP_SYSTEM_PROMPT, userContent, dedupResultSchema);
}

export interface ReportInput {
  title: string;
  description: string;
  source: string;
}

/**
 * Consolidate multiple bug reports about the same issue into a single summary.
 */
export async function generateSummary(reports: ReportInput[]): Promise<string> {
  const reportsBlock = reports
    .map(
      (r, i) =>
        `Report ${i + 1} (source: ${r.source}):\nTitle: ${r.title}\nDescription: ${r.description}`,
    )
    .join('\n\n---\n\n');

  const userContent = `Please consolidate these ${reports.length} bug report(s):\n\n${reportsBlock}`;
  return callClaude(SUMMARY_SYSTEM_PROMPT, userContent);
}

/**
 * Generate a weekly markdown digest from aggregated bug statistics and trends.
 */
export async function generateDigest(
  stats: Record<string, unknown>,
  trends: Record<string, unknown>[],
  topBugs: Record<string, unknown>[],
): Promise<string> {
  const userContent = [
    'Stats:',
    JSON.stringify(stats, null, 2),
    '',
    'Trends & Alerts:',
    JSON.stringify(trends, null, 2),
    '',
    'Top Bug Reports:',
    JSON.stringify(topBugs, null, 2),
  ].join('\n');

  return callClaude(DIGEST_SYSTEM_PROMPT, userContent);
}
