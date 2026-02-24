'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Shield, UserMinus, Settings2 } from 'lucide-react';
import {
  GlassPanel,
  GlassCard,
  GlassInput,
  GlassButton,
  GlassSelect,
  GlassAvatar,
  GlassBadge,
} from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { TeamMember, TeamSettings } from '@/app/(dashboard)/settings/team/page';

interface TeamSettingsPageProps {
  team: TeamSettings;
  members: TeamMember[];
  currentUserId: string;
  currentUserRole: 'owner' | 'admin' | 'member';
}

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
];

const DIGEST_DAY_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const DIGEST_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: `${i.toString().padStart(2, '0')}:00`,
}));

function roleBadgeVariant(role: string): 'info' | 'medium' | 'default' {
  if (role === 'owner') return 'info';
  if (role === 'admin') return 'medium';
  return 'default';
}

export function TeamSettingsPage({
  team,
  members,
  currentUserId,
  currentUserRole,
}: TeamSettingsPageProps) {
  const [memberList, setMemberList] = useState<TeamMember[]>(members);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);

  // Team config state
  const [confidenceThreshold, setConfidenceThreshold] = useState(
    String(team.confidence_threshold ?? 0.7),
  );
  const [spikeThreshold, setSpikeThreshold] = useState(
    String(team.spike_threshold ?? 5),
  );
  const [digestDay, setDigestDay] = useState(String(team.digest_day ?? 1));
  const [digestHour, setDigestHour] = useState(String(team.digest_hour ?? 9));
  const [savingConfig, setSavingConfig] = useState(false);

  const isOwnerOrAdmin = currentUserRole === 'owner' || currentUserRole === 'admin';

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Failed to send invite');
      }

      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      toast.error('Failed to remove member');
    } else {
      setMemberList((prev) => prev.filter((m) => m.id !== memberId));
      toast.success('Member removed');
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingConfig(true);

    const supabase = createClient();
    const { error } = await supabase
      .from('teams')
      .update({
        confidence_threshold: parseFloat(confidenceThreshold),
        spike_threshold: parseInt(spikeThreshold, 10),
        digest_day: parseInt(digestDay, 10),
        digest_hour: parseInt(digestHour, 10),
      })
      .eq('id', team.id);

    if (error) {
      toast.error('Failed to save settings');
    } else {
      toast.success('Settings saved');
    }

    setSavingConfig(false);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Members list */}
      <GlassPanel
        title="Team Members"
        actions={
          <span
            className="text-xs"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            {memberList.length} member{memberList.length !== 1 ? 's' : ''}
          </span>
        }
      >
        <div className="space-y-3">
          {memberList.map((member) => {
            const displayName = member.email?.split('@')[0] ?? member.user_id.slice(0, 8);
            const isSelf = member.user_id === currentUserId;
            const isOwner = member.role === 'owner';

            return (
              <motion.div
                key={member.id}
                layout
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <GlassAvatar name={displayName} size="sm" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: 'rgba(255,255,255,0.85)' }}
                    >
                      {displayName}
                      {isSelf && (
                        <span
                          className="ml-1.5 text-xs"
                          style={{ color: 'rgba(255,255,255,0.35)' }}
                        >
                          (you)
                        </span>
                      )}
                    </p>
                  </div>
                  {member.email && (
                    <p
                      className="text-xs truncate"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                    >
                      {member.email}
                    </p>
                  )}
                </div>

                <GlassBadge variant={roleBadgeVariant(member.role)}>
                  <Shield size={10} />
                  {member.role}
                </GlassBadge>

                {isOwnerOrAdmin && !isSelf && !isOwner && (
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(member.id)}
                    className="shrink-0"
                  >
                    <UserMinus size={13} />
                  </GlassButton>
                )}
              </motion.div>
            );
          })}
        </div>
      </GlassPanel>

      {/* Invite form */}
      {isOwnerOrAdmin && (
        <GlassPanel title="Invite Member">
          <form onSubmit={handleInvite} className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-48">
              <GlassInput
                label="Email address"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="w-36">
              <GlassSelect
                label="Role"
                options={ROLE_OPTIONS}
                value={inviteRole}
                onChange={setInviteRole}
              />
            </div>
            <GlassButton
              type="submit"
              variant="primary"
              loading={inviting}
              disabled={!inviteEmail.trim()}
            >
              <Mail size={14} />
              Send Invite
            </GlassButton>
          </form>
        </GlassPanel>
      )}

      {/* Team configuration */}
      <GlassPanel
        title="Configuration"
        actions={
          <Settings2 size={15} style={{ color: 'rgba(255,255,255,0.35)' }} />
        }
      >
        <form onSubmit={handleSaveConfig} className="space-y-6">
          {/* Thresholds */}
          <div className="space-y-4">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              AI Thresholds
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <GlassInput
                  label="Confidence Threshold"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(e.target.value)}
                />
                <p
                  className="text-xs"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  Minimum AI confidence to auto-classify a bug (0–1)
                </p>
              </div>

              <div className="space-y-2">
                <GlassInput
                  label="Spike Threshold"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={spikeThreshold}
                  onChange={(e) => setSpikeThreshold(e.target.value)}
                />
                <p
                  className="text-xs"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  Number of bugs per hour to trigger a spike alert
                </p>
              </div>
            </div>
          </div>

          {/* Digest schedule */}
          <div className="space-y-4">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Weekly Digest Schedule
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <GlassSelect
                label="Digest Day"
                options={DIGEST_DAY_OPTIONS}
                value={digestDay}
                onChange={setDigestDay}
              />
              <GlassSelect
                label="Digest Hour (UTC)"
                options={DIGEST_HOUR_OPTIONS}
                value={digestHour}
                onChange={setDigestHour}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <GlassButton
              type="submit"
              variant="primary"
              loading={savingConfig}
              disabled={!isOwnerOrAdmin}
            >
              Save Settings
            </GlassButton>
          </div>
        </form>
      </GlassPanel>
    </div>
  );
}
