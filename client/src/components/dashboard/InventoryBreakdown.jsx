import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkeletonCard } from '../ui/Skeleton';
import SegmentedControl from '../ui/SegmentedControl';
import Card from '../ui/Card';
import Pill from '../ui/Pill';
import { resolveColor } from '../../utils/color';
import { PieChart, ArrowRight } from 'lucide-react';

export default function InventoryBreakdown({ 
  breakdown = [], 
  breakdownByLocation = [], 
  breakdownByStatus = [], 
  breakdownByWarranty = [], 
  loading 
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('category'); // 'category' | 'location' | 'status' | 'warranty'
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (loading) {
    return <SkeletonCard />;
  }

  const dataMap = {
    category: breakdown,
    location: breakdownByLocation,
    status: breakdownByStatus,
    warranty: breakdownByWarranty,
  };

  const data = dataMap[activeTab] || [];
  const totalItems = data.reduce((sum, item) => sum + item.count, 0);

  // SVG Donut Chart properties
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const baseStrokeWidth = 24;
  const radius = (size - baseStrokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  const chartSegments = data.map((item) => {
    const percentage = totalItems > 0 ? item.count / totalItems : 0;
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const strokeDashoffset = -currentOffset;
    currentOffset += percentage * circumference;

    return {
      ...item,
      // Category colours can be names ("Emerald") that SVG can't paint.
      color: resolveColor(item.color, '#64748B'),
      strokeDasharray,
      strokeDashoffset,
    };
  });

  // Buckets with no inventory filter (e.g. Uncategorized) are not links.
  const isLinkable = (segment) => Boolean(segment?.filterKey) && segment.filterValue !== undefined;

  const handleNavigateToInventory = (segment) => {
    if (!isLinkable(segment)) return;
    const url = `/inventory?${segment.filterKey}=${encodeURIComponent(segment.filterValue)}`;
    navigate(url);
  };

  const hoveredItem = hoveredIndex !== null && chartSegments[hoveredIndex] ? chartSegments[hoveredIndex] : null;

  return (
    <Card className="h-full">
      {/* Header */}
      <div className="px-3 py-4 sm:p-5 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-base font-bold text-primary flex items-center gap-2">
          <PieChart className="w-4.5 h-4.5 text-accent" />
          <span>Inventory Overview</span>
        </h2>
        
        {/* Toggle Category/Location/Status/Warranty */}
        <SegmentedControl
          label="Group inventory by"
          size="sm"
          className="self-start sm:self-auto"
          value={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
            setHoveredIndex(null);
          }}
          // No icons: all four labels then fit a phone screen without scrolling.
          options={[
            { value: 'category', label: 'Category' },
            { value: 'location', label: 'Location' },
            { value: 'status', label: 'Status' },
            { value: 'warranty', label: 'Warranty' },
          ]}
        />
      </div>

      <div className="p-5 flex-1 flex flex-col">
        {totalItems === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-secondary py-10">
            <PieChart className="w-10 h-10 mb-3 opacity-20" />
            <span className="text-sm">No inventory data available</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center flex-1">
            {/* SVG Donut Chart with Hover Center Tooltip */}
            <div className="md:col-span-5 flex justify-center relative my-2">
              <div className="relative w-full max-w-[200px]">
                <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto transform -rotate-90">
                  {chartSegments.map((segment, i) => {
                    const isHovered = hoveredIndex === i;
                    const isAnyHovered = hoveredIndex !== null;
                    const opacity = isAnyHovered ? (isHovered ? 1 : 0.3) : 1;
                    const strokeW = isHovered ? baseStrokeWidth + 4 : baseStrokeWidth;

                    return (
                      <circle
                        key={i}
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill="transparent"
                        stroke={segment.color}
                        strokeWidth={strokeW}
                        strokeDasharray={segment.strokeDasharray}
                        strokeDashoffset={segment.strokeDashoffset}
                        strokeLinecap={chartSegments.length === 1 ? 'round' : 'butt'}
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => handleNavigateToInventory(segment)}
                        style={{ opacity, transition: 'all 0.2s ease-in-out' }}
                        className={isLinkable(segment) ? 'cursor-pointer' : undefined}
                      >
                        <title>{segment.name}: {segment.count} ({segment.percentage}%)</title>
                      </circle>
                    );
                  })}
                </svg>

                {/* Donut Center Display & Hover Tooltip */}
                {hoveredItem ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-3 text-center transition-all duration-200">
                    <span className="text-xs font-semibold text-primary truncate max-w-[130px]" title={hoveredItem.name}>
                      {hoveredItem.name}
                    </span>
                    <span className="text-2xl font-extrabold text-primary my-0.5">
                      {hoveredItem.count}
                    </span>
                    <Pill tone="accent" size="md">
                      {hoveredItem.percentage}%
                    </Pill>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-all duration-200">
                    <span className="text-3xl font-bold text-primary">{totalItems}</span>
                    <span className="text-xs font-medium text-secondary uppercase tracking-wider">Total</span>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Interactive Legend */}
            <div className="md:col-span-7 space-y-2">
              {chartSegments.map((segment, i) => {
                const isHovered = hoveredIndex === i;
                const isAnyHovered = hoveredIndex !== null;
                const opacityClass = isAnyHovered ? (isHovered ? 'opacity-100' : 'opacity-40') : 'opacity-100';
                const linkable = isLinkable(segment);

                return (
                  <div 
                    key={i} 
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={linkable ? () => handleNavigateToInventory(segment) : undefined}
                    role={linkable ? 'link' : undefined}
                    tabIndex={linkable ? 0 : undefined}
                    onKeyDown={linkable ? (e) => { if (e.key === 'Enter') handleNavigateToInventory(segment); } : undefined}
                    onFocus={() => setHoveredIndex(i)}
                    onBlur={() => setHoveredIndex(null)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border border-transparent transition-all group ${linkable ? 'cursor-pointer' : ''} ${opacityClass} ${
                      isHovered ? 'bg-raised border-border/80 shadow-sm scale-[1.01]' : 'hover:bg-raised/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div 
                        className="w-3 h-3 rounded-full shadow-sm shrink-0 ring-1 ring-black/10 dark:ring-white/20 transition-transform group-hover:scale-125" 
                        style={{ backgroundColor: segment.color }}
                      />
                      <span className="text-sm font-medium text-primary group-hover:text-accent transition-colors truncate">
                        {segment.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-sm shrink-0">
                      <span className="text-primary font-semibold font-mono">{segment.count}</span>
                      <span className="text-secondary w-10 text-right font-medium">{segment.percentage}%</span>
                      {linkable
                        ? <ArrowRight className="w-3.5 h-3.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                        : <span className="w-3.5 ml-1" aria-hidden="true" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

