
export const formatMessageTime = (date: Date | string | number) => {
  if (!date) return '';

  // Persisted timestamps come back from localStorage as ISO strings,
  // so always normalize to a Date before reading methods off it.
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';

  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return dateObj.toLocaleDateString([], { weekday: 'short' });
  } else {
    return dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};
