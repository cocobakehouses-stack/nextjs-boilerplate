export async function fetchHistoryRange(
  spreadsheetId: string,
  tabTitle: string,
  startDate: string,
  endDate: string
): Promise<HistoryRow[]> {
  // ... auth logic ...
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${a1Sheet(tabTitle)}!A:M`, // Range extended to M
  });

  const rows = res.data.values || [];
  const data = rows.slice(1);

  return data.map((r: any[]) => ({
    date: (r?.[0] ?? '').toString().trim(),
    time: (r?.[1] ?? '').toString().trim(),
    billNo: (r?.[2] ?? '').toString().trim(),
    items: (r?.[3] ?? '').toString().trim(),
    freebies: (r?.[4] ?? '').toString().trim(),
    totalQty: parseNumberCell(r?.[5]),
    payment: (r?.[6] ?? '').toString().trim(),
    total: parseNumberCell(r?.[7]),
    freebiesAmount: parseNumberCell(r?.[8]),
    // J=9, K=10, L=11, so Status is M=12
    status: (r?.[12] ?? '').toString().trim(), 
  })).filter((r) => r.date >= startDate && r.date <= endDate);
}
