import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';

export default function ScoreRadar({ scores = {} }) {
    const data = [
        { subject: 'Budget', value: scores.budget || 0, fullMark: 100 },
        { subject: 'Luxury', value: scores.luxury || 0, fullMark: 100 },
        { subject: 'Sustainability', value: scores.sustainability || 0, fullMark: 100 },
        { subject: 'Efficiency', value: scores.spaceEfficiency || 0, fullMark: 100 },
    ];

    return (
        <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
                <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="#000" strokeWidth={2} />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: '#000', fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 800 }}
                    />
                    <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={{ fill: '#000', fontSize: 10, fontWeight: 800 }}
                        tickCount={5}
                    />
                    <Tooltip
                        contentStyle={{
                            background: '#fff',
                            border: '2px solid #000',
                            borderRadius: '0',
                            color: '#000',
                            fontSize: '13px',
                            fontWeight: 800,
                            fontFamily: 'var(--font-mono)',
                            boxShadow: '4px 4px 0 0 #000'
                        }}
                    />
                    <Radar
                        name="Score"
                        dataKey="value"
                        stroke="#000"
                        fill="var(--accent-yellow)"
                        fillOpacity={0.8}
                        strokeWidth={3}
                    />
                    <defs>
                        <linearGradient id="radarGrad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="var(--accent-yellow)" stopOpacity={1} />
                            <stop offset="100%" stopColor="var(--accent-green)" stopOpacity={1} />
                        </linearGradient>
                    </defs>
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
