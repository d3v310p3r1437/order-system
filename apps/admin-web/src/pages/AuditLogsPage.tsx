import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AUDIT_LOG_VIEW_ROLES } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("mn-MN");
}

// §Даалгавар #9: аудит логийн (зөвхөн унших) UI — ReportsPage-ийн
// ерөнхий загварыг (шүүлт + Card доторх агуулга) дахин ашигласан, гэхдээ
// chart/CSV export зохиогоогүй (§Даалгаврын шууд зааврын хамрах хүрээнд
// ОРООГҮЙ). Зөвхөн 3 глобал-эрхийн дүрд харагдана (roles.ts-ийн
// AUDIT_LOG_VIEW_ROLES-ийн тайлбарыг үз).
export function AuditLogsPage() {
  const { accessToken, hasRole } = useAuth();
  const canView = hasRole(AUDIT_LOG_VIEW_ROLES);

  const [tableName, setTableName] = useState("");
  const [action, setAction] = useState("");
  const [recordId, setRecordId] = useState("");

  const auditLogsQuery = useQuery({
    queryKey: ["audit-logs", tableName, action, recordId],
    queryFn: () =>
      getAuditLogs(accessToken, {
        tableName: tableName || undefined,
        action: action || undefined,
        recordId: recordId || undefined,
      }),
    enabled: canView,
  });

  if (!canView) {
    return (
      <p className="text-sm text-muted-foreground">
        Энэ хуудсыг харах эрхгүй байна.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Аудит лог</h1>
        <p className="text-sm text-muted-foreground">
          Хэн, хэзээ, аль хүснэгтэд ямар өөрчлөлт хийсэн бэ (сүүлийн 50 мөр,
          шүүж болно).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="audit-table-name">Хүснэгт</Label>
          <Input
            id="audit-table-name"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="жиш: orders, coupons"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-action">Үйлдэл</Label>
          <Input
            id="audit-action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="жиш: staff.created"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-record-id">Мөрийн ID</Label>
          <Input
            id="audit-record-id"
            value={recordId}
            onChange={(e) => setRecordId(e.target.value)}
            placeholder="UUID"
          />
        </div>
      </div>

      <Card>
        <CardContent>
          {auditLogsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>
          )}
          {auditLogsQuery.isError && (
            <p className="text-sm text-destructive">
              Аудит логийн мэдээлэл татахад алдаа гарлаа.
            </p>
          )}
          {auditLogsQuery.isSuccess && auditLogsQuery.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Энэ шүүлтүүрт тохирох аудит лог алга.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Огноо</th>
                  <th className="py-2 pr-3 font-medium">Хэрэглэгч</th>
                  <th className="py-2 pr-3 font-medium">Үйлдэл</th>
                  <th className="py-2 pr-3 font-medium">Хүснэгт</th>
                  <th className="py-2 font-medium">Мөрийн ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(auditLogsQuery.data ?? []).map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap py-2 pr-3 text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {row.userId ?? "—"}
                    </td>
                    <td className="py-2 pr-3">{row.action}</td>
                    <td className="py-2 pr-3">{row.tableName}</td>
                    <td className="py-2 font-mono text-xs">{row.recordId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
