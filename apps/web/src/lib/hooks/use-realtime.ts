'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface BugReport {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending_review' | 'approved' | 'rejected' | 'merged' | 'created_in_monday';
  review_status?: string;
  category: string | null;
  steps_to_reproduce: string | null;
  confidence_score: number | null;
  source_channel: string | null;
  dedup_match_id: string | null;
  dedup_score: number | null;
  consolidated_summary: string | null;
  monday_item_id: string | null;
  report_count: number;
  source_message_ids?: string[];
  created_at: string;
  updated_at: string;
  // Match details for deduplication
  match_details?: {
    type: 'monday' | 'bug_report';
    title: string;
    description?: string | null;
    monday_board_id?: string;
  } | null;
}

export interface IncomingMessage {
  id: string;
  team_id: string;
  channel_type: string;
  channel_id: string;
  sender_name: string | null;
  content: string;
  bug_report_id: string | null;
  processed: boolean;
  created_at: string;
}

export interface TrendAlert {
  id: string;
  team_id: string;
  alert_type: string;
  severity: string;
  message: string;
  metadata: Record<string, unknown>;
  acknowledged: boolean;
  created_at: string;
}

export function useRealtimeBugs(teamId: string) {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBugs = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('bug_reports')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setBugs(data as BugReport[]);
    }
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchBugs();

    const supabase = createClient();
    let channel: RealtimeChannel;

    channel = supabase
      .channel(`bugs:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bug_reports',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setBugs((prev) => [payload.new as BugReport, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setBugs((prev) =>
              prev.map((b) =>
                b.id === (payload.new as BugReport).id
                  ? (payload.new as BugReport)
                  : b,
              ),
            );
          } else if (payload.eventType === 'DELETE') {
            setBugs((prev) =>
              prev.filter((b) => b.id !== (payload.old as { id: string }).id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, fetchBugs]);

  return { bugs, loading, refetch: fetchBugs };
}

export function useRealtimeQueue(teamId: string) {
  const [queue, setQueue] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('bug_reports')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Fetch match details for bugs with dedup_match_id
      const bugsWithMatches = await Promise.all(
        data.map(async (bug: any) => {
          if (!bug.dedup_match_id) {
            return bug;
          }

          // Try to find match in bug_reports first
          const { data: bugMatch } = await supabase
            .from('bug_reports')
            .select('id, title, description')
            .eq('id', bug.dedup_match_id)
            .single();

          if (bugMatch) {
            return {
              ...bug,
              match_details: {
                type: 'bug_report' as const,
                title: bugMatch.title,
                description: bugMatch.description,
              },
            };
          }

          // If not found in bug_reports, try monday_backlog_items
          const { data: mondayMatch } = await supabase
            .from('monday_backlog_items')
            .select('id, name, description, monday_board_id')
            .eq('id', bug.dedup_match_id)
            .single();

          if (mondayMatch) {
            return {
              ...bug,
              match_details: {
                type: 'monday' as const,
                title: mondayMatch.name,
                description: mondayMatch.description,
                monday_board_id: mondayMatch.monday_board_id,
              },
            };
          }

          return bug;
        })
      );

      setQueue(bugsWithMatches as BugReport[]);
    }
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchQueue();

    const supabase = createClient();
    let channel: RealtimeChannel;

    channel = supabase
      .channel(`queue:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bug_reports',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newBug = payload.new as BugReport;
            if (newBug.status === 'pending_review') {
              setQueue((prev) => [newBug, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as BugReport;
            if (updated.status === 'pending_review') {
              setQueue((prev) => {
                const exists = prev.find((b) => b.id === updated.id);
                if (exists) {
                  return prev.map((b) => (b.id === updated.id ? updated : b));
                }
                return [updated, ...prev];
              });
            } else {
              // Removed from queue
              setQueue((prev) => prev.filter((b) => b.id !== updated.id));
            }
          } else if (payload.eventType === 'DELETE') {
            setQueue((prev) =>
              prev.filter((b) => b.id !== (payload.old as { id: string }).id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, fetchQueue]);

  return { queue, loading, refetch: fetchQueue };
}

export function useRealtimeMessages(teamId: string) {
  const [messages, setMessages] = useState<IncomingMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('incoming_messages')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setMessages(data as IncomingMessage[]);
    }
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchMessages();

    const supabase = createClient();
    let channel: RealtimeChannel;

    channel = supabase
      .channel(`messages:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incoming_messages',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => [payload.new as IncomingMessage, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === (payload.new as IncomingMessage).id
                  ? (payload.new as IncomingMessage)
                  : m,
              ),
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) =>
              prev.filter(
                (m) => m.id !== (payload.old as { id: string }).id,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, fetchMessages]);

  return { messages, loading, refetch: fetchMessages };
}

export function useRealtimeAlerts(teamId: string) {
  const [alerts, setAlerts] = useState<TrendAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('trend_alerts')
      .select('*')
      .eq('team_id', teamId)
      .eq('acknowledged', false)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAlerts(data as TrendAlert[]);
    }
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchAlerts();

    const supabase = createClient();
    let channel: RealtimeChannel;

    channel = supabase
      .channel(`alerts:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trend_alerts',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAlerts((prev) => [payload.new as TrendAlert, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as TrendAlert;
            if (updated.acknowledged) {
              setAlerts((prev) => prev.filter((a) => a.id !== updated.id));
            } else {
              setAlerts((prev) =>
                prev.map((a) => (a.id === updated.id ? updated : a)),
              );
            }
          } else if (payload.eventType === 'DELETE') {
            setAlerts((prev) =>
              prev.filter(
                (a) => a.id !== (payload.old as { id: string }).id,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, fetchAlerts]);

  return { alerts, loading, refetch: fetchAlerts };
}
