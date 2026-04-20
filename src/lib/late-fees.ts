/**
 * Late fee calculation logic.
 *
 * Rules:
 * - Rent is due on the 1st of every month (configurable per lease)
 * - No grace period by default (configurable per lease)
 * - $10/day late fee starting the day after the grace period ends
 * - Late fees accrue until rent is paid
 */

/**
 * Calculate the late fee for a given period.
 * @param period - "YYYY-MM" format
 * @param rentPaidAt - Date rent was paid, or null if unpaid
 * @param lateFeePerDay - Dollar amount per day (default $10)
 * @param rentDueDay - Day of month rent is due (default 1)
 * @param gracePeriodDays - Number of grace days (default 0)
 * @returns The total late fee amount
 */
export function calculateLateFee({
  period,
  rentPaidAt,
  lateFeePerDay = 10,
  rentDueDay = 1,
  gracePeriodDays = 0,
}: {
  period: string;
  rentPaidAt: Date | null;
  lateFeePerDay?: number;
  rentDueDay?: number;
  gracePeriodDays?: number;
}): number {
  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-indexed

  // Due date for this period
  const dueDate = new Date(year, month - 1, rentDueDay);

  // Late fees start accruing after the grace period
  const lateFeeStartDate = new Date(dueDate);
  lateFeeStartDate.setDate(lateFeeStartDate.getDate() + gracePeriodDays + 1);

  // End date: either when rent was paid or today (whichever is earlier)
  const now = new Date();
  const endDate = rentPaidAt && rentPaidAt < now ? rentPaidAt : now;

  // If the end date is before late fees start, no late fee
  if (endDate <= lateFeeStartDate) {
    return 0;
  }

  // Don't charge late fees for future periods
  if (dueDate > now) {
    return 0;
  }

  // Calculate number of late days
  const msPerDay = 1000 * 60 * 60 * 24;
  const lateDays = Math.floor(
    (endDate.getTime() - lateFeeStartDate.getTime()) / msPerDay
  );

  if (lateDays <= 0) return 0;

  return Math.round(lateDays * lateFeePerDay * 100) / 100;
}

/**
 * Get the current period string (YYYY-MM) for today.
 */
export function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Format a period string to a human-readable month/year.
 */
export function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
