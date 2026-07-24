import React from 'react';
import { Link } from 'react-router-dom';
import Badge from '../ui/Badge';
import { Edit2, Trash2, Box, ArrowRight } from 'lucide-react';

export default function CategoryCard({ category, onEdit, onDelete }) {
  const assetCount = category.assetCount || 0;

  return (
    <div className="bg-surface/80 border border-border/60 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all hover:bg-surface hover:border-border">
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <Badge 
              badgeChar={category.badgeChar} 
              color={category.color} 
              className="!w-10 !h-10 !text-sm"
            />
            <div>
              <h4 className="text-lg font-bold text-primary">{category.name}</h4>
              <p className="text-xs text-secondary font-mono mt-0.5">ID: {category.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(category)}
              className="p-1.5 rounded-lg text-secondary hover:text-accent hover:bg-raised transition-colors"
              title="Edit Category"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(category)}
              className="p-1.5 rounded-lg text-secondary hover:text-danger hover:bg-raised transition-colors"
              title="Delete Category"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-sm text-secondary line-clamp-2 min-h-[40px] mb-5">
          {category.description || 'No description provided for this category.'}
        </p>

        <div className="flex items-center gap-2 p-3 bg-base/50 rounded-xl border border-border/50 mb-5">
          <Box className="w-4 h-4 text-secondary" />
          <span className="text-sm font-medium text-primary">{assetCount}</span>
          <span className="text-xs text-secondary">Total Assets</span>
        </div>
      </div>

      <Link
        to={`/inventory?categoryId=${category.id}`}
        className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-raised/50 hover:bg-accent text-primary hover:text-white text-sm font-semibold transition-colors cursor-pointer"
      >
        <span>View Inventory</span>
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
