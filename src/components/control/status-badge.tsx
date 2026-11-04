import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type ClientStatus } from "@/lib/control/types";

const VARIANT = { trial: "default", active: "success", suspended: "warning", cancelled: "muted" } as const;

export function StatusBadge({ status }: { status: ClientStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
