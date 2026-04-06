type MetricCardProps = {
  label: string;
  value: string;
};

export function MetricCard(props: MetricCardProps) {
  return (
    <article className="metric-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </article>
  );
}
