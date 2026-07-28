import React, { useState } from 'react';
import { SkeletonCard } from '../ui/Skeleton';
import { PieChart, List as ListIcon, MapPin, Tag } from 'lucide-react';

export default function InventoryBreakdown({ breakdown, breakdownByLocation, loading }) {
  const [activeTab, setActiveTab] = useState('category'); // 'category' | 'location'

  if (loading) {
    return <SkeletonCard />;
  }

  const data = activeTab === 'category' ? breakdown : breakdownByLocation;
  const totalItems = data.reduce((sum, item) => sum + item.count, 0);

  // SVG Donut Chart properties
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  // Simple color palette for locations
  const locationColors = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6'];

  const chartSegments = data.map((item, index) => {
    const percentage = item.count / totalItems;
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const strokeDashoffset = -currentOffset;
    currentOffset += percentage * circumference;

    return {
      ...item,
      color: activeTab === 'category' ? item.color : locationColors[index % locationColors.length],
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="bg-surface rounded-2xl border border-border/80 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-border/60 flex items-center justify-between">
        <h2 className="text-base font-bold text-primary flex items-center gap-2">
          <PieChart className="w-4.5 h-4.5 text-accent" />
          <span>Inventory Overview</span>
        </h2>
        
        {/* Toggle Category/Location */}
        <div className="flex bg-base border border-border rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab('category')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
              activeTab === 'category' ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
            }`}
          >
            <Tag className="w-3 h-3" />
            <span>Category</span>
          </button>
          <button
            onClick={() => setActiveTab('location')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
              activeTab === 'location' ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
            }`}
          >
            <MapPin className="w-3 h-3" />
            <span>Location</span>
          </button>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        {totalItems === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-secondary py-10">
            <PieChart className="w-10 h-10 mb-3 opacity-20" />
            <span className="text-sm">No inventory data available</span>
          </div>
        ) : (
          <>
            {/* SVG Donut Chart */}
            <div className="relative flex justify-center mb-6">
              <svg width={size} height={size} className="transform -rotate-90">
                {chartSegments.map((segment, i) => (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="transparent"
                    stroke={segment.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={segment.strokeDasharray}
                    strokeDashoffset={segment.strokeDashoffset}
                    strokeLinecap={chartSegments.length === 1 ? 'round' : 'butt'}
                    className="transition-all duration-1000 ease-out hover:opacity-80 cursor-pointer"
                  >
                    <title>{segment.name}: {segment.count} ({segment.percentage}%)</title>
                  </circle>
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-primary">{totalItems}</span>
                <span className="text-xs font-medium text-secondary uppercase tracking-wider">Total</span>
              </div>
            </div>

            {/* Custom Legend */}
            <div className="space-y-3 mt-auto">
              {chartSegments.map((segment, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-3 h-3 rounded-full shadow-sm" 
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="text-sm font-medium text-primary group-hover:text-accent transition-colors">
                      {segment.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-secondary font-mono">{segment.count}</span>
                    <span className="text-secondary/60 w-9 text-right">{segment.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
