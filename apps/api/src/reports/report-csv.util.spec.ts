import { buildSalesSummaryCsv } from './report-csv.util.js';
import type { SalesSummary } from './report.service.js';

const SUMMARY: SalesSummary = {
  from: '2026-08-01T00:00:00.000Z',
  to: '2026-08-19T23:59:59.999Z',
  branchId: null,
  totalRevenue: '300000.00',
  orderCount: 3,
  averageOrderAmount: '100000.00',
  returnAmount: '9000.00',
  returnCount: 1,
};

describe('buildSalesSummaryCsv', () => {
  it('толгой мөр + өгөгдлийн мөрийг CRLF-ээр (RFC 4180) буцаана', () => {
    const csv = buildSalesSummaryCsv(SUMMARY);
    const lines = csv.split('\r\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      'Хугацаа (эхлэл),Хугацаа (төгсгөл),Салбар,Нийт орлого,Захиалгын тоо,Дундаж захиалгын дүн,Буцаалтын дүн,Буцаалтын тоо',
    );
    expect(lines[1]).toBe(
      '2026-08-01T00:00:00.000Z,2026-08-19T23:59:59.999Z,Бүх салбар,300000.00,3,100000.00,9000.00,1',
    );
  });

  it('branchId заасан бол тухайн ID-г "Бүх салбар" гэхийн оронд бичнэ', () => {
    const csv = buildSalesSummaryCsv({ ...SUMMARY, branchId: 'branch-1' });
    expect(csv).toContain('branch-1');
    expect(csv).not.toContain('Бүх салбар');
  });

  it('таслал/хашилт агуулсан утгыг RFC 4180-ийн дагуу quote/escape хийнэ', () => {
    const csv = buildSalesSummaryCsv({
      ...SUMMARY,
      branchId: 'Улаанбаатар, "Төв" салбар',
    });
    expect(csv).toContain('"Улаанбаатар, ""Төв"" салбар"');
  });
});
