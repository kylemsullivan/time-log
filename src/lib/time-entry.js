const TYPED_TIME = /^(\d{1,2})(?::?(\d{2}))?\s*([ap])?\.?m?\.?$/;
const pad = (value) => String(value).padStart(2, '0');

// Parses a typed time into "HH:MM". Accepts "9", "930", "9:30", "1415", "9a", "5pm", "12:30 p".
// Returns '' for blank input and null when the text isn't a time.
export function parseTime(text) {
  const value = String(text ?? '').trim().toLowerCase();
  if (!value) return '';
  const match = TYPED_TIME.exec(value);
  if (!match) return null;
  const [, digits, explicitMinutes, meridiem] = match;
  let hours;
  let minutes;
  if (explicitMinutes !== undefined) {
    hours = Number(digits);
    minutes = Number(explicitMinutes);
  } else if (value.includes(':') || digits.length <= 2) {
    hours = Number(digits);
    minutes = 0;
  } else {
    return null;
  }
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === 'p' ? 12 : 0);
  }
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}
