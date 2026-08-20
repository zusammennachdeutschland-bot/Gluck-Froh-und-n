import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ListTodo, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { TodoItem } from "../types";

export const QuickTodoWidget: React.FC = () => {
  const { t, todos, setTodos } = useApp();

  const [isExpanded, setIsExpanded] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');

  const handleAddTodo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newTaskText.trim();
    if (!trimmed) return;

    const newTodo: TodoItem = {
      id: Date.now().toString(),
      text: trimmed,
      createdAt: Date.now()
    };

    setTodos(prev => [newTodo, ...prev]);
    setNewTaskText('');
  };

  const handleRemoveTodo = (id: string) => {
    setTodos(prev => prev.filter(item => item.id !== id));
  };

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
            {todos.length}
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
      {!isExpanded && todos.length > 0 && (
        <div className="px-3 pb-2 pt-0 text-[11px] text-slate-600 dark:text-slate-300 space-y-1 border-t border-slate-100/60 dark:border-surface-border/40">
          {todos.slice(0, 4).map((todo) => (
            <div key={todo.id} className="flex items-center justify-between gap-2 py-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate leading-snug">
                  {todo.text}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTodo(todo.id);
                }}
                className="p-0.5 text-slate-400 hover:text-primary transition-colors cursor-pointer shrink-0"
                title="Done"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {todos.length > 4 && (
            <div className="text-[10px] font-bold text-primary/80 pt-0.5">
              +{todos.length - 4} {t('todo_more_tasks') || 'more tasks...'}
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
          {todos.length === 0 ? (
            <div className="text-center py-1.5 text-xs font-medium text-text-muted/70 dark:text-slate-500">
              {t('todo_no_tasks') || 'Keine offenen Todos'}
            </div>
          ) : (
            <ul className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
              {(todos || []).map((todo) => (
                <li
                  key={todo.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1 bg-background/90 dark:bg-slate-800/60 rounded-lg border border-slate-100 dark:border-surface-border-soft/50 group transition-colors"
                >
                  <span className="text-[11px] font-medium text-text-main break-words flex-1 leading-snug">
                    {todo.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTodo(todo.id)}
                    className="p-0.5 text-slate-400 hover:text-primary hover:bg-primary-soft dark:hover:bg-primary-soft/50 rounded transition-colors cursor-pointer shrink-0"
                    title="Complete & Remove"
                    aria-label="Remove task"
                  >
                    <X className="w-3 h-3" />
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
