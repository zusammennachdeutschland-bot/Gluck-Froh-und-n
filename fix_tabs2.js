const fs = require('fs');
let content = fs.readFileSync('src/components/finance/FinanceView.tsx', 'utf8');

const targetStr = `<div className="flex flex-nowrap overflow-x-auto items-center gap-1.5 mt-2 pb-1 scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={\`px-3 py-1.5 rounded-full flex flex-1 sm:flex-none items-center justify-center gap-1.5 border transition-all duration-200 cursor-pointer \${
                isActive 
                  ? 'bg-primary border-primary text-white shadow-xs' 
                  : 'bg-surface hover:bg-surface-hover border-surface-border text-text-muted hover:text-text-main'
              }\`}
              title={tab.label}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {isActive && <span className="text-[11px] font-bold whitespace-nowrap overflow-hidden">{tab.label}</span>}
            </button>
          );
        })}

        <button 
          onClick={() => setActiveTab('inbox')}
          className={\`px-3 py-1.5 rounded-full flex flex-1 sm:flex-none items-center justify-center gap-1.5 border transition-all duration-200 cursor-pointer \${
            activeTab === 'inbox' 
              ? 'bg-primary border-primary text-white shadow-xs' 
              : 'bg-surface hover:bg-surface-hover border-surface-border text-text-muted hover:text-text-main'
          }\`}
          title={_t('صندوق الوارد المالي', 'Finance Inbox', 'Finanz-Posteingang')}
        >
          <div className="relative flex items-center justify-center">
            <Bell className="w-4 h-4 shrink-0" />
            {inboxCount > 0 && activeTab !== 'inbox' && (
              <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
                {inboxCount}
              </span>
            )}
          </div>
          {activeTab === 'inbox' && <span className="text-[11px] font-bold whitespace-nowrap overflow-hidden">{_t('الوارد', 'Inbox', 'Post')}</span>}
        </button>
      </div>`;

const replaceStr = `<div className="flex w-full items-center justify-between sm:justify-center gap-1 bg-surface p-1 rounded-xl border border-surface-border shadow-2xs overflow-hidden mt-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={\`h-9 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer select-none \${
                isActive 
                  ? 'bg-primary text-white px-2.5 sm:px-3 gap-1.5 shadow-xs font-black shrink-0' 
                  : 'w-8 sm:w-9 text-text-muted hover:bg-surface-hover hover:text-text-main shrink-0'
              }\`}
              title={tab.label}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {isActive && <span className="text-[11px] font-bold whitespace-nowrap overflow-hidden">{tab.label}</span>}
            </button>
          );
        })}

        <button 
          onClick={() => setActiveTab('inbox')}
          className={\`h-9 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer select-none \${
            activeTab === 'inbox' 
              ? 'bg-primary text-white px-2.5 sm:px-3 gap-1.5 shadow-xs font-black shrink-0' 
              : 'w-8 sm:w-9 text-text-muted hover:bg-surface-hover hover:text-text-main shrink-0'
          }\`}
          title={_t('صندوق الوارد المالي', 'Finance Inbox', 'Finanz-Posteingang')}
        >
          <div className="relative flex items-center justify-center">
            <Bell className="w-4 h-4 shrink-0" />
            {inboxCount > 0 && activeTab !== 'inbox' && (
              <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
                {inboxCount}
              </span>
            )}
          </div>
          {activeTab === 'inbox' && <span className="text-[11px] font-bold whitespace-nowrap overflow-hidden">{_t('الوارد', 'Inbox', 'Post')}</span>}
        </button>
      </div>`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('src/components/finance/FinanceView.tsx', content);
