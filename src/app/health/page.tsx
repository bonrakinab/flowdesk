"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Heart,
  Moon,
  Footprints,
  Flame,
  MapPin,
  RefreshCw,
  Link as LinkIcon,
  Unlink,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

interface FitnessData {
  date: string;
  steps: number | null;
  distance: number | null;
  calories: number | null;
  activeMinutes: number | null;
  heartRateAvg: number | null;
  heartRateMin: number | null;
  heartRateMax: number | null;
  sleepMinutes: number | null;
}

interface ConnectionStatus {
  lastSyncAt: string | null;
  syncEnabled: boolean;
}

export default function HealthPage() {
  const [data, setData] = useState<FitnessData[]>([]);
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    
    // Check for connection status from URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      handleSync();
      window.history.replaceState({}, '', '/health');
    } else if (params.get('error')) {
      setError(params.get('error') || 'Connection failed');
      window.history.replaceState({}, '', '/health');
    }
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch('/api/fitness/sync?days=30');
      const json = await res.json();
      
      if (res.ok) {
        setData(json.data || []);
        setConnection(json.connection);
      } else {
        setError(json.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    window.location.href = '/api/fitness/connect';
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Google Health? Your data will remain saved.')) {
      return;
    }

    try {
      const res = await fetch('/api/fitness/disconnect', {
        method: 'DELETE',
      });

      if (res.ok) {
        setConnection(null);
        setData([]);
      } else {
        const json = await res.json();
        setError(json.error || 'Failed to disconnect');
      }
    } catch (err) {
      setError('Network error');
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      setError(null);
      
      const res = await fetch('/api/fitness/sync', {
        method: 'POST',
      });
      
      const json = await res.json();
      
      if (res.ok) {
        await fetchData();
      } else {
        setError(json.error || 'Sync failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setSyncing(false);
    }
  }

  // Calculate today's stats and weekly averages
  const today = data[data.length - 1];
  const lastWeek = data.slice(-7);
  
  const weeklyAvg = {
    steps: Math.round(lastWeek.reduce((sum, d) => sum + (d.steps || 0), 0) / lastWeek.length),
    distance: Math.round(lastWeek.reduce((sum, d) => sum + (d.distance || 0), 0) / lastWeek.length),
    calories: Math.round(lastWeek.reduce((sum, d) => sum + (d.calories || 0), 0) / lastWeek.length),
    activeMinutes: Math.round(lastWeek.reduce((sum, d) => sum + (d.activeMinutes || 0), 0) / lastWeek.length),
    heartRate: Math.round(lastWeek.reduce((sum, d) => sum + (d.heartRateAvg || 0), 0) / lastWeek.length),
    sleep: Math.round(lastWeek.reduce((sum, d) => sum + (d.sleepMinutes || 0), 0) / lastWeek.length),
  };

  function getTrend(current: number | null, average: number): 'up' | 'down' | 'same' {
    if (!current || !average) return 'same';
    const diff = ((current - average) / average) * 100;
    if (diff > 5) return 'up';
    if (diff < -5) return 'down';
    return 'same';
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-6xl">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
          Health & Fitness
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your daily activity, heart rate, and sleep
        </p>
      </div>

      {/* Connection Status */}
      <div className="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            {connection ? (
              <>
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Connected to Google Health
                  </p>
                  {connection.lastSyncAt && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Last synced: {new Date(connection.lastSyncAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <p className="font-medium text-gray-900 dark:text-white">
                  Not connected
                </p>
              </>
            )}
          </div>

          <div className="flex gap-2">
            {connection ? (
              <>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 flex items-center gap-2 transition-colors"
                >
                  <Unlink className="w-4 h-4" />
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={handleConnect}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-2 transition-colors"
              >
                <LinkIcon className="w-4 h-4" />
                Connect Google Health
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      {data.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Steps */}
            <StatCard
              icon={Footprints}
              title="Steps"
              value={today?.steps?.toLocaleString() || '—'}
              unit="steps"
              average={weeklyAvg.steps.toLocaleString()}
              trend={getTrend(today?.steps || 0, weeklyAvg.steps)}
              color="blue"
            />

            {/* Distance */}
            <StatCard
              icon={MapPin}
              title="Distance"
              value={today?.distance ? `${(today.distance / 1000).toFixed(2)}` : '—'}
              unit="km"
              average={`${(weeklyAvg.distance / 1000).toFixed(2)} km`}
              trend={getTrend(today?.distance || 0, weeklyAvg.distance)}
              color="green"
            />

            {/* Calories */}
            <StatCard
              icon={Flame}
              title="Calories"
              value={today?.calories?.toFixed(0) || '—'}
              unit="kcal"
              average={`${weeklyAvg.calories} kcal`}
              trend={getTrend(today?.calories || 0, weeklyAvg.calories)}
              color="orange"
            />

            {/* Active Minutes */}
            <StatCard
              icon={Activity}
              title="Active Minutes"
              value={today?.activeMinutes?.toString() || '—'}
              unit="min"
              average={`${weeklyAvg.activeMinutes} min`}
              trend={getTrend(today?.activeMinutes || 0, weeklyAvg.activeMinutes)}
              color="purple"
            />

            {/* Heart Rate */}
            <StatCard
              icon={Heart}
              title="Heart Rate"
              value={today?.heartRateAvg?.toFixed(0) || '—'}
              unit="bpm"
              average={`${weeklyAvg.heartRate} bpm`}
              trend={getTrend(today?.heartRateAvg || 0, weeklyAvg.heartRate)}
              color="red"
            />

            {/* Sleep */}
            <StatCard
              icon={Moon}
              title="Sleep"
              value={today?.sleepMinutes ? `${Math.floor(today.sleepMinutes / 60)}h ${today.sleepMinutes % 60}m` : '—'}
              unit=""
              average={`${Math.floor(weeklyAvg.sleep / 60)}h ${weeklyAvg.sleep % 60}m`}
              trend={getTrend(today?.sleepMinutes || 0, weeklyAvg.sleep)}
              color="indigo"
            />
          </div>

          {/* Weekly Chart */}
          <div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Last 7 Days - Steps
            </h2>
            <div className="flex items-end justify-between gap-2 h-48">
              {lastWeek.map((day, i) => {
                const maxSteps = Math.max(...lastWeek.map(d => d.steps || 0));
                const height = maxSteps > 0 ? ((day.steps || 0) / maxSteps) * 100 : 0;
                const date = new Date(day.date);
                
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="relative w-full">
                      <div
                        className="w-full bg-teal-600 rounded-t transition-all hover:bg-teal-700"
                        style={{ height: `${height}%`, minHeight: day.steps ? '4px' : '0' }}
                        title={`${day.steps?.toLocaleString() || 0} steps`}
                      />
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <Activity className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
            No Data Yet
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {connection
              ? 'Click "Sync Now" to fetch your fitness data'
              : 'Connect your Google account to start tracking'}
          </p>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: any;
  title: string;
  value: string;
  unit: string;
  average: string;
  trend: 'up' | 'down' | 'same';
  color: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'indigo';
}

function StatCard({ icon: Icon, title, value, unit, average, trend, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    orange: 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    purple: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    red: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={`flex items-center gap-1 text-sm ${
          trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
        }`}>
          <TrendIcon className="w-4 h-4" />
        </div>
      </div>
      
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
        {title}
      </h3>
      
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-3xl font-bold text-gray-900 dark:text-white">
          {value}
        </span>
        {unit && (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {unit}
          </span>
        )}
      </div>
      
      <p className="text-xs text-gray-600 dark:text-gray-400">
        7-day avg: {average}
      </p>
    </div>
  );
}
