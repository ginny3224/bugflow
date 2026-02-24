'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import {
  GlassModal,
  GlassInput,
  GlassButton,
  GlassSelect,
  PlatformIcon,
  platformName,
} from '@/components/ui';
import { toast } from 'sonner';

type Platform = 'slack' | 'discord' | 'intercom' | 'telegram' | 'monday';

interface ChannelOption {
  id: string;
  name: string;
}

interface SetupWizardProps {
  platform: Platform;
  teamId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PLATFORM_CONFIG: Record<
  Platform,
  {
    label: string;
    step1Fields: { key: string; label: string; placeholder: string; type?: string }[];
    hasChannelStep: boolean;
  }
> = {
  slack: {
    label: 'Slack',
    step1Fields: [
      { key: 'bot_token', label: 'Bot Token', placeholder: 'xoxb-...' },
      { key: 'signing_secret', label: 'Signing Secret', placeholder: 'Slack signing secret' },
    ],
    hasChannelStep: true,
  },
  discord: {
    label: 'Discord',
    step1Fields: [
      { key: 'bot_token', label: 'Bot Token', placeholder: 'Discord bot token' },
      { key: 'server_id', label: 'Server ID', placeholder: 'Discord server (guild) ID' },
    ],
    hasChannelStep: true,
  },
  intercom: {
    label: 'Intercom',
    step1Fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'Intercom access token' },
      { key: 'webhook_secret', label: 'Webhook Secret', placeholder: 'Webhook secret (optional)' },
    ],
    hasChannelStep: false,
  },
  telegram: {
    label: 'Telegram',
    step1Fields: [
      { key: 'bot_token', label: 'Bot Token', placeholder: 'Telegram bot token from @BotFather' },
    ],
    hasChannelStep: false,
  },
  monday: {
    label: 'Monday.com',
    step1Fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Monday.com API key (v2)' },
      { key: 'board_id', label: 'Board ID', placeholder: 'Target board ID for bug items' },
    ],
    hasChannelStep: false,
  },
};

const TOTAL_STEPS = 3;

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;

        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-all duration-200"
              style={{
                background: done
                  ? 'rgba(48,209,88,0.2)'
                  : active
                  ? 'rgba(10,132,255,0.25)'
                  : 'rgba(255,255,255,0.06)',
                border: done
                  ? '1px solid rgba(48,209,88,0.4)'
                  : active
                  ? '1px solid rgba(10,132,255,0.5)'
                  : '1px solid rgba(255,255,255,0.1)',
                color: done ? '#30d158' : active ? '#0a84ff' : 'rgba(255,255,255,0.3)',
              }}
            >
              {done ? <Check size={12} /> : step}
            </div>
            {i < total - 1 && (
              <div
                className="w-8 h-px"
                style={{
                  background: done
                    ? 'rgba(48,209,88,0.4)'
                    : 'rgba(255,255,255,0.1)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SetupWizard({
  platform,
  teamId,
  isOpen,
  onClose,
  onSuccess,
}: SetupWizardProps) {
  const config = PLATFORM_CONFIG[platform];
  const totalSteps = config.hasChannelStep ? TOTAL_STEPS : 2;

  const [step, setStep] = useState(1);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [availableChannels] = useState<ChannelOption[]>([]);
  const [loading, setLoading] = useState(false);

  function handleCredentialChange(key: string, value: string) {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  }

  function canProceedStep1(): boolean {
    return config.step1Fields
      .filter((f) => !f.label.includes('optional'))
      .every((f) => credentials[f.key]?.trim());
  }

  async function handleNext() {
    if (step === 1) {
      if (config.hasChannelStep) {
        setStep(2);
      } else {
        await handleSave();
      }
    } else if (step === 2 && config.hasChannelStep) {
      await handleSave();
    }
  }

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          platform,
          credentials,
          channels: selectedChannels,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Failed to save integration');
      }

      setStep(config.hasChannelStep ? TOTAL_STEPS : 2);
      setTimeout(() => {
        toast.success(`${platformName(platform)} connected successfully`);
        onSuccess();
        handleClose();
      }, 800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setStep(1);
    setCredentials({});
    setSelectedChannels([]);
    onClose();
  }

  const isLastStep = config.hasChannelStep ? step === 2 : step === 1;

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <span className="inline-flex items-center gap-2">
          <PlatformIcon platform={platform} size={20} />
          Connect {platformName(platform)}
        </span>
      }
      className="max-w-md"
    >
      <div className="space-y-6">
        {/* Step indicator */}
        <StepIndicator current={step} total={totalSteps} />

        <AnimatePresence mode="wait">
          {/* Step 1: Credentials */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div>
                <p
                  className="text-sm font-medium mb-1"
                  style={{ color: 'rgba(255,255,255,0.85)' }}
                >
                  Enter your {platformName(platform)} credentials
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  Your credentials are encrypted and stored securely.
                </p>
              </div>

              {config.step1Fields.map((field) => (
                <GlassInput
                  key={field.key}
                  label={field.label}
                  placeholder={field.placeholder}
                  type={field.type ?? 'text'}
                  value={credentials[field.key] ?? ''}
                  onChange={(e) => handleCredentialChange(field.key, e.target.value)}
                />
              ))}
            </motion.div>
          )}

          {/* Step 2: Channel selection (Slack/Discord only) */}
          {step === 2 && config.hasChannelStep && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div>
                <p
                  className="text-sm font-medium mb-1"
                  style={{ color: 'rgba(255,255,255,0.85)' }}
                >
                  Select channels to monitor
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  BugFlow will listen for bug reports in these channels. You can update this later.
                </p>
              </div>

              {availableChannels.length === 0 ? (
                <div
                  className="p-4 rounded-xl text-center"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <p
                    className="text-sm"
                    style={{ color: 'rgba(255,255,255,0.5)' }}
                  >
                    All channels will be monitored by default. You can refine this in settings after connecting.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableChannels.map((ch) => {
                    const checked = selectedChannels.includes(ch.id);
                    return (
                      <label
                        key={ch.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors"
                        style={{
                          background: checked
                            ? 'rgba(10,132,255,0.1)'
                            : 'rgba(255,255,255,0.03)',
                          border: checked
                            ? '1px solid rgba(10,132,255,0.25)'
                            : '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedChannels((prev) => [...prev, ch.id]);
                            } else {
                              setSelectedChannels((prev) =>
                                prev.filter((id) => id !== ch.id),
                              );
                            }
                          }}
                          className="sr-only"
                        />
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                          style={{
                            background: checked
                              ? 'rgba(10,132,255,0.4)'
                              : 'rgba(255,255,255,0.06)',
                            border: checked
                              ? '1px solid rgba(10,132,255,0.6)'
                              : '1px solid rgba(255,255,255,0.15)',
                          }}
                        >
                          {checked && <Check size={10} style={{ color: '#fff' }} />}
                        </div>
                        <span
                          className="text-sm"
                          style={{ color: 'rgba(255,255,255,0.8)' }}
                        >
                          # {ch.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Step 3: Success */}
          {step === TOTAL_STEPS && (
            <motion.div
              key="step-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-4 py-4"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(48,209,88,0.15)',
                  border: '1px solid rgba(48,209,88,0.3)',
                }}
              >
                <Check size={24} style={{ color: '#30d158' }} />
              </div>
              <div className="text-center">
                <p
                  className="text-base font-semibold"
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                >
                  {platformName(platform)} connected!
                </p>
                <p
                  className="text-sm mt-1"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  BugFlow is now monitoring your {platformName(platform)} messages.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        {step < TOTAL_STEPS && (
          <div className="flex items-center justify-between pt-2">
            {step > 1 ? (
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
                disabled={loading}
              >
                Back
              </GlassButton>
            ) : (
              <div />
            )}
            <GlassButton
              variant="primary"
              size="sm"
              loading={loading}
              disabled={step === 1 && !canProceedStep1()}
              onClick={handleNext}
            >
              {isLastStep ? 'Connect' : 'Continue'}
              {!isLastStep && <ChevronRight size={14} />}
            </GlassButton>
          </div>
        )}
      </div>
    </GlassModal>
  );
}
