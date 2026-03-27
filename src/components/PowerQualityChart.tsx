import React, { useMemo, memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, ScatterChart, Scatter, ZAxis } from 'recharts';

const MAX_POINTS = 500;

/**
 * Downsamples data to a maximum number of points to improve rendering performance.
 * Uses a simple sampling approach for efficiency.
 */
function downsample<T>(data: T[] | undefined, maxPoints: number): T[] | undefined {
  if (!data || data.length <= maxPoints) return data;
  
  const factor = Math.ceil(data.length / maxPoints);
  const sampled: T[] = [];
  for (let i = 0; i < data.length; i += factor) {
    sampled.push(data[i]);
  }
  return sampled;
}

interface ChartData {
  name: string;
  value: number;
}

interface HarmonicData {
  order: number;
  value: number;
}

interface ScatterData {
  x: number;
  y: number;
  label?: string;
}

interface Props {
  data?: any[];
  harmonics?: HarmonicData[];
  scatterData?: ScatterData[];
  title?: string;
  scatterTitle?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export const PowerQualityChart: React.FC<Props> = memo(({ data, harmonics, scatterData, title, scatterTitle, xAxisLabel, yAxisLabel }) => {
  const optimizedData = useMemo(() => downsample(data, MAX_POINTS), [data]);
  const optimizedHarmonics = useMemo(() => downsample(harmonics, MAX_POINTS), [harmonics]);
  const optimizedScatter = useMemo(() => downsample(scatterData, MAX_POINTS), [scatterData]);

  const isLargeDataset = useMemo(() => 
    (data?.length || 0) > 100 || (harmonics?.length || 0) > 100 || (scatterData?.length || 0) > 100,
    [data?.length, harmonics?.length, scatterData?.length]
  );

  const getChartHeight = (dataLength: number, type: 'bar' | 'line' | 'scatter' = 'bar') => {
    if (dataLength === 0) return 0;
    return 350;
  };

  const hasData = (optimizedData && optimizedData.length > 0);
  const hasHarmonics = (optimizedHarmonics && optimizedHarmonics.length > 0);
  const hasScatter = (optimizedScatter && optimizedScatter.length > 0);

  if (!hasData && !hasHarmonics && !hasScatter) return (
    <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400 italic">
      Nenhum dado disponível para visualização gráfica.
    </div>
  );

  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

  return (
    <div className="space-y-8 w-full print:space-y-12">
      {hasScatter ? (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm print:shadow-none print:border-none">
          <h4 className="text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider print:text-lg">{scatterTitle || "Relação / Curva de Segurança"}</h4>
          <div style={{ height: getChartHeight(optimizedScatter!.length, 'scatter'), width: '100%', minHeight: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  type="number" 
                  dataKey={Object.keys(optimizedScatter[0]).includes('duration') ? 'duration' : 'x'} 
                  name={xAxisLabel || "Duração / Tensão"} 
                  scale={Object.keys(optimizedScatter[0]).includes('duration') ? 'log' : 'auto'}
                  domain={['auto', 'auto']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                />
                <YAxis 
                  type="number" 
                  dataKey={Object.keys(optimizedScatter[0]).includes('voltage') ? 'voltage' : 'y'} 
                  name={yAxisLabel || "Tensão / Corrente"} 
                  domain={['auto', 'auto']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                />
                <ZAxis type="category" dataKey="label" name="Ponto" />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                  isAnimationActive={false}
                />
                <Scatter 
                  name="Medições" 
                  data={optimizedScatter} 
                  fill="#8884d8" 
                  isAnimationActive={!isLargeDataset}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : hasHarmonics ? (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm print:shadow-none print:border-none">
          <h4 className="text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider print:text-lg">Espectro de Harmônicos (%)</h4>
          <div style={{ height: getChartHeight(optimizedHarmonics!.length, 'bar'), width: '100%', minHeight: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={optimizedHarmonics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="order" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  unit="%"
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  isAnimationActive={false}
                />
                <Bar 
                  dataKey="value" 
                  name="Amplitude (%)"
                  fill="#ef4444" 
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={!isLargeDataset}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : hasData ? (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm print:shadow-none print:border-none">
          <h4 className="text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider print:text-lg">{title || "Análise Temporal"}</h4>
          <div style={{ height: getChartHeight(optimizedData!.length, 'line'), width: '100%', minHeight: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={optimizedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  domain={['auto', 'auto']}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  isAnimationActive={false}
                />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                />
                {Object.keys(optimizedData[0]).filter(k => k !== 'time' && k !== 'name' && k !== 'label' && typeof optimizedData[0][k] === 'number').map((key, index) => (
                  <Line 
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key.toUpperCase()}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={!isLargeDataset}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </div>
  );
});
