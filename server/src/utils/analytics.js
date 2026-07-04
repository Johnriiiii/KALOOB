function toDate(value, fallbackDate) {
  const candidate = value ? new Date(value) : fallbackDate;
  return Number.isNaN(candidate.getTime()) ? fallbackDate : candidate;
}

function formatPeriodLabel(date, range) {
  const safeDate = toDate(date, new Date());
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (range === 'yearly') {
    return `${safeDate.getFullYear()}`;
  }

  if (range === 'quarterly') {
    const quarter = Math.floor(safeDate.getMonth() / 3) + 1;
    return `Q${quarter} ${safeDate.getFullYear()}`;
  }

  if (range === 'monthly') {
    return `${monthNames[safeDate.getMonth()]} ${safeDate.getFullYear()}`;
  }

  return `${monthNames[safeDate.getMonth()]} ${safeDate.getDate()}`;
}

function resolveBucketKey(entry, range) {
  const date = toDate(entry.date, new Date());
  if (range === 'yearly') {
    return `${date.getFullYear()}`;
  }
  if (range === 'quarterly') {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `${date.getFullYear()}-Q${quarter}`;
  }
  if (range === 'monthly') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  return entry.weekLabel || `W${date.getWeek?.() ?? 1}`;
}

function buildSeries(reports, range = 'weekly') {
  const sortedReports = [...(reports ?? [])]
    .map((report, index) => ({
      ...report,
      date: report.date ? new Date(report.date) : new Date(Date.now() - (reports.length - 1 - index) * 7 * 24 * 60 * 60 * 1000),
    }))
    .sort((left, right) => left.date - right.date);

  const buckets = new Map();

  sortedReports.forEach((report, index) => {
    const key = resolveBucketKey(report, range);
    const label = report.weekLabel || formatPeriodLabel(report.date, range);
    const existing = buckets.get(key);

    if (!existing) {
      buckets.set(key, {
        key,
        label,
        donations: Number(report.donation || 0),
        members: Number(report.members || 0),
        date: report.date,
      });
      return;
    }

    existing.donations += Number(report.donation || 0);
    existing.members = Number(report.members || 0);
    existing.label = label;
    existing.date = report.date;
    existing.index = index;
  });

  return Array.from(buckets.values()).map((bucket) => ({
    label: bucket.label,
    donations: bucket.donations,
    members: bucket.members,
    date: bucket.date,
  }));
}

function percentChange(previous, current) {
  if (!previous || previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

function buildRecommendations(donationChange, membershipChange, totalMembers, activeMembers, inactiveMembers) {
  const recommendations = [];

  if (donationChange >= 0) {
    recommendations.push('Continue current engagement strategies.');
  } else {
    recommendations.push('Encourage regular weekly contributions.');
  }

  if (membershipChange >= 0) {
    recommendations.push('Increase promotion of the KALOOB program.');
  } else {
    recommendations.push('Conduct member retention activities.');
  }

  if (activeMembers >= totalMembers * 0.7) {
    recommendations.push('Strengthen awareness campaigns.');
  } else {
    recommendations.push('Re-engage inactive members through parish outreach.');
  }

  if (inactiveMembers > 0) {
    recommendations.push('Support member retention with consistent follow-up.');
  }

  return recommendations.slice(0, 5);
}

function buildInterpretation({ donationChange, membershipChange, newMembers, totalMembers, activeMembers, inactiveMembers }) {
  const donationText = donationChange > 2
    ? `Weekly donations increased by ${donationChange.toFixed(1)}% compared to the previous period, indicating improved participation among KALOOB members.`
    : donationChange < -2
      ? `Weekly donations decreased by ${Math.abs(donationChange).toFixed(1)}% compared to the previous period. Consider increasing member engagement during parish activities.`
      : 'Donation and membership levels remained stable during the reporting period.';

  const membershipText = membershipChange > 2
    ? `Membership increased by ${newMembers} new members during this period, showing positive growth of the KALOOB ministry.`
    : membershipChange < -2
      ? `Membership declined by ${Math.abs(newMembers)} members during this period. Focus on retention and reactivation efforts.`
      : 'Membership levels remained stable during the reporting period.';

  const summary = [donationText, membershipText].join(' ');
  return {
    summary,
    bulletPoints: [
      `${totalMembers} total members currently registered in the chapel.`,
      `${activeMembers} active members and ${inactiveMembers} inactive members are tracked.`,
      `${newMembers >= 0 ? 'New member growth is positive' : 'Member retention requires attention'} in this reporting period.`,
    ],
  };
}

export function buildAnalyticsPayload({ chapel, reports = [], members = [], range = 'weekly' }) {
  const series = buildSeries(reports, range);
  const latest = series.at(-1) ?? { donations: 0, members: 0 };
  const previous = series.at(-2) ?? latest;
  const totalDonations = series.reduce((sum, entry) => sum + (entry.donations || 0), 0);
  const totalMembers = members.length || Number(latest.members || 0);
  const activeMembers = members.filter((member) => member.status === 'Active').length || Math.max(0, Math.round(totalMembers * 0.8));
  const inactiveMembers = Math.max(0, totalMembers - activeMembers);
  const donationChange = percentChange(previous.donations, latest.donations);
  const membershipChange = percentChange(previous.members, latest.members);
  const newMembers = Math.max(0, Number(latest.members || 0) - Number(previous.members || 0));
  const averageWeeklyDonation = series.length > 0 ? totalDonations / series.length : 0;
  const highestDonation = series.reduce((best, entry) => (entry.donations > (best?.donations ?? -Infinity) ? entry : best), null);
  const lowestDonation = series.reduce((best, entry) => (entry.donations < (best?.donations ?? Infinity) ? entry : best), null);

  const recommendations = buildRecommendations(donationChange, membershipChange, totalMembers, activeMembers, inactiveMembers);
  const interpretation = buildInterpretation({ donationChange, membershipChange, newMembers, totalMembers, activeMembers, inactiveMembers });

  return {
    churchId: chapel?.chapelId || 'unknown',
    churchName: chapel?.name || 'KALOOB Chapel',
    range,
    totalMembers,
    activeMembers,
    inactiveMembers,
    weeklyDonations: latest.donations || 0,
    monthlyDonations: series.slice(-4).reduce((sum, entry) => sum + (entry.donations || 0), 0),
    growthPercentage: donationChange,
    donationGrowthPercentage: donationChange,
    membershipGrowthPercentage: membershipChange,
    averageWeeklyDonation,
    highestDonationWeek: highestDonation ? { label: highestDonation.label, amount: highestDonation.donations } : null,
    lowestDonationWeek: lowestDonation ? { label: lowestDonation.label, amount: lowestDonation.donations } : null,
    newMembers,
    series: series.map((entry) => ({
      period: entry.label,
      donations: entry.donations,
      members: entry.members,
      label: entry.label,
    })),
    interpretation: interpretation.summary,
    interpretationBullets: interpretation.bulletPoints,
    recommendations,
    exportData: {
      executiveSummary: [
        `${chapel?.name || 'KALOOB Chapel'} shows ${donationChange >= 0 ? 'positive' : 'mixed'} donation momentum during the selected ${range} period.`,
        `The current ${range} snapshot reflects ${totalMembers} registered members with ${activeMembers} active participants.`,
      ],
      statisticalSummary: [
        `Total donations tracked: ₱${totalDonations.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
        `Average weekly donation: ₱${averageWeeklyDonation.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
        `Highest donation period: ${highestDonation?.label || 'N/A'} (${highestDonation ? `₱${highestDonation.donations.toLocaleString('en-PH')}` : 'N/A'})`,
        `Lowest donation period: ${lowestDonation?.label || 'N/A'} (${lowestDonation ? `₱${lowestDonation.donations.toLocaleString('en-PH')}` : 'N/A'})`,
      ],
      trendAnalysis: [
        `Donation growth: ${donationChange.toFixed(1)}%`,
        `Membership growth: ${membershipChange.toFixed(1)}%`,
        `New members recorded: ${newMembers}`,
      ],
      interpretation: interpretation.bulletPoints,
      recommendations,
    },
  };
}
