import React, { useState, useEffect } from 'react';
import { Plus, Tags } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCategories, createCategory, updateCategory, deleteCategoryApi } from '../../api/categoriesApi';
import CategoryCard from './CategoryCard';
import CategoryBuilder from './CategoryBuilder';
import EmptyState from '../ui/EmptyState';
import { useAuth } from '../../context/AuthContext';

export default function CategoriesTab() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const { hasPermission } = useAuth();
  const canManageCategories = hasPermission('categories:manage');

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await getCategories();
      setCategories(res.data.data);
    } catch (err) {
      toast.error('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenBuilder = (category = null) => {
    setEditingCategory(category);
    setIsBuilderOpen(true);
  };

  const handleCloseBuilder = () => {
    setIsBuilderOpen(false);
    setEditingCategory(null);
  };

  const handleSaveCategory = async (formData) => {
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData);
        toast.success('Category updated successfully');
      } else {
        await createCategory(formData);
        toast.success('Category created successfully');
      }
      await fetchCategories();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error saving category';
      toast.error(msg);
      throw err; // throw to keep modal open if error
    }
  };

  const handleDeleteCategory = async (category) => {
    if (!window.confirm(`Are you sure you want to delete the "${category.name}" category?`)) {
      return;
    }
    try {
      await deleteCategoryApi(category.id);
      toast.success('Category deleted successfully');
      await fetchCategories();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error deleting category';
      if (err.response?.status === 409) {
        toast.error(`Cannot delete category: it is currently in use.`);
      } else {
        toast.error(msg);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-primary flex items-center gap-2">
            <Tags className="w-5 h-5 text-accent" />
            Category Management
          </h3>
          <p className="text-sm text-secondary mt-1">
            Organize your inventory with custom tags and colors.
          </p>
        </div>
        {canManageCategories && (
          <button
            onClick={() => handleOpenBuilder()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-accent/20"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Category</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-surface/50 rounded-2xl animate-pulse border border-border/50" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No Categories Found"
          description="Get started by creating your first category."
          actionText={canManageCategories ? "Create Category" : undefined}
          onAction={canManageCategories ? () => handleOpenBuilder() : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {categories.map(category => (
            <CategoryCard 
              key={category.id} 
              category={category} 
              onEdit={handleOpenBuilder}
              onDelete={handleDeleteCategory}
              canManage={canManageCategories}
            />
          ))}
        </div>
      )}

      <CategoryBuilder 
        isOpen={isBuilderOpen}
        onClose={handleCloseBuilder}
        onSave={handleSaveCategory}
        initialData={editingCategory}
      />
    </div>
  );
}
