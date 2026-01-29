
import React from 'react';
import { Icons } from './Icons';

interface CodePreviewProps {
    blueprint: any;
    isDark?: boolean;
}

const CodePreview: React.FC<CodePreviewProps> = ({ blueprint, isDark = true }) => {
    const jsonString = JSON.stringify(blueprint, null, 2);

    // Simple syntax highlighting
    const highlightJSON = (json: string) => {
        return json.split('\n').map((line, i) => {
            // Highlight keys
            const highlightedLine = line
                .replace(/"([^"]+)":/g, '<span class="text-[#B5A8E0]">"$1"</span>:')
                // Highlight strings
                .replace(/: "([^"]+)"/g, ': <span class="text-amber-300">"$1"</span>')
                // Highlight numbers
                .replace(/: (\d+)/g, ': <span class="text-blue-400">$1</span>')
                // Highlight booleans
                .replace(/: (true|false)/g, ': <span class="text-purple-400">$1</span>');

            return (
                <div key={i} className="flex gap-4">
                    <span className="w-8 text-right opacity-20 select-none font-mono text-sm">{i + 1}</span>
                    <span dangerouslySetInnerHTML={{ __html: highlightedLine }} />
                </div>
            );
        });
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(jsonString);
    };

    return (
        <div className={`flex flex-col h-full font-mono text-[11px] leading-relaxed ${isDark ? 'bg-[#08080A] text-zinc-300' : 'bg-white text-zinc-600'}`}>
            <div className={`flex items-center justify-between px-6 py-3 border-b shrink-0 ${isDark ? 'border-[#9F8FD4]/10 bg-[#1A1625]/50' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex items-center gap-2">
                    <Icons.Folder size={14} className="opacity-50" />
                    <span className="font-bold opacity-50 uppercase tracking-widest text-sm">blueprint.json</span>
                </div>
                <button
                    onClick={copyToClipboard}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-[9px] font-medium ${isDark ? 'bg-white/5 hover:bg-white/10 text-[#A8A3B3] hover:text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-500 hover:text-slate-900'}`}
                >
                    <Icons.Copy size={12} />
                    Copy
                </button>
            </div>
            <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                <div className="inline-block min-w-full">
                    {highlightJSON(jsonString)}
                </div>
            </div>
        </div>
    );
};

export default CodePreview;
