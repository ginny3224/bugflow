'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plug, CheckCircle, XCircle, Settings } from 'lucide-react';
import { GlassCard, GlassBadge, GlassButton, PlatformIcon, platformName, platformColor } from '@/components/ui';
import { SetupWizard } from './setup-wizard';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

type Platform = 'slack' | 'discord' | 'intercom' | 'telegram' | 'monday' | 'x';

interface Integration {
  id: string;
  platform: Platform;
  enabled: boolean;
  created_at: string;
  config_summary?: string;
}

interface IntegrationsPageProps {
  teamId: string;
  initialIntegrations: Integration[];
}

const PLATFORM_META: Record<
  Platform,
  {
    description: string;
  }
> = {
  slack: {
    description: 'Monitor Slack channels for bug reports and user feedback',
  },
  discord: {
    description: 'Aggregate bug reports from your Discord server channels',
  },
  intercom: {
    description: 'Process customer support conversations for bug signals',
  },
  telegram: {
    description: 'Connect Telegram groups or channels as bug report sources',
  },
  monday: {
    description: 'Create bug items directly in your Monday.com boards',
  },
  x: {
    description: 'Monitor X (Twitter) mentions and DMs for bug reports',
  },
};

const ALL_PLATFORMS: Platform[] = ['slack', 'discord', 'intercom', 'telegram', 'monday', 'x'];

interface IntegrationCardProps {
  platform: Platform;
  integration: Integration | null;
  teamId: string;
  onConnect: (platform: Platform) => void;
  onToggle: (integration: Integration) => Promise<void>;
}

function IntegrationCard({
  platform,
  integration,
  onConnect,
  onToggle,
}: IntegrationCardProps) {
  const meta = PLATFORM_META[platform];
  const connected = integration !== null;
  const [toggling, setToggling] = useState(false);
  const accentColor = platformColor(platform);

  async function handleToggle() {
    if (!integration) return;
    setToggling(true);
    await onToggle(integration);
    setToggling(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <GlassCard className="p-5 h-full flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: `${accentColor}20`,
              border: `1px solid ${accentColor}30`,
            }}
          >
            <PlatformIcon platform={platform} size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p
                className="text-sm font-semibold"
                style={{ color: 'rgba(255,255,255,0.9)' }}
              >
                {platformName(platform)}
              </p>
              {connected && (
                <GlassBadge variant={integration?.enabled ? 'low' : 'default'}>
                  {integration?.enabled ? 'Active' : 'Paused'}
                </GlassBadge>
              )}
            </div>
            <p
              className="text-xs mt-0.5 leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              {meta.description}
            </p>
          </div>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2">
          {connected ? (
            <CheckCircle size={14} style={{ color: '#30d158' }} />
          ) : (
            <XCircle size={14} style={{ color: 'rgba(255,255,255,0.25)' }} />
          )}
          <span
            className="text-xs"
            style={{
              color: connected ? '#30d158' : 'rgba(255,255,255,0.35)',
            }}
          >
            {connected ? 'Connected' : 'Not connected'}
          </span>
        </div>

        {/* Config summary */}
        {connected && integration?.config_summary && (
          <p
            className="text-xs px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            {integration.config_summary}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-2">
          {connected ? (
            <>
              <GlassButton
                size="sm"
                variant="ghost"
                loading={toggling}
                onClick={handleToggle}
              >
                {integration?.enabled ? 'Pause' : 'Resume'}
              </GlassButton>
              <GlassButton
                size="sm"
                variant="ghost"
                onClick={() => onConnect(platform)}
              >
                <Settings size={12} />
                Reconfigure
              </GlassButton>
            </>
          ) : (
            <GlassButton
              size="sm"
              variant="primary"
              onClick={() => onConnect(platform)}
            >
              <Plug size={12} />
              Connect
            </GlassButton>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}

export function IntegrationsPage({ teamId, initialIntegrations }: IntegrationsPageProps) {
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [wizardPlatform, setWizardPlatform] = useState<Platform | null>(null);

  function getIntegration(platform: Platform): Integration | null {
    return integrations.find((i) => i.platform === platform) ?? null;
  }

  async function handleToggle(integration: Integration) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('integrations')
      .update({ enabled: !integration.enabled })
      .eq('id', integration.id)
      .select()
      .single();

    if (error) {
      toast.error('Failed to update integration');
    } else {
      setIntegrations((prev) =>
        prev.map((i) => (i.id === integration.id ? (data as Integration) : i)),
      );
      toast.success(
        !integration.enabled ? 'Integration resumed' : 'Integration paused',
      );
    }
  }

  function handleWizardSuccess() {
    // Refresh integrations list
    const supabase = createClient();
    supabase
      .from('integrations')
      .select('*')
      .eq('team_id', teamId)
      .then(({ data }) => {
        if (data) setIntegrations(data as Integration[]);
      });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {ALL_PLATFORMS.map((platform, i) => (
          <motion.div
            key={platform}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.07 }}
          >
            <IntegrationCard
              platform={platform}
              integration={getIntegration(platform)}
              teamId={teamId}
              onConnect={(p) => setWizardPlatform(p)}
              onToggle={handleToggle}
            />
          </motion.div>
        ))}
      </div>

      {wizardPlatform && (
        <SetupWizard
          platform={wizardPlatform}
          teamId={teamId}
          isOpen={true}
          onClose={() => setWizardPlatform(null)}
          onSuccess={handleWizardSuccess}
        />
      )}
    </div>
  );
}
