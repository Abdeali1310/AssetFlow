import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "MMM d, yyyy")
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "MMM d, yyyy 'at' h:mm a")
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function generateReference(prefix: string, count: number): string {
  return `${prefix}-${String(count + 1).padStart(4, "0")}`
}

export function getStatusColor(status: string): {
  bg: string
  text: string
  dot: string
} {
  const statusMap: Record<string, { bg: string; text: string; dot: string }> = {
    // Success states (green) - architecture.md 7.2
    available: { bg: "bg-success/10", text: "text-success", dot: "bg-success" },
    verified: { bg: "bg-success/10", text: "text-success", dot: "bg-success" },
    resolved: { bg: "bg-success/10", text: "text-success", dot: "bg-success" },
    approved: { bg: "bg-success/10", text: "text-success", dot: "bg-success" },
    done: { bg: "bg-success/10", text: "text-success", dot: "bg-success" },

    // Primary states (teal)
    allocated: { bg: "bg-primary/10", text: "text-primary", dot: "bg-primary" },
    in_progress: {
      bg: "bg-primary/10",
      text: "text-primary",
      dot: "bg-primary",
    },
    active: { bg: "bg-primary/10", text: "text-primary", dot: "bg-primary" },
    ongoing: { bg: "bg-primary/10", text: "text-primary", dot: "bg-primary" },

    // Warning states (amber)
    reserved: { bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" },
    upcoming: { bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" },
    pending: { bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" },
    under_maintenance: {
      bg: "bg-warning/10",
      text: "text-warning",
      dot: "bg-warning",
    },
    requested: {
      bg: "bg-warning/10",
      text: "text-warning",
      dot: "bg-warning",
    },
    technician_assigned: {
      bg: "bg-warning/10",
      text: "text-warning",
      dot: "bg-warning",
    },
    draft: { bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" },

    // Destructive states (red)
    lost: {
      bg: "bg-destructive/10",
      text: "text-destructive",
      dot: "bg-destructive",
    },
    rejected: {
      bg: "bg-destructive/10",
      text: "text-destructive",
      dot: "bg-destructive",
    },
    missing: {
      bg: "bg-destructive/10",
      text: "text-destructive",
      dot: "bg-destructive",
    },
    overdue: {
      bg: "bg-destructive/10",
      text: "text-destructive",
      dot: "bg-destructive",
    },
    cancelled: {
      bg: "bg-destructive/10",
      text: "text-destructive",
      dot: "bg-destructive",
    },
    damaged: {
      bg: "bg-destructive/10",
      text: "text-destructive",
      dot: "bg-destructive",
    },

    // Muted states (gray)
    retired: {
      bg: "bg-muted",
      text: "text-muted-foreground",
      dot: "bg-muted-foreground",
    },
    disposed: {
      bg: "bg-muted",
      text: "text-muted-foreground",
      dot: "bg-muted-foreground",
    },
    completed: {
      bg: "bg-muted",
      text: "text-muted-foreground",
      dot: "bg-muted-foreground",
    },
    inactive: {
      bg: "bg-muted",
      text: "text-muted-foreground",
      dot: "bg-muted-foreground",
    },
    returned: {
      bg: "bg-muted",
      text: "text-muted-foreground",
      dot: "bg-muted-foreground",
    },
    closed: {
      bg: "bg-muted",
      text: "text-muted-foreground",
      dot: "bg-muted-foreground",
    },
  }

  return (
    statusMap[status] ?? {
      bg: "bg-muted",
      text: "text-muted-foreground",
      dot: "bg-muted-foreground",
    }
  )
}
