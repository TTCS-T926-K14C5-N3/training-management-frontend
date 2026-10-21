export const PERIODS_PER_CREDIT = 15;
export const PERIODS_PER_SESSION = 5;
export const MINUTES_PER_PERIOD = 45;
export const BREAK_MINUTES = 5;

export const sessionsForCredits = (value: string): string => {
  const credits = Number(value);
  if (!Number.isInteger(credits) || credits < 1 || credits > 30) return "";
  return String(
    (credits * PERIODS_PER_CREDIT) / PERIODS_PER_SESSION,
  );
};

export const SESSION_DURATION_MINUTES =
  PERIODS_PER_SESSION * MINUTES_PER_PERIOD +
  (PERIODS_PER_SESSION - 1) * BREAK_MINUTES;

export const SESSION_WORKLOAD_HINT =
  `Mỗi tín chỉ gồm ${PERIODS_PER_CREDIT} tiết; mỗi buổi ${PERIODS_PER_SESSION} tiết ` +
  `(${MINUTES_PER_PERIOD} phút/tiết, nghỉ ${BREAK_MINUTES} phút giữa các tiết).`;
