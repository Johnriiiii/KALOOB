import { Chapel } from '../types';

export interface ReportData {
  chapel: Chapel;
  weekRange?: string;
  monthRange?: string;
  periodLabel?: string;
  totalDonations: number;
  totalMembers: number;
  averageDonation: number;
  donationGrowth?: number;
  membershipGrowth?: number;
  activeMembers?: number;
  inactiveMembers?: number;
  interpretation: string;
  executiveSummary?: string[];
  statisticalSummary?: string[];
  trendAnalysis?: string[];
  interpretationBullets?: string[];
  recommendations?: string[];
}

export function generateReportInterpretation(data: ReportData): string {
  const {
    chapel,
    periodLabel,
    totalDonations,
    totalMembers,
    averageDonation,
    donationGrowth,
    membershipGrowth,
    activeMembers,
    inactiveMembers,
  } = data;

  const periodText = periodLabel ? `${periodLabel} period` : 'selected reporting period';
  let interpretation = `Chapel: ${chapel.name}\n\n${chapel.name} - ${periodText} overview\n\n`;

  if (totalDonations <= 0) {
    interpretation += `No donations were recorded during the ${periodText}. Review giving activity and outreach opportunities to capture parish support in the next reporting cycle.\n`;
    if (totalMembers > 0) {
      interpretation += `The chapel has ${totalMembers} registered members, so there is potential to increase giving through targeted engagement and stewardship communication.\n`;
    }
    return interpretation;
  }

  interpretation += `During this ${periodText}, ${chapel.name} recorded ₱${totalDonations.toLocaleString('en-PH', { minimumFractionDigits: 2 })} in donations from ${totalMembers} registered members, averaging ₱${averageDonation.toLocaleString('en-PH', { minimumFractionDigits: 2 })} per member. `;

  if (typeof donationGrowth === 'number') {
    if (donationGrowth > 0) {
      interpretation += `Donations increased by ${donationGrowth.toFixed(1)}% compared to the previous period, showing positive momentum and stronger giving behavior. `;
    } else if (donationGrowth < 0) {
      interpretation += `Donations decreased by ${Math.abs(donationGrowth).toFixed(1)}% compared to the previous period, suggesting a need to re-engage donors and renew outreach efforts. `;
    } else {
      interpretation += `Donation levels were stable compared to the previous period, indicating consistent support from the chapel community. `;
    }
  }

  if (typeof membershipGrowth === 'number') {
    if (membershipGrowth > 0) {
      interpretation += `Membership grew by ${membershipGrowth.toFixed(1)}%, reflecting healthy member engagement and successful parish outreach. `;
    } else if (membershipGrowth < 0) {
      interpretation += `Membership declined by ${Math.abs(membershipGrowth).toFixed(1)}%, which may warrant additional pastoral care and retention activities. `;
    } else {
      interpretation += `Membership remained stable during the reporting period, supporting consistent participation levels. `;
    }
  }

  if (typeof activeMembers === 'number' && typeof inactiveMembers === 'number') {
    interpretation += `There are ${activeMembers} active members and ${inactiveMembers} inactive or less active members, which suggests opportunities to deepen engagement among the quieter segment of the community. `;
  }

  if (averageDonation >= 1000) {
    interpretation += `The average donation level is strong, which supports the chapel’s financial health and ability to sustain programs.\n`;
  } else if (averageDonation >= 500) {
    interpretation += `Average donations are moderate, signaling steady support with room to grow through targeted stewardship campaigns.\n`;
  } else {
    interpretation += `Average donations are below the chapel’s potential; consider enhancing giving education and parish communication to encourage more regular contributions.\n`;
  }

  interpretation += `\nRecommendations:\n`;
  interpretation += `• Continue building member relationships through small-group engagement and regular stewardship reminders.\n`;
  interpretation += `• Highlight the impact of giving during parish activities to encourage consistent support.\n`;
  interpretation += `• Track donation and membership trends weekly to identify early changes in parish participation.\n`;

  return interpretation;
}

export function exportToCSV(data: ReportData): string {
  const separator = '-------------------------------------------------------------';
  const now = new Date().toLocaleString('en-PH');
  const interpretationLines = (data.interpretation || 'AI interpretation unavailable.').split(/\r?\n/).filter(Boolean);
  const recommendationLines = (data.recommendations?.length ? data.recommendations : [
    'Continue stewardship programs.',
    'Encourage regular weekly donations.',
    'Monitor donation trends monthly.',
  ]).map((item) => `• ${item}`);

  let csv = separator + '\n';
  csv += '                         KALOOB\n';
  csv += '             DONATION SUMMARY REPORT\n';
  csv += separator + '\n\n';
  csv += 'Chapel: ' + data.chapel.name + '\n';
  csv += 'Generated: ' + now + '\n\n';
  csv += separator + '\n';
  csv += '                  FINANCIAL OVERVIEW\n';
  csv += separator + '\n\n';
  csv += `Total Donations: ₱${data.totalDonations.toLocaleString('en-PH', { minimumFractionDigits: 2 })}\n`;
  csv += `Registered Members: ${data.totalMembers}\n`;
  csv += `Average Donation: ₱${data.averageDonation.toLocaleString('en-PH', { minimumFractionDigits: 2 })}\n\n`;
  csv += separator + '\n';
  csv += 'AI INTERPRETATION\n';
  csv += separator + '\n\n';
  csv += interpretationLines.join('\n') + '\n\n';
  csv += separator + '\n';
  csv += 'RECOMMENDATIONS\n';
  csv += separator + '\n\n';
  csv += recommendationLines.join('\n') + '\n\n';
  csv += separator + '\n';
  csv += 'Generated by KALOOB Donation Management System\n';
  csv += 'This is a computer-generated report.\n';
  csv += separator + '\n';

  return csv;
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

async function captureElementAsCanvas(element: HTMLElement) {
  const html2canvasModule = await import('html2canvas');
  const html2canvas = (html2canvasModule as any).default ?? html2canvasModule;

  return html2canvas(element, {
    scale: 2,
    backgroundColor: '#faf7f2',
    useCORS: true,
  });
}

export async function downloadChartImage(filename: string, element: HTMLElement) {
  try {
    const canvas = await captureElementAsCanvas(element);
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('Chart image export failed:', err);
    alert('Chart export failed. Please try again.');
  }
}

export async function downloadPDF(filename: string, element: HTMLElement) {
  try {
    const { jsPDF } = await import('jspdf');
    const canvas = await captureElementAsCanvas(element);

    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' }) as any;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
    const renderedWidth = imgWidth * ratio;
    const renderedHeight = imgHeight * ratio;
    const x = (pageWidth - renderedWidth) / 2;
    const y = (pageHeight - renderedHeight) / 2;

    doc.addImage(imgData, 'PNG', x, y, renderedWidth, renderedHeight);
    doc.save(filename);
  } catch (err) {
    console.error('PDF generation failed:', err);
    alert('PDF export failed. Please try again.');
  }
}

export async function downloadExcel(filename: string, data: ReportData) {
  try {
    const XLSX = await import('xlsx');
    const separator = '-------------------------------------------------------------';
    const now = new Date().toLocaleString('en-PH');

    const interpretationLines = (data.interpretation || 'AI interpretation unavailable.').split(/\r?\n/).filter(Boolean);
    const sections = [
      [separator],
      ['KALOOB'],
      ['DONATION SUMMARY REPORT'],
      [separator],
      ['Chapel', data.chapel.name],
      ['Generated', now],
      [''],
      ['Executive Summary'],
      ...(data.executiveSummary ?? ['Automated summary unavailable.']).map((line) => [line]),
      [''],
      ['Statistical Summary'],
      ...(data.statisticalSummary ?? []).map((line) => [line]),
      [''],
      ['Trend Analysis'],
      ...(data.trendAnalysis ?? []).map((line) => [line]),
      [''],
      ['AI Interpretation'],
      ...interpretationLines.map((line) => [line]),
      [''],
      ['Recommendations'],
      ...(data.recommendations ?? []).map((line) => [line]),
      [''],
      ['Generated by KALOOB Donation Management System'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sections);
    ws['!cols'] = [{ wch: 80 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, filename);
  } catch (err) {
    console.error('Excel generation failed. Please install xlsx.', err);
    alert('Excel export requires xlsx library. Using CSV instead.');
  }
}
