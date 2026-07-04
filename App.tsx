import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

type FileType = 'Excel' | 'PDF' | 'Word';
type Mode = 'landing' | 'login' | 'chapel' | 'admin';
type ChapelId = 'st-joseph-parish' | 'st-joseph-worker' | 'our-lady-lourdes' | 'sto-nino';

type LoginTarget = { role: 'chapel'; chapelId: ChapelId } | { role: 'admin' };

type SessionUser = {
  role: 'chapel' | 'admin';
  label: string;
  chapelId?: ChapelId;
};

type Chapel = {
  id: ChapelId;
  name: string;
  color: string;
  username: string;
  password: string;
  donations: number[];
  members: number[];
  files: Array<{ name: string; type: FileType; date: string }>;
};

type ServerFile = {
  name: string;
  type: string;
};

type ServerReport = {
  weekLabel: string;
  donation: number;
  members: number;
  trackingNumber: string;
  notes?: string;
  files?: ServerFile[];
};

type ServerChapel = {
  chapelId: string;
  name: string;
  color: string;
  username: string;
  password: string;
  reports: ServerReport[];
};

const WEEK_LABELS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];
const FILE_TYPES: FileType[] = ['Excel', 'PDF', 'Word'];
const API_BASE_URL = (process.env.EXPO_PUBLIC_KALOOB_API_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');

const FALLBACK_CHAPELS: Chapel[] = [
  {
    id: 'st-joseph-parish',
    name: 'St. Joseph Parish',
    color: '#2ea44f',
    username: 'SJ-PARISH',
    password: 'Kaloob2026!',
    donations: [18500, 19200, 19800, 20600, 21450, 22300, 23150, 24100],
    members: [168, 170, 172, 174, 176, 179, 181, 183],
    files: [
      { name: 'parish-member-log.xlsx', type: 'Excel', date: 'Today' },
      { name: 'parish-report.pdf', type: 'PDF', date: 'Yesterday' },
    ],
  },
  {
    id: 'st-joseph-worker',
    name: 'St. Joseph the Worker Chapel',
    color: '#f0c400',
    username: 'SJ-WORKER',
    password: 'Kaloob2026!',
    donations: [12100, 12450, 12800, 13150, 13580, 14050, 14510, 14980],
    members: [131, 132, 134, 135, 137, 138, 140, 142],
    files: [
      { name: 'worker-summary.docx', type: 'Word', date: 'Today' },
      { name: 'worker-donations.xlsx', type: 'Excel', date: '3 days ago' },
    ],
  },
  {
    id: 'our-lady-lourdes',
    name: 'Our Lady of Lourdes Chapel',
    color: '#2b7fff',
    username: 'LOURDES',
    password: 'Kaloob2026!',
    donations: [9800, 10030, 10320, 10640, 10980, 11320, 11690, 12080],
    members: [101, 102, 103, 104, 105, 107, 108, 110],
    files: [
      { name: 'lourdes-records.pdf', type: 'PDF', date: 'Today' },
      { name: 'lourdes-roster.xlsx', type: 'Excel', date: '4 days ago' },
    ],
  },
  {
    id: 'sto-nino',
    name: 'Sto. Nino Chapel',
    color: '#ef4c3c',
    username: 'STO-NINO',
    password: 'Kaloob2026!',
    donations: [10850, 11100, 11420, 11780, 12110, 12430, 12790, 13120],
    members: [118, 119, 120, 121, 123, 124, 126, 127],
    files: [
      { name: 'sto-nino-weekly.docx', type: 'Word', date: 'Today' },
      { name: 'sto-nino-log.xlsx', type: 'Excel', date: '6 days ago' },
    ],
  },
];

function normalizeFileType(value: string): FileType {
  if (FILE_TYPES.includes(value as FileType)) {
    return value as FileType;
  }

  return 'Excel';
}

function buildFallbackChapel(chapelId: ChapelId): Chapel {
  return FALLBACK_CHAPELS.find((chapel) => chapel.id === chapelId) ?? FALLBACK_CHAPELS[0];
}

function mapServerChapel(remoteChapel: ServerChapel): Chapel {
  const fallback = buildFallbackChapel(remoteChapel.chapelId as ChapelId);

  if (!remoteChapel.reports.length) {
    return fallback;
  }

  return {
    ...fallback,
    id: remoteChapel.chapelId as ChapelId,
    name: remoteChapel.name ?? fallback.name,
    color: remoteChapel.color ?? fallback.color,
    username: remoteChapel.username ?? fallback.username,
    password: remoteChapel.password ?? fallback.password,
    donations: remoteChapel.reports.map((report) => Number(report.donation) || 0).slice(-8),
    members: remoteChapel.reports.map((report) => Number(report.members) || 0).slice(-8),
    files: remoteChapel.reports
      .flatMap((report) =>
        (report.files ?? []).map((file, index) => ({
          name: file.name,
          type: normalizeFileType(file.type),
          date: report.weekLabel ?? `Report ${index + 1}`,
        }))
      )
      .slice(-4),
  };
}

function applyLocalReport(chapel: Chapel, report: { weekLabel: string; donation: number; members: number; fileName: string; fileType: FileType }) {
  return {
    ...chapel,
    donations: [...chapel.donations, report.donation].slice(-8),
    members: [...chapel.members, report.members].slice(-8),
    files: [...chapel.files, { name: report.fileName, type: report.fileType, date: report.weekLabel }].slice(-4),
  };
}

function formatPeso(value: number) {
  return `₱${Math.round(value).toLocaleString('en-PH')}`;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function growth(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  return values[values.length - 1] - values[0];
}

function growthPercent(values: number[]) {
  if (values.length < 2 || values[0] === 0) {
    return 0;
  }

  return ((values[values.length - 1] - values[0]) / values[0]) * 100;
}

function buildInterpretation(name: string, donations: number[], members: number[]) {
  const donationGrowth = growthPercent(donations).toFixed(1);
  const memberGrowth = growth(members);
  const bestIndex = donations.indexOf(Math.max(...donations));

  return [
    `${name} is trending upward with ${donationGrowth}% donation growth across 8 weeks.`,
    `Membership increased by ${memberGrowth} people, so the Sunday database is also expanding.`,
    `The strongest week was ${WEEK_LABELS[bestIndex]} at ${formatPeso(donations[bestIndex])}.`,
  ];
}

function buildAdminInterpretation(chapels: Chapel[]) {
  const latestTotals = chapels.map((chapel) => chapel.donations[chapel.donations.length - 1]);
  const combined = sum(latestTotals);
  const leader = chapels[latestTotals.indexOf(Math.max(...latestTotals))];
  const fastest = chapels.reduce((best, chapel) => (growth(chapel.donations) > growth(best.donations) ? chapel : best));

  return [
    `All four chapels generated a combined latest-week total of ${formatPeso(combined)}.`,
    `${leader.name} currently leads the latest Sunday donation, while ${fastest.name} has the fastest growth.`,
    'The export should include this interpretation so the super admin can compare support, income, and membership movement.',
  ];
}

function LineChart({
  series,
}: {
  series: Array<{ label: string; color: string; values: number[] }>;
}) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(Math.max(width - 44, 320), 980);
  const chartHeight = 260;
  const leftPad = 22;
  const topPad = 20;
  const plotWidth = chartWidth - leftPad * 2;
  const plotHeight = chartHeight - topPad * 2;
  const allValues = series.flatMap((item) => item.values);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const range = Math.max(maxValue - minValue, 1);

  return (
    <View style={[styles.chartCard, { width: chartWidth, height: chartHeight + 40 }]}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Weekly donation trend</Text>
        <Text style={styles.chartSubtitle}>Eight-week view with chapel-specific color.</Text>
      </View>

      <View style={[styles.chartStage, { width: chartWidth, height: chartHeight }]}>
        {[0, 1, 2, 3].map((row) => (
          <View
            key={row}
            style={[
              styles.gridLine,
              { top: topPad + (plotHeight / 3) * row, left: leftPad, width: chartWidth - leftPad * 2 },
            ]}
          />
        ))}

        {series.map((entry) => {
          const points = entry.values.map((value, index) => {
            const x = leftPad + (plotWidth / (entry.values.length - 1)) * index;
            const y = topPad + plotHeight - ((value - minValue) / range) * plotHeight;
            return { x, y };
          });

          return (
            <View key={entry.label}>
              {points.map((point, index) => {
                const previous = points[index - 1];
                if (!previous) {
                  return null;
                }

                const dx = point.x - previous.x;
                const dy = point.y - previous.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

                return (
                  <View
                    key={`${entry.label}-${index}`}
                    style={[
                      styles.lineSegment,
                      {
                        backgroundColor: entry.color,
                        width: length,
                        left: previous.x,
                        top: previous.y,
                        transform: [{ rotate: `${angle}deg` }],
                      },
                    ]}
                  />
                );
              })}

              {points.map((point, index) => (
                <View
                  key={`${entry.label}-dot-${index}`}
                  style={[
                    styles.dot,
                    { borderColor: entry.color, left: point.x - 6, top: point.y - 6 },
                  ]}
                />
              ))}
            </View>
          );
        })}

        <View style={styles.axisRow}>
          {WEEK_LABELS.map((label) => (
            <Text key={label} style={styles.axisLabel}>
              {label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function Metric({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricLabel, { color }]}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

function Chip({ label, color, active, onPress }: { label: string; color: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

function MiniBars({ values, color }: { values: number[]; color: string }) {
  const highest = Math.max(...values, 1);

  return (
    <View style={styles.miniBarsRow}>
      {values.map((value, index) => {
        const barHeight = 20 + (value / highest) * 52;
        return (
          <View key={`${value}-${index}`} style={styles.miniBarWrap}>
            <View style={[styles.miniBar, { height: barHeight, backgroundColor: color }]} />
            <Text style={styles.miniBarLabel}>{WEEK_LABELS[index]}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function App() {
  const [chapels, setChapels] = useState<Chapel[]>(FALLBACK_CHAPELS);
  const [mode, setMode] = useState<Mode>('login');
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loginTarget, setLoginTarget] = useState<LoginTarget>({ role: 'chapel', chapelId: 'st-joseph-parish' });
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [selectedChapelId, setSelectedChapelId] = useState<ChapelId>('st-joseph-parish');
  const [fileType, setFileType] = useState<FileType>('Excel');
  const [trackingNumber, setTrackingNumber] = useState('KLB-2026-001');
  const [donationInput, setDonationInput] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [fileName, setFileName] = useState('kaloob-members.xlsx');
  const [notes, setNotes] = useState('Sunday update');
  const [status, setStatus] = useState('Please sign in to continue.');
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    let isMounted = true;

    async function loadChapels() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chapels`);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as { chapels?: ServerChapel[] };
        const remoteChapels = Array.isArray(payload.chapels) ? payload.chapels.map(mapServerChapel) : [];

        if (isMounted && remoteChapels.length > 0) {
          setChapels(remoteChapels);
          setStatus(`Connected to API at ${API_BASE_URL} and loaded chapel data.`);
        }
      } catch {
        if (isMounted) {
          setStatus('Using local chapel seed data until the API is reachable.');
        }
      }
    }

    loadChapels();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedChapel = chapels.find((chapel) => chapel.id === selectedChapelId) ?? chapels[0];
  const pulseY = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });

  const selectedSummary = {
    latestDonation: selectedChapel.donations[selectedChapel.donations.length - 1],
    latestMembers: selectedChapel.members[selectedChapel.members.length - 1],
    donationGrowth: growthPercent(selectedChapel.donations),
    memberGrowth: growth(selectedChapel.members),
    averageDonation: sum(selectedChapel.donations) / selectedChapel.donations.length,
  };

  const targetDonation = 30000;
  const donationProgress = Math.min((selectedSummary.latestDonation / targetDonation) * 100, 100);

  const chapelCards = useMemo(
    () =>
      chapels.map((chapel) => ({
        ...chapel,
        donationGrowth: growthPercent(chapel.donations),
      })),
    [chapels]
  );

  const adminSeries = useMemo(
    () => chapels.map((chapel) => ({ label: chapel.name, color: chapel.color, values: chapel.donations })),
    [chapels]
  );

  const adminCombinedLatest = chapels.reduce((total, chapel) => total + (chapel.donations.at(-1) ?? 0), 0);
  const adminLeader = chapels.reduce((best, chapel) => ((chapel.donations.at(-1) ?? 0) > (best.donations.at(-1) ?? 0) ? chapel : best));

  const startChapelLogin = (chapel: Chapel) => {
    setLoginTarget({ role: 'chapel', chapelId: chapel.id });
    setLoginUsername(chapel.username);
    setLoginPassword('');
    setMode('login');
    setStatus(`Login required for ${chapel.name}.`);
  };

  const startAdminLogin = () => {
    setLoginTarget({ role: 'admin' });
    setLoginUsername('');
    setLoginPassword('');
    setMode('login');
    setStatus('Super admin login required.');
  };

  const logout = () => {
    setSessionUser(null);
    setSessionToken(null);
    setMode('login');
    setLoginPassword('');
    setStatus('Session ended. Please sign in again.');
  };

  const handleLogin = async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) {
      Alert.alert('Missing credentials', 'Please enter both username and password.');
      return;
    }

    setLoginBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: loginTarget.role === 'admin' ? 'superadmin' : 'church',
          username: loginUsername,
          password: loginPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        token?: string;
        user?: { role: 'admin'; label: string };
        chapel?: ServerChapel;
      };

      if (!payload.token) {
        throw new Error('No token returned by server');
      }

      setSessionToken(payload.token);

      if (loginTarget.role === 'admin') {
        if (!payload.user) {
          throw new Error('No admin user returned');
        }

        setSessionUser({ role: 'admin', label: payload.user.label });
        setMode('admin');
        setStatus('Super admin logged in.');
        return;
      }

      if (!payload.chapel) {
        throw new Error('No chapel returned by server');
      }

      const normalizedChapel = mapServerChapel(payload.chapel);
      setChapels((currentChapels) =>
        currentChapels.map((chapel) => (chapel.id === normalizedChapel.id ? normalizedChapel : chapel))
      );
      setSelectedChapelId(normalizedChapel.id);
      setSessionUser({ role: 'chapel', label: normalizedChapel.name, chapelId: normalizedChapel.id });
      setMode('chapel');
      setStatus(`${normalizedChapel.name} logged in.`);
    } catch {
      if (loginTarget.role === 'admin') {
        Alert.alert('Login failed', 'Invalid super admin credentials.');
      } else {
        const fallback = chapels.find((chapel) => chapel.username === loginUsername && chapel.password === loginPassword);
        if (fallback) {
          setSelectedChapelId(fallback.id);
          setSessionUser({ role: 'chapel', label: fallback.name, chapelId: fallback.id });
          setMode('chapel');
          setStatus(`${fallback.name} logged in using local account cache.`);
        } else {
          Alert.alert('Login failed', 'Invalid chapel username or password.');
        }
      }
    } finally {
      setLoginBusy(false);
    }
  };

  const handleSave = async () => {
    const donationValue = Number(donationInput);
    const memberValue = Number(memberInput);

    if (!Number.isFinite(donationValue) || !Number.isFinite(memberValue)) {
      Alert.alert('Invalid input', 'Please enter numeric values for donation and member count.');
      return;
    }

    const weekLabel = WEEK_LABELS[selectedChapel.donations.length] ?? `W${selectedChapel.donations.length + 1}`;

    try {
      const response = await fetch(`${API_BASE_URL}/api/chapels/${selectedChapel.id}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          weekLabel,
          donation: donationValue,
          members: memberValue,
          trackingNumber,
          notes,
          files: [{ name: fileName, type: fileType }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as { chapel?: ServerChapel };
      if (payload.chapel) {
        const normalizedChapel = mapServerChapel(payload.chapel);
        setChapels((currentChapels) =>
          currentChapels.map((chapel) => (chapel.id === normalizedChapel.id ? normalizedChapel : chapel))
        );
      } else {
        setChapels((currentChapels) =>
          currentChapels.map((chapel) =>
            chapel.id === selectedChapel.id
              ? applyLocalReport(chapel, { weekLabel, donation: donationValue, members: memberValue, fileName, fileType })
              : chapel
          )
        );
      }

      setStatus(`${selectedChapel.name} update saved through the API with tracking ${trackingNumber}.`);
      Alert.alert(
        'Database updated',
        `${selectedChapel.name}\nTracking: ${trackingNumber}\nDonation: ${formatPeso(donationValue)}\nMembers: ${memberValue}`
      );
    } catch {
      setChapels((currentChapels) =>
        currentChapels.map((chapel) =>
          chapel.id === selectedChapel.id
            ? applyLocalReport(chapel, { weekLabel, donation: donationValue, members: memberValue, fileName, fileType })
            : chapel
        )
      );
      setStatus(`${selectedChapel.name} was saved locally because the API was unavailable.`);
      Alert.alert(
        'Saved locally',
        `${selectedChapel.name}\nTracking: ${trackingNumber}\nDonation: ${formatPeso(donationValue)}\nMembers: ${memberValue}`
      );
    }
  };

  const handleExport = (target: 'PDF' | 'Excel', scope: 'selected' | 'admin') => {
    const text =
      scope === 'admin'
        ? buildAdminInterpretation(chapels).join('\n\n')
        : buildInterpretation(selectedChapel.name, selectedChapel.donations, selectedChapel.members).join('\n\n');
    setStatus(`${target} export prepared for ${scope === 'admin' ? 'all chapels' : selectedChapel.name}.`);
    Alert.alert(`${target} export ready`, text);
  };

  const landing = (
    <View style={styles.panel}>
      <View style={styles.heroRow}>
        <View style={styles.heroTextBlock}>
          <Text style={styles.kicker}>KALOOB system flow</Text>
          <Text style={styles.heroTitle}>One account for each chapel, one super admin view for all reports.</Text>
          <Text style={styles.heroCopy}>
            Built for St. Joseph Parish, St. Joseph the Worker Chapel, Our Lady of Lourdes Chapel, and Sto. Nino Chapel.
            Each account can update weekly donations, upload member files, and export weekly reports for at least 2 months.
          </Text>
        </View>

        <Animated.View style={[styles.heroOrb, { transform: [{ translateY: pulseY }, { rotate: '10deg' }] }]} />
      </View>

      <View style={styles.accountRow}>
        {chapels.map((chapel) => (
          <Pressable
            key={chapel.id}
            onPress={() => startChapelLogin(chapel)}
            style={[styles.accountCard, { borderColor: chapel.color }]}
          >
            <View style={[styles.accountDot, { backgroundColor: chapel.color }]} />
            <Text style={styles.accountName}>{chapel.name}</Text>
            <Text style={styles.accountMeta}>Premade account with dashboard, uploads, and export-ready reporting.</Text>
          </Pressable>
        ))}

        <Pressable
          onPress={startAdminLogin}
          style={[styles.accountCard, styles.adminCard]}
        >
          <View style={[styles.accountDot, { backgroundColor: '#ffffff' }]} />
          <Text style={styles.accountName}>Super Admin</Text>
          <Text style={styles.accountMeta}>See all four chapels in one chart with interpretation and exports.</Text>
        </Pressable>
      </View>

      <View style={styles.featureRow}>
        <View style={styles.featureCard}>
          <Text style={styles.featureValue}>4</Text>
          <Text style={styles.featureLabel}>Premade chapel accounts</Text>
        </View>
        <View style={styles.featureCard}>
          <Text style={styles.featureValue}>8</Text>
          <Text style={styles.featureLabel}>Weekly points per report</Text>
        </View>
        <View style={styles.featureCard}>
          <Text style={styles.featureValue}>2 mo.</Text>
          <Text style={styles.featureLabel}>Visible report history</Text>
        </View>
      </View>

      <View style={styles.statusBanner}>
        <Text style={styles.statusLabel}>Current flow</Text>
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </View>
  );

  const loginView = (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>Account login</Text>
          <Text style={styles.pageTitle}>{loginTarget.role === 'admin' ? 'Super Admin Access' : 'Chapel Access'}</Text>
          <Text style={styles.heroCopy}>
            {loginTarget.role === 'admin'
              ? 'Use super admin credentials to access the full chapel report dashboard.'
              : 'Enter your chapel username and password to continue.'}
          </Text>
        </View>
      </View>

      <View style={styles.roleRow}>
        <Pressable
          style={[styles.roleButton, loginTarget.role === 'chapel' && styles.roleButtonActive]}
          onPress={() => {
            setLoginTarget({ role: 'chapel', chapelId: selectedChapelId });
            setLoginUsername('');
            setLoginPassword('');
            setStatus('Please enter chapel credentials.');
          }}
        >
          <Text style={[styles.roleButtonText, loginTarget.role === 'chapel' && styles.roleButtonTextActive]}>Chapel</Text>
        </Pressable>
        <Pressable
          style={[styles.roleButton, loginTarget.role === 'admin' && styles.roleButtonActive]}
          onPress={() => {
            setLoginTarget({ role: 'admin' });
            setLoginUsername('');
            setLoginPassword('');
            setStatus('Please enter super admin credentials.');
          }}
        >
          <Text style={[styles.roleButtonText, loginTarget.role === 'admin' && styles.roleButtonTextActive]}>Super Admin</Text>
        </Pressable>
      </View>

      <View style={styles.loginPanel}>
        <View style={styles.formGrid}>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput value={loginUsername} onChangeText={setLoginUsername} style={styles.input} placeholder="Enter username" placeholderTextColor="rgba(255,255,255,0.45)" autoCapitalize="none" />
          </View>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput value={loginPassword} onChangeText={setLoginPassword} style={styles.input} placeholder="Enter password" placeholderTextColor="rgba(255,255,255,0.45)" secureTextEntry />
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={loginBusy}>
            <LinearGradient colors={['#f0c400', '#d6f23e', '#1a9a47']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGradient}>
              <Text style={styles.primaryText}>{loginBusy ? 'Signing in...' : 'Login account'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      <View style={styles.statusBanner}>
        <Text style={styles.statusLabel}>Authentication</Text>
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </View>
  );

  const chapelView = (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>Chapel dashboard</Text>
          <Text style={styles.pageTitle}>{selectedChapel.name}</Text>
          <Text style={styles.heroCopy}>
            Update the KALOOB donation database for this chapel, attach files, generate a tracking number, and export the report.
          </Text>
        </View>
        <Pressable style={styles.secondaryButton} onPress={logout}>
          <Text style={styles.secondaryButtonText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.lockedAccountRow}>
        <View style={styles.lockBadge} />
        <Text style={styles.lockedAccountText}>Logged in as {sessionUser?.label ?? selectedChapel.name}. Account switching requires login.</Text>
      </View>

      <View style={styles.metricRow}>
        <Metric label="Latest Sunday donation" value={formatPeso(selectedSummary.latestDonation)} detail={`Growth: +${selectedSummary.donationGrowth.toFixed(1)}% from the first week.`} color={selectedChapel.color} />
        <Metric label="Current member count" value={String(selectedSummary.latestMembers)} detail={`Growth: +${selectedSummary.memberGrowth} members over 2 months.`} color={selectedChapel.color} />
        <Metric label="8-week average" value={formatPeso(selectedSummary.averageDonation)} detail="Use this when summarizing the chapel trend in the export file." color={selectedChapel.color} />
      </View>

      <View style={styles.dashboardGrid}>
        <View style={styles.widgetCardWide}>
          <Text style={styles.widgetTitle}>Weekly Donation Analytics</Text>
          <Text style={styles.widgetMeta}>Visual trend of the last 8 Sundays for {selectedChapel.name}.</Text>
          <MiniBars values={selectedChapel.donations} color={selectedChapel.color} />
        </View>

        <View style={styles.widgetCard}>
          <Text style={styles.widgetTitle}>Target Progress</Text>
          <Text style={styles.widgetBigNumber}>{donationProgress.toFixed(0)}%</Text>
          <Text style={styles.widgetMeta}>This week against {formatPeso(targetDonation)} chapel target.</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${donationProgress}%`, backgroundColor: selectedChapel.color }]} />
          </View>
        </View>

        <View style={styles.widgetCard}>
          <Text style={styles.widgetTitle}>Reminders</Text>
          <Text style={styles.widgetListItem}>1. Encode Sunday totals before Monday 10:00 AM.</Text>
          <Text style={styles.widgetListItem}>2. Upload attendance file with tracking number.</Text>
          <Text style={styles.widgetListItem}>3. Export PDF and Excel for audit archive.</Text>
        </View>

        <View style={styles.widgetCardWide}>
          <Text style={styles.widgetTitle}>Latest Uploaded Files</Text>
          <View style={styles.widgetListWrap}>
            {selectedChapel.files.slice(-4).map((file) => (
              <View key={`${file.name}-${file.date}`} style={styles.widgetListRow}>
                <Text style={styles.widgetListPrimary}>{file.name}</Text>
                <Text style={styles.widgetListSecondary}>{file.type} · {file.date}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.chartWrap}>
        <LineChart series={[{ label: selectedChapel.name, color: selectedChapel.color, values: selectedChapel.donations }]} />
      </View>

      <View style={styles.formPanel}>
        <Text style={styles.sectionTitle}>Update this Sunday</Text>
        <Text style={styles.sectionCopy}>Encode the donation amount, upload the member file, and keep the tracking number for audits.</Text>

        <View style={styles.formGrid}>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Tracking number</Text>
            <TextInput value={trackingNumber} onChangeText={setTrackingNumber} style={styles.input} placeholder="KLB-2026-001" placeholderTextColor="rgba(255,255,255,0.45)" />
          </View>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Sunday donation</Text>
            <TextInput value={donationInput} onChangeText={setDonationInput} style={styles.input} placeholder="Enter donation amount" placeholderTextColor="rgba(255,255,255,0.45)" keyboardType="numeric" />
          </View>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Member count</Text>
            <TextInput value={memberInput} onChangeText={setMemberInput} style={styles.input} placeholder="Enter member count" placeholderTextColor="rgba(255,255,255,0.45)" keyboardType="numeric" />
          </View>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>File name</Text>
            <TextInput value={fileName} onChangeText={setFileName} style={styles.input} placeholder="kaloob-members.xlsx" placeholderTextColor="rgba(255,255,255,0.45)" />
          </View>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput value={notes} onChangeText={setNotes} style={[styles.input, styles.multilineInput]} placeholder="Sunday update" placeholderTextColor="rgba(255,255,255,0.45)" multiline />
          </View>
        </View>

        <View style={styles.fileTypeRow}>
          {FILE_TYPES.map((type) => (
            <Chip key={type} label={type} color={selectedChapel.color} active={fileType === type} onPress={() => setFileType(type)} />
          ))}
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.primaryButton} onPress={handleSave}>
            <LinearGradient colors={[selectedChapel.color, '#d6f23e', '#1a9a47']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGradient}>
              <Text style={styles.primaryText}>Save database update</Text>
            </LinearGradient>
          </Pressable>
          <Pressable style={styles.exportButton} onPress={() => handleExport('PDF', 'selected')}>
            <Text style={styles.exportButtonText}>Export PDF</Text>
          </Pressable>
          <Pressable style={styles.exportButton} onPress={() => handleExport('Excel', 'selected')}>
            <Text style={styles.exportButtonText}>Export Excel</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.reportPanel}>
        <Text style={styles.sectionTitle}>2-month weekly reports</Text>
        <Text style={styles.sectionCopy}>The latest eight Sundays stay visible so the chapel can compare weekly patterns quickly.</Text>
        {selectedChapel.donations.map((amount, index) => (
          <View key={`${selectedChapel.id}-${index}`} style={styles.reportRow}>
            <Text style={styles.reportWeek}>{WEEK_LABELS[index]}</Text>
            <Text style={styles.reportAmount}>{formatPeso(amount)}</Text>
            <Text style={styles.reportMeta}>{selectedChapel.members[index]} members</Text>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Interpretation</Text>
        {buildInterpretation(selectedChapel.name, selectedChapel.donations, selectedChapel.members).map((line) => (
          <View key={line} style={styles.insightCard}>
            <Text style={styles.insightText}>{line}</Text>
          </View>
        ))}
      </View>

      <View style={styles.statusBanner}>
        <Text style={styles.statusLabel}>Last action</Text>
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </View>
  );

  const adminView = (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>Super admin dashboard</Text>
          <Text style={styles.pageTitle}>All church reports in one line chart</Text>
          <Text style={styles.heroCopy}>
            One chart shows St. Joseph Parish in green, St. Joseph the Worker Chapel in yellow, Our Lady of Lourdes Chapel in blue, and Sto. Nino Chapel in red.
          </Text>
        </View>
        <Pressable style={styles.secondaryButton} onPress={logout}>
          <Text style={styles.secondaryButtonText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.legendRow}>
        {chapels.map((chapel) => (
          <View key={chapel.id} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: chapel.color }]} />
            <Text style={styles.legendText}>{chapel.name}</Text>
          </View>
        ))}
      </View>

      <LineChart series={adminSeries} />

      <View style={styles.dashboardGrid}>
        <View style={styles.widgetCard}>
          <Text style={styles.widgetTitle}>Combined Latest Sunday</Text>
          <Text style={styles.widgetBigNumber}>{formatPeso(adminCombinedLatest)}</Text>
          <Text style={styles.widgetMeta}>Total across all active chapel accounts.</Text>
        </View>

        <View style={styles.widgetCard}>
          <Text style={styles.widgetTitle}>Current Leader</Text>
          <Text style={styles.widgetBigNumber}>{adminLeader.name}</Text>
          <Text style={styles.widgetMeta}>{formatPeso(adminLeader.donations.at(-1) ?? 0)} this week.</Text>
        </View>

        <View style={styles.widgetCardWide}>
          <Text style={styles.widgetTitle}>Cross-Chapel Momentum</Text>
          <Text style={styles.widgetMeta}>Quick visual comparison of latest-week donations.</Text>
          <View style={styles.comparisonList}>
            {chapels.map((chapel) => {
              const latest = chapel.donations.at(-1) ?? 0;
              const width = Math.min((latest / Math.max(adminCombinedLatest, 1)) * 260, 260);
              return (
                <View key={chapel.id} style={styles.comparisonRow}>
                  <Text style={styles.comparisonName}>{chapel.name}</Text>
                  <View style={styles.comparisonTrack}>
                    <View style={[styles.comparisonFill, { backgroundColor: chapel.color, width }]} />
                  </View>
                  <Text style={styles.comparisonValue}>{formatPeso(latest)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.metricRow}>
        {chapelCards.map((chapel) => (
          <Metric key={chapel.id} label={chapel.name} value={formatPeso(chapel.donations[chapel.donations.length - 1])} detail={`Growth: +${chapel.donationGrowth.toFixed(1)}% over 8 weeks.`} color={chapel.color} />
        ))}
      </View>

      <View style={styles.formPanel}>
        <Text style={styles.sectionTitle}>Analysis for exports</Text>
        <Text style={styles.sectionCopy}>This section should be included in PDF and Excel exports as an interpretation block.</Text>
        {buildAdminInterpretation(chapels).map((line) => (
          <View key={line} style={styles.insightCard}>
            <Text style={styles.insightText}>{line}</Text>
          </View>
        ))}

        <View style={styles.actionRow}>
          <Pressable style={styles.primaryButton} onPress={() => handleExport('PDF', 'admin')}>
            <LinearGradient colors={['#f0c400', '#d6f23e', '#1a9a47']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGradient}>
              <Text style={styles.primaryText}>Export admin PDF</Text>
            </LinearGradient>
          </Pressable>
          <Pressable style={styles.exportButton} onPress={() => handleExport('Excel', 'admin')}>
            <Text style={styles.exportButtonText}>Export admin Excel</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statusBanner}>
        <Text style={styles.statusLabel}>Last action</Text>
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={['#ffe45b', '#d4ef2d', '#1d8d3f']} locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.background}>
      <StatusBar style="light" />
      <View style={styles.overlay} />

      <Animated.View pointerEvents="none" style={[styles.floatOrb, styles.floatOrbLeft, { transform: [{ translateY: pulseY }, { rotate: '12deg' }] }]} />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.floatOrb,
          styles.floatOrbRight,
          { transform: [{ translateY: pulseY.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) }, { rotate: '-8deg' }] },
        ]}
      />

      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark} />
          <Text style={styles.brandText}>KALOOB</Text>
        </View>

        {!sessionUser ? loginView : sessionUser.role === 'admin' ? adminView : chapelView}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#071009' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3, 10, 5, 0.52)' },
  floatOrb: { position: 'absolute', borderRadius: 999, opacity: 0.85, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 30 },
  floatOrbLeft: { top: 80, left: -30, width: 160, height: 160, backgroundColor: 'rgba(255, 234, 100, 0.22)' },
  floatOrbRight: { top: 180, right: -18, width: 140, height: 140, backgroundColor: 'rgba(110, 255, 150, 0.18)' },
  page: { minHeight: '100%', paddingHorizontal: 20, paddingVertical: 28, alignItems: 'center', justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 18, gap: 10 },
  brandMark: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#ffe45b', borderWidth: 2, borderColor: '#b7ea2e' },
  brandText: { color: '#f9fff0', fontSize: 18, fontWeight: '800', letterSpacing: 4 },
  panel: { width: '100%', maxWidth: 1160, borderRadius: 34, padding: 24, backgroundColor: 'rgba(4, 12, 7, 0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 28, gap: 18 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' },
  heroTextBlock: { flex: 1, minWidth: 280 },
  heroOrb: { width: 160, height: 160, borderRadius: 44, backgroundColor: 'rgba(255, 233, 100, 0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  kicker: { color: '#d8ff91', textTransform: 'uppercase', letterSpacing: 2, fontSize: 12, fontWeight: '700', marginBottom: 10 },
  heroTitle: { color: '#ffffff', fontSize: 52, lineHeight: 56, fontWeight: '900', maxWidth: 820 },
  pageTitle: { color: '#ffffff', fontSize: 42, lineHeight: 46, fontWeight: '900', maxWidth: 820 },
  heroCopy: { color: 'rgba(255,255,255,0.82)', fontSize: 16, lineHeight: 24, marginTop: 14, maxWidth: 840 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 18, flexWrap: 'wrap' },
  roleButton: { flexGrow: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.06)' },
  roleButtonActive: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(232,244,127,0.9)' },
  roleButtonText: { color: 'rgba(255,255,255,0.8)', fontWeight: '800', textAlign: 'center' },
  roleButtonTextActive: { color: '#fff' },
  accountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  accountCard: { flexGrow: 1, minWidth: 200, borderRadius: 22, padding: 18, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1 },
  adminCard: { borderColor: 'rgba(255,255,255,0.34)' },
  accountDot: { width: 12, height: 12, borderRadius: 6, marginBottom: 10 },
  accountName: { color: '#ffffff', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  accountMeta: { color: 'rgba(255,255,255,0.74)', lineHeight: 20 },
  featureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  featureCard: { minWidth: 160, flexGrow: 1, borderRadius: 22, padding: 18, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  featureValue: { color: '#fff5cf', fontSize: 28, fontWeight: '900', marginBottom: 6 },
  featureLabel: { color: 'rgba(255,255,255,0.82)', lineHeight: 20 },
  statusBanner: { borderRadius: 22, padding: 16, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  statusLabel: { color: '#dfffa9', textTransform: 'uppercase', letterSpacing: 1.4, fontSize: 12, fontWeight: '800', marginBottom: 4 },
  statusText: { color: '#ffffff', lineHeight: 22 },
  secondaryButton: { borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.06)' },
  secondaryButtonText: { color: '#f5ffe8', fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.05)' },
  chipActive: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,240,150,0.55)' },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  chipText: { color: '#ffffff', fontWeight: '700' },
  loginPanel: { borderRadius: 24, padding: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  lockedAccountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  lockBadge: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#f0c400' },
  lockedAccountText: { color: 'rgba(255,255,255,0.86)', fontSize: 13, fontWeight: '700' },
  dashboardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  widgetCard: { minWidth: 250, flexGrow: 1, borderRadius: 22, padding: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  widgetCardWide: { minWidth: 280, flexBasis: '48%', flexGrow: 2, borderRadius: 22, padding: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  widgetTitle: { color: '#fff5cf', fontSize: 16, fontWeight: '900', marginBottom: 6 },
  widgetMeta: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 20 },
  widgetBigNumber: { color: '#ffffff', fontSize: 30, fontWeight: '900', marginBottom: 6 },
  widgetListWrap: { marginTop: 6, gap: 8 },
  widgetListRow: { borderRadius: 14, paddingVertical: 9, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  widgetListPrimary: { color: '#ffffff', fontWeight: '800' },
  widgetListSecondary: { color: 'rgba(255,255,255,0.68)', marginTop: 2, fontSize: 12 },
  widgetListItem: { color: 'rgba(255,255,255,0.82)', lineHeight: 20, marginBottom: 6 },
  progressTrack: { marginTop: 12, height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  miniBarsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 12 },
  miniBarWrap: { alignItems: 'center', gap: 6 },
  miniBar: { width: 14, borderRadius: 999, minHeight: 10 },
  miniBarLabel: { color: 'rgba(255,255,255,0.56)', fontSize: 10 },
  comparisonList: { marginTop: 10, gap: 8 },
  comparisonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  comparisonName: { width: 180, color: '#ffffff', fontSize: 12, fontWeight: '700' },
  comparisonTrack: { width: 260, height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  comparisonFill: { height: '100%', borderRadius: 999 },
  comparisonValue: { minWidth: 90, textAlign: 'right', color: '#fff7d6', fontWeight: '800', fontSize: 12 },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { flexGrow: 1, minWidth: 220, flexBasis: '31%', borderRadius: 22, padding: 18, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  metricLabel: { textTransform: 'uppercase', letterSpacing: 1.1, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  metricValue: { color: '#ffffff', fontSize: 26, fontWeight: '900' },
  metricDetail: { color: 'rgba(255,255,255,0.74)', marginTop: 8, lineHeight: 20 },
  chartWrap: { alignItems: 'center' },
  chartCard: { borderRadius: 24, padding: 14, backgroundColor: 'rgba(7, 16, 9, 0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  chartHeader: { marginBottom: 10 },
  chartTitle: { color: '#ffffff', fontSize: 18, fontWeight: '900', marginBottom: 4 },
  chartSubtitle: { color: 'rgba(255,255,255,0.68)' },
  chartStage: { position: 'relative' },
  gridLine: { position: 'absolute', height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  lineSegment: { position: 'absolute', height: 3, borderRadius: 999, transformOrigin: 'left center' },
  dot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#071009', borderWidth: 3 },
  axisRow: { position: 'absolute', left: 22, right: 22, bottom: 10, flexDirection: 'row', justifyContent: 'space-between' },
  axisLabel: { color: 'rgba(255,255,255,0.56)', fontSize: 11 },
  formPanel: { borderRadius: 24, padding: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  reportPanel: { borderRadius: 24, padding: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  sectionTitle: { color: '#fff4bc', fontSize: 22, fontWeight: '900', marginBottom: 6 },
  sectionCopy: { color: 'rgba(255,255,255,0.76)', lineHeight: 22, marginBottom: 12 },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  inputWrap: { flexGrow: 1, minWidth: 220 },
  inputLabel: { color: '#dfffa9', marginBottom: 8, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 52, borderRadius: 16, paddingHorizontal: 16, color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  multilineInput: { minHeight: 72, textAlignVertical: 'top', paddingTop: 14 },
  fileTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  primaryButton: { borderRadius: 999, overflow: 'hidden' },
  primaryGradient: { paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' },
  primaryText: { color: '#08100a', fontWeight: '900', fontSize: 15 },
  exportButton: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.06)' },
  exportButtonText: { color: '#ffffff', fontWeight: '800' },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  reportWeek: { color: '#ffffff', fontWeight: '800', width: 42 },
  reportAmount: { color: '#fff7d6', fontWeight: '900', flex: 1 },
  reportMeta: { color: 'rgba(255,255,255,0.72)', minWidth: 80, textAlign: 'right' },
  insightCard: { borderRadius: 18, padding: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginTop: 10 },
  insightText: { color: '#ffffff', lineHeight: 22 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
});
