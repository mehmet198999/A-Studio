interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: "blue" | "green" | "yellow" | "red" | "purple";
}

const colorMap = {
  blue: "text-blue-400",
  green: "text-green-400",
  yellow: "text-yellow-400",
  red: "text-red-400",
  purple: "text-purple-400",
};

export default function StatCard({ label, value, sub, color = "blue" }: StatCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colorMap[color]}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}
