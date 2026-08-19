import type { SalesSummary } from './report.service.js';

// Гуравдагч сангаас (жиш: exceljs, csv-writer) хамааралгүй, зорилтот
// CSV-ийн энгийн бүтэц (RFC 4180-ийн quote/escape дүрмийг л дагасан)
// хангалттай тул гараар бичив — §Даалгавар #5-ийн "аль хялбарыг эхлээд
// хэрэгжүүлэхээ" гэсэн зөвлөмжийн дагуу.
function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: (string | number)[]): string {
  return fields.map(escapeCsvField).join(',');
}

const SALES_SUMMARY_HEADERS = [
  'Хугацаа (эхлэл)',
  'Хугацаа (төгсгөл)',
  'Салбар',
  'Нийт орлого',
  'Захиалгын тоо',
  'Дундаж захиалгын дүн',
  'Буцаалтын дүн',
  'Буцаалтын тоо',
];

// Excel (Windows)-д Cyrillic толгой мөр зөв харагдахын тулд UTF-8 BOM
// заавал урд нь тавина (report.controller.ts-ийн exportSalesSummary()-г үз).
export function buildSalesSummaryCsv(summary: SalesSummary): string {
  const rows = [
    toCsvRow(SALES_SUMMARY_HEADERS),
    toCsvRow([
      summary.from,
      summary.to,
      summary.branchId ?? 'Бүх салбар',
      summary.totalRevenue,
      summary.orderCount,
      summary.averageOrderAmount,
      summary.returnAmount,
      summary.returnCount,
    ]),
  ];
  return rows.join('\r\n');
}
