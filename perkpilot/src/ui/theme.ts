export const colors = {
  bg: '#0B1220',
  surface: '#141C2E',
  surfaceAlt: '#1B2740',
  border: '#26344F',
  text: '#F2F5FA',
  textDim: '#9AA7BD',
  primary: '#4C8DFF',
  // Traffic-light urgency for the Value-at-Risk dashboard.
  red: '#FF5D5D',
  amber: '#FFB020',
  green: '#34C77B',
};

export const urgencyColor = (u: 'red' | 'amber' | 'green'): string =>
  u === 'red' ? colors.red : u === 'amber' ? colors.amber : colors.green;

export const space = (n: number) => n * 4;

export const radius = { sm: 8, md: 12, lg: 16 };
