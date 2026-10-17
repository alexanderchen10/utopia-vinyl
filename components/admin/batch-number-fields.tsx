const months = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];
const batches = Array.from({ length: 99 }, (_, index) =>
  String(index + 1).padStart(2, '0'),
);

export function currentBatchNumber() {
  return `${months[new Date().getMonth()]}-B01`;
}

export function BatchNumberFields({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const match = value.match(/^([A-Z]{3})-B(\d{2})$/);
  const month = match?.[1] ?? months[new Date().getMonth()];
  const batch = match?.[2] ?? '01';
  const setPart = (nextMonth: string, nextBatch: string) =>
    onChange(`${nextMonth}-B${nextBatch}`);

  return (
    <div className="batch-number-controls">
      <label>
        <span>月份</span>
        <select
          aria-label="批次月份"
          onChange={(event) => setPart(event.target.value, batch)}
          value={month}
        >
          {months.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label>
        <span>批次</span>
        <select
          aria-label="批次序號"
          onChange={(event) => setPart(month, event.target.value)}
          value={batch}
        >
          {batches.map((item) => <option key={item} value={item}>B{item}</option>)}
        </select>
      </label>
      <strong aria-label="完整批次編號">{month}-B{batch}</strong>
    </div>
  );
}
