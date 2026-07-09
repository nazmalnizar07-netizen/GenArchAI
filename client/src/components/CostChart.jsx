import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#00d4ff', '#a855f7', '#f59e0b', '#10b981', '#ec4899', '#ef4444', '#6366f1', '#14b8a6', '#f97316', '#8b5cf6', '#22c55e', '#e11d48', '#0ea5e9', '#eab308', '#d946ef'];

export default function CostChart({ breakdown = {}, totalCost = 0 }) {
    const data = Object.entries(breakdown)
        .filter(([, val]) => val > 0)
        .map(([key, value]) => ({
            name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            value,
            percentage: ((value / totalCost) * 100).toFixed(1),
        }))
        .sort((a, b) => b.value - a.value);

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

    return (
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={(val) => formatCurrency(val)}
                        contentStyle={{
                            background: 'rgba(15, 15, 42, 0.95)',
                            border: '1px solid rgba(0, 212, 255, 0.3)',
                            borderRadius: '8px',
                            color: '#e8e8f0',
                            fontSize: '13px',
                        }}
                    />
                    <Legend
                        formatter={(value) => <span style={{ color: '#9898b8', fontSize: '11px' }}>{value}</span>}
                        wrapperStyle={{ fontSize: '11px' }}
                    />
                    {/* Center text */}
                    <text
                        x="50%"
                        y="47%"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#e8e8f0"
                        fontFamily="Outfit"
                        fontSize="18"
                        fontWeight="700"
                    >
                        {formatCurrency(totalCost)}
                    </text>
                    <text
                        x="50%"
                        y="57%"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#9898b8"
                        fontFamily="Inter"
                        fontSize="10"
                    >
                        TOTAL COST
                    </text>
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
