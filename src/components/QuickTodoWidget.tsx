import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ListTodo, ChevronDown, ChevronUp, Plus, X, Check, Circle } from 'lucide-react';

export const QuickTodoWidget: React.FC = () => {
  const { t, todos, addTodo, deleteTodo, toggleTodo } = useApp();

  const [isExpanded, setIsExpanded] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');

  const handleAddTodo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newTaskText.trim();
    if (!trimmed) return;

    addTodo(trimmed);
    setNewTaskText('');
  };

  const handleRemoveTodo = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    deleteTodo(id);
  };

  const handleToggleTodo = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    toggleTodo(id);
  };

  const activeTodosList = (todos || []).filter(t => !t.completed);
  const completedTodosList = (todos || []).filter(t => t.completed);

  return (
    <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl shadow-2xs overflow-hidden transition-all">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between gap-2.5 text-left hover:bg-background/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-primary-soft dark:bg-primary-soft/80 text-primary dark:text-primary shrink-0">
            <ListTodo className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
            {t('todo_widget_title') || 'Quick Todos'}
          </span>
          <span className="text-[10px] font-bold bg-primary-soft text-primary dark:bg-primary-soft/80 dark:text-primary/70 px-1.5 py-0.2 rounded shrink-0">
            {activeTodosList.length}
          </span>
        </div>
        <div className="flex items-center gap-1 text-text-muted/70 shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {/* Collapsed Small Text Task Preview */}
      {!isExpanded && activeTodosList.length > 0 && (
        <div className="px-3 pb-2 pt-0 text-[11px] text-slate-600 dark:text-slate-300 space-y-1 border-t border-slate-100/60 dark:border-surface-border/40">
          {activeTodosList.slice(0, 4).map((todo) => (
            <div key={todo.id} className="flex items-center justify-between gap-2 py-0.5">
              <button
                type="button"
                onClick={(e) => handleToggleTodo(todo.id, e)}
                className="flex items-center gap-1.5 min-w-0 text-left cursor-pointer group flex-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 group-hover:scale-125 transition-transform" />
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate leading-snug">
                  {todo.text}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => handleRemoveTodo(todo.id, e)}
                className="p-0.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer shrink-0"
                title="Delete"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {activeTodosList.length > 4 && (
            <div className="text-[10px] font-bold text-primary/80 pt-0.5">
              +{activeTodosList.length - 4} {t('todo_more_tasks') || 'more tasks...'}
            </div>
          )}
        </div>
      )}

      {/* Expanded Content Area */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-surface-border/80 space-y-2">
          {/* Add Task Form */}
          <form onSubmit={handleAddTodo} className="flex items-center gap-1.5">
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder={t('todo_add_placeholder') || 'Neue Aufgabe...'}
              className="flex-1 px-2.5 py-1.5 bg-surface-hover/80 border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <button
              type="submit"
              disabled={!newTaskText.trim()}
              className="px-2.5 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('todo_add_btn') || 'Hinzufügen'}</span>
            </button>
          </form>

          {/* Task List */}
          {(todos || []).length === 0 ? (
            <div className="text-center py-1.5 text-xs font-medium text-text-muted/70 dark:text-slate-500">
              {t('todo_no_tasks') || 'Keine offenen Todos'}
            </div>
          ) : (
            <ul className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
              {(todos || []).map((todo) => (
                <li
                  key={todo.id}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border transition-colors ${
                    todo.completed
                      ? 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 opacity-60'
                      : 'bg-background/90 dark:bg-slate-800/60 border-slate-100 dark:border-surface-border-soft/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => handleToggleTodo(todo.id, e)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                      todo.completed
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-primary'
                    }`}>
                      {todo.completed && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <span className={`text-[11px] font-medium break-words leading-snug ${
                      todo.completed
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-text-main'
                    }`}>
                      {todo.text}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveTodo(todo.id, e)}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors cursor-pointer shrink-0"
                    title="Delete task"
                    aria-label="Delete task"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
