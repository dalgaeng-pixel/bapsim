export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatKoreanDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

export function formatTime(date = new Date()) {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function isPastCutoff(cutoffTime = "10:00", now = new Date()) {
  const [cutoffHour, cutoffMinute] = cutoffTime.split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const cutoffMinutes = cutoffHour * 60 + cutoffMinute;
  return currentMinutes >= cutoffMinutes;
}

export function isPastCutoffForDate(dateKey: string, cutoffTime = "10:00", now = new Date()) {
  const today = todayKey(now);

  if (dateKey < today) {
    return true;
  }

  if (dateKey > today) {
    return false;
  }

  return isPastCutoff(cutoffTime, now);
}

export function weekdayIndex(date = new Date()) {
  return date.getDay();
}
