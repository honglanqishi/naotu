import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { X, Tag as TagIcon, Check } from 'lucide-react';

export interface TagData {
    id: string;
    text: string;
    color: string;
}

interface TagPopoverProps {
    nodeTags: string[]; // Current tags on the node
    availableTags: TagData[]; // All tags mapped globally
    onAddTag: (text: string, color: string) => void;
    onRemoveTag: (tagText: string) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    trigger: React.ReactNode;
}

const TAG_COLORS = [
    '#f43f5e', // rose
    '#d946ef', // fuchsia
    '#8b5cf6', // violet
    '#3b82f6', // blue
    '#0ea5e9', // sky
    '#10b981', // emerald
    '#f59e0b', // amber
    '#f97316', // orange
];

export function TagPopover({
    nodeTags,
    availableTags,
    onAddTag,
    onRemoveTag,
    onOpenChange,
    open,
    trigger
}: TagPopoverProps) {
    const [inputText, setInputText] = useState('');
    const [selectedColor, setSelectedColor] = useState(TAG_COLORS[2]);

    const handleCreate = () => {
        if (!inputText.trim()) return;
        onAddTag(inputText.trim(), selectedColor);
        setInputText('');
    };

    return (
        <Popover.Root open={open} onOpenChange={onOpenChange}>
            <Popover.Trigger asChild>
                {trigger}
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className="z-50 w-[400px] rounded-xl bg-white p-4 shadow-xl border border-gray-200 outline-none flex flex-col gap-4"
                    sideOffset={8}
                    side="bottom"
                    align="start"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onInteractOutside={(e) => {
                        const target = e.target as Node;
                        if (!document.documentElement.contains(target)) {
                            e.preventDefault();
                        }
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b pb-2 border-gray-100">
                        <div className="flex items-center gap-2 text-gray-800 font-semibold">
                            <TagIcon className="w-4 h-4" />
                            添加标签
                        </div>
                        <Popover.Close asChild>
                            <button className="text-gray-400 hover:text-gray-600 outline-none">
                                <X className="w-4 h-4" />
                            </button>
                        </Popover.Close>
                    </div>

                    <div className="flex flex-col gap-3 pt-1">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="输入文本，按Enter生成标签..."
                                className="flex-1 border border-gray-200 rounded p-1.5 text-sm text-gray-800 outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full min-w-0"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCreate();
                                    }
                                }}
                            />
                            <button
                                onClick={handleCreate}
                                disabled={!inputText.trim()}
                                className="bg-primary text-white text-xs px-3 py-1 rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap shrink-0"
                            >
                                生成
                            </button>
                        </div>

                        {/* Color Picker Picker */}
                        <div className="flex flex-wrap gap-2 items-center justify-center">
                            {TAG_COLORS.map((c, idx) => (
                                <button
                                    key={`${c}-${idx}`}
                                    onClick={() => setSelectedColor(c)}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${selectedColor === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                                    style={{ backgroundColor: c }}
                                >
                                    {selectedColor === c && <Check className="w-3.5 h-3.5 text-white" />}
                                </button>
                            ))}
                        </div>

                        <div className="border-t border-gray-100 flex flex-wrap gap-2 mt-2 pt-3">
                            {/* Node's Current Tags */}
                            {nodeTags.map((tagText, idx) => {
                                const matchedTag = availableTags.find(t => t.text === tagText);
                                const color = matchedTag?.color || '#8b5cf6';
                                return (
                                    <div
                                        key={`tag-${tagText}-${idx}`}
                                        className="flex items-center gap-1 pl-2 pr-1 rounded text-xs text-white group"
                                        style={{ backgroundColor: color }}
                                    >
                                        <span>{tagText}</span>
                                        <button
                                            onClick={() => onRemoveTag(tagText)}
                                            className="opacity-50 hover:opacity-100 p-0.5 rounded-full hover:bg-black/20"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {availableTags.length > 0 && (
                            <div className="mt-1">
                                <div className="text-xs text-gray-400 mb-2 font-medium">节点标签池 (单击添加)</div>
                                <div className="flex flex-wrap gap-2">
                                    {availableTags.filter(t => !nodeTags.includes(t.text)).map((tag, idx) => (
                                        <button
                                            key={`pool-${tag.id}-${idx}`}
                                            onClick={() => onAddTag(tag.text, tag.color)}
                                            className="flex items-center px-2 py-0.5 rounded text-xs text-white opacity-80 hover:opacity-100 hover:scale-105 transition-all"
                                            style={{ backgroundColor: tag.color }}
                                        >
                                            {tag.text}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
