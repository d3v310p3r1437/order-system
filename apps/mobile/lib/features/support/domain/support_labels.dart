/// `apps/admin-web/src/lib/support-status.ts`-тэй ЯГ ижил монгол орчуулга —
/// `SupportTicketCategory`/`SupportTicketStatus` enum утга бүрд.
const supportCategoryLabels = <String, String>{
  'ORDER_ISSUE': 'Захиалгын асуудал',
  'PAYMENT_ISSUE': 'Төлбөрийн асуудал',
  'DELIVERY_ISSUE': 'Хүргэлтийн асуудал',
  'PRODUCT_QUESTION': 'Бүтээгдэхүүний асуулт',
  'ACCOUNT_ISSUE': 'Хэрэглэгчийн эрхийн асуудал',
  'OTHER': 'Бусад',
};

const supportStatusLabels = <String, String>{
  'OPEN': 'Нээлттэй',
  'IN_PROGRESS': 'Шийдвэрлэж байгаа',
  'RESOLVED': 'Шийдэгдсэн',
  'CLOSED': 'Хаагдсан',
};
