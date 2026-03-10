import { Card } from "flowbite-react";

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
    <Card className="bg-gray-900 border-gray-800 shadow-none">
      <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${colorMap[color]}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs">{sub}</p>}
    </Card>
  );
}
