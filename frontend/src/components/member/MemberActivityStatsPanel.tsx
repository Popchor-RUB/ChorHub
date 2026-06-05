import { useEffect, useMemo, useState } from 'react';
import { Button, Chip, Select, SelectItem, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { adminMembersApi, rehearsalsApi } from '../../services/api';
import type { MemberActivityStats, Rehearsal } from '../../types';
import { useDateLocale } from '../../hooks/useDateLocale';
import { formatDateNumeric } from '../../utils/dateFormatting';
import { adminSelectClassNames } from '../../styles/adminFormStyles';

const DEFAULT_SELECTION_COUNT = 5;
const QUICK_SELECTION_COUNTS = [3, 5];

function getStartOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value);
}

export function MemberActivityStatsPanel() {
  const [pastRehearsals, setPastRehearsals] = useState<Rehearsal[]>([]);
  const [selectedRehearsalIds, setSelectedRehearsalIds] = useState<string[]>([]);
  const [stats, setStats] = useState<MemberActivityStats | null>(null);
  const [loadingRehearsals, setLoadingRehearsals] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const { t, i18n } = useTranslation();
  const dateLocale = useDateLocale();
  const numberLocale = i18n.language || dateLocale;

  useEffect(() => {
    let isMounted = true;
    rehearsalsApi.getAll()
      .then((res) => {
        if (!isMounted) return;
        const startOfToday = getStartOfToday();
        const mandatoryPastRehearsals = (res.data as Rehearsal[])
          .filter((rehearsal) => !rehearsal.isOptional && new Date(rehearsal.date) < startOfToday)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPastRehearsals(mandatoryPastRehearsals);
        setSelectedRehearsalIds(
          mandatoryPastRehearsals.slice(0, DEFAULT_SELECTION_COUNT).map((rehearsal) => rehearsal.id),
        );
      })
      .catch(() => {
        if (isMounted) setLoadError(true);
      })
      .finally(() => {
        if (isMounted) setLoadingRehearsals(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    adminMembersApi.activityStats(selectedRehearsalIds)
      .then((res) => {
        if (isMounted) {
          setStats(res.data);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStats(null);
          setLoadError(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRehearsalIds]);

  const selectedKeys = useMemo(() => new Set(selectedRehearsalIds), [selectedRehearsalIds]);

  const selectLatest = (count: number) => {
    setSelectedRehearsalIds(pastRehearsals.slice(0, count).map((rehearsal) => rehearsal.id));
  };

  const metricItems = [
    {
      label: t('members.activity_active_members'),
      value: stats ? `${stats.activeMemberCount} / ${stats.memberCountTotal}` : '—',
    },
    {
      label: t('members.activity_active_rate'),
      value: stats ? formatPercent(stats.activeRate, numberLocale) : '—',
    },
    {
      label: t('members.activity_average_attendance'),
      value: stats ? formatNumber(stats.averageAttendancePerRehearsal, numberLocale) : '—',
    },
    {
      label: t('members.activity_inactive_members'),
      value: stats ? stats.inactiveMemberCount.toString() : '—',
    },
  ];

  return (
    <section className="rounded-lg border border-default-200 bg-content1 p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{t('members.activity_title')}</h2>
            <p className="text-sm text-default-500">{t('members.activity_description')}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Select
              aria-label={t('members.activity_rehearsals_label')}
              label={t('members.activity_rehearsals_label')}
              selectionMode="multiple"
              selectedKeys={selectedKeys}
              className="min-w-72"
              classNames={adminSelectClassNames}
              isDisabled={loadingRehearsals || pastRehearsals.length === 0}
              placeholder={t('members.activity_rehearsals_placeholder')}
              renderValue={(items) => t('members.activity_rehearsals_selected', { count: items.length })}
              onSelectionChange={(keys) => {
                if (keys === 'all') {
                  setSelectedRehearsalIds(pastRehearsals.map((rehearsal) => rehearsal.id));
                  return;
                }
                setSelectedRehearsalIds(Array.from(keys).map(String));
              }}
            >
              {pastRehearsals.map((rehearsal) => (
                <SelectItem
                  key={rehearsal.id}
                  textValue={`${formatDateNumeric(rehearsal.date, dateLocale)} - ${rehearsal.title}`}
                >
                  {formatDateNumeric(rehearsal.date, dateLocale)} - {rehearsal.title}
                </SelectItem>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              {QUICK_SELECTION_COUNTS.map((count) => (
                <Button
                  key={count}
                  size="sm"
                  variant={selectedRehearsalIds.length === count ? 'solid' : 'flat'}
                  color={selectedRehearsalIds.length === count ? 'primary' : 'default'}
                  isDisabled={pastRehearsals.length === 0}
                  onPress={() => selectLatest(count)}
                >
                  {t('members.activity_latest_count', { count })}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {loadingRehearsals ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : pastRehearsals.length === 0 ? (
          <p className="text-sm text-default-500">{t('members.activity_no_rehearsals')}</p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {metricItems.map((item) => (
                <div key={item.label} className="rounded-md border border-default-200 px-3 py-2">
                  <p className="text-xs uppercase text-default-500">{item.label}</p>
                  <p className="text-2xl font-semibold">{item.value}</p>
                </div>
              ))}
            </div>

            {loadError ? (
              <p className="text-sm text-danger">{t('members.activity_load_failed')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-default-500">
                  <span>{t('members.activity_by_voice')}</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {(stats?.byVoice ?? []).map((voice) => {
                    const voiceLabel = voice.voiceName ?? t('members.activity_no_voice');
                    return (
                      <div key={voice.voiceId ?? 'no-voice'} className="rounded-md border border-default-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{voiceLabel}</span>
                          <Chip size="sm" variant="flat">
                            {voice.activeMembers} / {voice.totalMembers}
                          </Chip>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-default-100">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.round(voice.activeRate * 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-default-500">
                          {formatPercent(voice.activeRate, numberLocale)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
